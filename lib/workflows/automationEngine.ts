/**
 * Automation Engine
 * 
 * Hanterar automatisering av arbetsflöden:
 * - Händelse → Uppgift → Påminnelse → Eskalering
 * - Schemalagda jobb
 * - Regelbaserade triggers
 * - Integration med Slack/Teams för notifikationer
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { slackTeamsService } from '../notifications/slackTeamsService';
import { sendNotification } from '../accounting/services/notificationService';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.AUTOMATIONS_TABLE_NAME || 'aifm-automations';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============================================================================
// Types
// ============================================================================

export type EventType =
  // Document events
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_CLASSIFIED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'DOCUMENT_SYNCED'
  // Approval events
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'APPROVAL_ESCALATED'
  // Deadline events
  | 'DEADLINE_APPROACHING'
  | 'DEADLINE_REACHED'
  | 'DEADLINE_PASSED'
  // Playbook events
  | 'PLAYBOOK_STARTED'
  | 'PLAYBOOK_STEP_COMPLETED'
  | 'PLAYBOOK_COMPLETED'
  | 'PLAYBOOK_BLOCKED'
  // NAV events
  | 'NAV_CALCULATED'
  | 'NAV_PUBLISHED'
  | 'NAV_CORRECTION'
  // System events
  | 'SYNC_FAILED'
  | 'ANOMALY_DETECTED'
  | 'THRESHOLD_EXCEEDED'
  // Period events
  | 'PERIOD_CLOSING_DUE'
  | 'PERIOD_CLOSED'
  | 'QUARTER_END'
  | 'YEAR_END';

export type ActionType =
  | 'CREATE_TASK'
  | 'SEND_NOTIFICATION'
  | 'SEND_EMAIL'
  | 'SEND_SLACK'
  | 'SEND_TEAMS'
  | 'START_PLAYBOOK'
  | 'ASSIGN_USER'
  | 'ESCALATE'
  | 'CREATE_APPROVAL_REQUEST'
  | 'UPDATE_STATUS'
  | 'WEBHOOK'
  | 'SCHEDULE_REMINDER';

export interface AutomationRule {
  id: string;
  tenantId: string;
  companyId?: string; // Om null gäller för hela tenant
  
  name: string;
  description: string;
  enabled: boolean;
  
  // Trigger
  trigger: {
    event: EventType;
    conditions?: RuleCondition[];
    schedule?: {
      type: 'cron' | 'interval';
      expression: string; // Cron expression or interval like "1h", "30m"
    };
  };
  
  // Actions
  actions: AutomationAction[];
  
  // Execution settings
  settings: {
    runOnce: boolean; // Kör bara en gång per unik händelse
    cooldownMinutes?: number; // Minst X minuter mellan körningar
    maxExecutionsPerHour?: number;
    retryOnFailure: boolean;
    maxRetries: number;
  };
  
  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastExecutedAt?: string;
  executionCount: number;
}

export interface RuleCondition {
  field: string; // Fält i event data, t.ex. "amount", "supplier", "status"
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'regex';
  value: unknown;
}

export interface AutomationAction {
  id: string;
  type: ActionType;
  order: number;
  
  // Action-specifik konfiguration
  config: Record<string, unknown>;
  
  // Villkor för att köra denna action
  condition?: RuleCondition;
  
  // Fördröjning
  delayMinutes?: number;
  
  // Felhantering
  continueOnError: boolean;
}

export interface AutomationEvent {
  id: string;
  tenantId: string;
  companyId: string;
  type: EventType;
  source: string; // Vilken service som genererade händelsen
  timestamp: string;
  data: Record<string, unknown>;
  correlationId?: string; // För att länka relaterade händelser
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  eventId: string;
  tenantId: string;
  companyId: string;
  
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  
  startedAt: string;
  completedAt?: string;
  
  actionResults: {
    actionId: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    result?: unknown;
    error?: string;
    executedAt: string;
  }[];
  
  error?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  defaultAssigneeType: 'user' | 'role' | 'team';
  defaultAssignee: string;
  defaultPriority: 'low' | 'medium' | 'high' | 'urgent';
  dueDaysOffset: number;
  reminderDays: number[];
  escalationDays: number;
  escalateTo: string;
  checklistItems?: string[];
  tags?: string[];
}

// ============================================================================
// Default Rules
// ============================================================================

const DEFAULT_AUTOMATION_RULES: Omit<AutomationRule, 'createdAt' | 'updatedAt' | 'lastExecutedAt' | 'executionCount'>[] = [
  {
    id: 'rule-document-uploaded',
    tenantId: 'default',
    name: 'Ny faktura uppladdad',
    description: 'Skapa uppgift när ny faktura laddas upp',
    enabled: true,
    trigger: {
      event: 'DOCUMENT_UPLOADED',
      conditions: [
        { field: 'docType', operator: 'in', value: ['INVOICE', 'RECEIPT'] }
      ],
    },
    actions: [
      {
        id: 'action-1',
        type: 'CREATE_TASK',
        order: 1,
        config: {
          title: 'Granska och godkänn faktura',
          description: 'En ny faktura har laddats upp och väntar på granskning.',
          assigneeType: 'role',
          assignee: 'accountant',
          priority: 'medium',
          dueDays: 3,
        },
        continueOnError: false,
      },
      {
        id: 'action-2',
        type: 'SEND_NOTIFICATION',
        order: 2,
        config: {
          channels: ['in_app'],
          title: 'Ny faktura väntar på granskning',
          message: 'En ny faktura från {supplier} på {amount} kr har laddats upp.',
        },
        continueOnError: true,
      },
    ],
    settings: {
      runOnce: true,
      retryOnFailure: true,
      maxRetries: 3,
    },
    createdBy: 'system',
  },
  {
    id: 'rule-approval-escalation',
    tenantId: 'default',
    name: 'Eskalering vid försenat godkännande',
    description: 'Eskalera automatiskt om godkännande inte sker inom tidsgräns',
    enabled: true,
    trigger: {
      event: 'DEADLINE_PASSED',
      conditions: [
        { field: 'entityType', operator: 'eq', value: 'APPROVAL_REQUEST' }
      ],
    },
    actions: [
      {
        id: 'action-1',
        type: 'ESCALATE',
        order: 1,
        config: {
          escalateTo: 'manager',
          reason: 'Automatisk eskalering - godkännande försenat',
        },
        continueOnError: false,
      },
      {
        id: 'action-2',
        type: 'SEND_SLACK',
        order: 2,
        config: {
          channel: 'approvals',
          priority: 'urgent',
          message: '⚠️ Godkännande för {title} har eskalerats pga försening',
        },
        continueOnError: true,
      },
      {
        id: 'action-3',
        type: 'SEND_EMAIL',
        order: 3,
        config: {
          recipients: ['escalatedTo'],
          subject: 'Brådskande: Eskalerat godkännande väntar',
          template: 'escalation',
        },
        continueOnError: true,
      },
    ],
    settings: {
      runOnce: true,
      retryOnFailure: true,
      maxRetries: 2,
    },
    createdBy: 'system',
  },
  {
    id: 'rule-deadline-reminder',
    tenantId: 'default',
    name: 'Påminnelse innan deadline',
    description: 'Skicka påminnelse X dagar innan deadline',
    enabled: true,
    trigger: {
      event: 'DEADLINE_APPROACHING',
      conditions: [
        { field: 'daysUntil', operator: 'in', value: [7, 3, 1] }
      ],
    },
    actions: [
      {
        id: 'action-1',
        type: 'SEND_NOTIFICATION',
        order: 1,
        config: {
          channels: ['in_app', 'email'],
          title: 'Påminnelse: {title}',
          message: '{daysUntil} dag(ar) kvar till deadline.',
        },
        continueOnError: true,
      },
      {
        id: 'action-2',
        type: 'SEND_SLACK',
        order: 2,
        config: {
          channel: 'general',
          priority: 'normal',
          message: '📅 Påminnelse: "{title}" har deadline om {daysUntil} dag(ar)',
        },
        condition: { field: 'daysUntil', operator: 'lte', value: 3 },
        continueOnError: true,
      },
    ],
    settings: {
      runOnce: false,
      cooldownMinutes: 1440, // 24 timmar
      retryOnFailure: false,
      maxRetries: 0,
    },
    createdBy: 'system',
  },
  {
    id: 'rule-nav-published',
    tenantId: 'default',
    name: 'NAV publicerat',
    description: 'Notifiera när NAV har publicerats',
    enabled: true,
    trigger: {
      event: 'NAV_PUBLISHED',
    },
    actions: [
      {
        id: 'action-1',
        type: 'SEND_SLACK',
        order: 1,
        config: {
          channel: 'accounting',
          priority: 'normal',
          message: '✅ NAV för {fundName} per {navDate} har publicerats: {navValue} ({navChange})',
        },
        continueOnError: true,
      },
      {
        id: 'action-2',
        type: 'CREATE_TASK',
        order: 2,
        config: {
          title: 'Bekräfta NAV-distribution',
          description: 'Verifiera att NAV har distribuerats till alla kanaler.',
          assigneeType: 'role',
          assignee: 'fund_accountant',
          priority: 'high',
          dueDays: 1,
        },
        continueOnError: false,
      },
    ],
    settings: {
      runOnce: true,
      retryOnFailure: true,
      maxRetries: 3,
    },
    createdBy: 'system',
  },
  {
    id: 'rule-sync-failed',
    tenantId: 'default',
    name: 'Synkronisering misslyckades',
    description: 'Larma vid misslyckad synkronisering',
    enabled: true,
    trigger: {
      event: 'SYNC_FAILED',
    },
    actions: [
      {
        id: 'action-1',
        type: 'SEND_SLACK',
        order: 1,
        config: {
          channel: 'alerts',
          priority: 'urgent',
          message: '🚨 Synkronisering med {service} misslyckades: {error}',
        },
        continueOnError: false,
      },
      {
        id: 'action-2',
        type: 'CREATE_TASK',
        order: 2,
        config: {
          title: 'Åtgärda synkroniseringsfel',
          description: 'Synkronisering med {service} misslyckades. Utred och åtgärda.',
          assigneeType: 'role',
          assignee: 'admin',
          priority: 'urgent',
          dueDays: 1,
        },
        continueOnError: true,
      },
      {
        id: 'action-3',
        type: 'SEND_EMAIL',
        order: 3,
        config: {
          recipients: ['admin', 'manager'],
          subject: 'URGENT: Synkronisering misslyckades',
          template: 'sync_error',
        },
        continueOnError: true,
      },
    ],
    settings: {
      runOnce: false,
      cooldownMinutes: 30,
      retryOnFailure: false,
      maxRetries: 0,
    },
    createdBy: 'system',
  },
  {
    id: 'rule-period-closing',
    tenantId: 'default',
    name: 'Periodbokslut påminnelse',
    description: 'Starta playbook för periodbokslut',
    enabled: true,
    trigger: {
      event: 'PERIOD_CLOSING_DUE',
    },
    actions: [
      {
        id: 'action-1',
        type: 'START_PLAYBOOK',
        order: 1,
        config: {
          templateId: 'template-nav-monthly',
          owner: 'fund_accountant',
        },
        continueOnError: false,
      },
      {
        id: 'action-2',
        type: 'SEND_NOTIFICATION',
        order: 2,
        config: {
          channels: ['in_app', 'email'],
          title: 'Periodbokslut startat',
          message: 'Periodbokslut för {period} har startats automatiskt.',
        },
        continueOnError: true,
      },
    ],
    settings: {
      runOnce: true,
      retryOnFailure: true,
      maxRetries: 3,
    },
    createdBy: 'system',
  },
];

// ============================================================================
// Service
// ============================================================================

export const automationEngine = {
  // ========== Event Processing ==========

  async processEvent(event: AutomationEvent): Promise<AutomationExecution[]> {
    console.log(`[AutomationEngine] Processing event ${event.type}: ${event.id}`);

    // Find matching rules
    const rules = await this.getMatchingRules(event);
    const executions: AutomationExecution[] = [];

    for (const rule of rules) {
      // Check cooldown
      if (rule.settings.cooldownMinutes && rule.lastExecutedAt) {
        const lastExec = new Date(rule.lastExecutedAt).getTime();
        const cooldownMs = rule.settings.cooldownMinutes * 60 * 1000;
        if (Date.now() - lastExec < cooldownMs) {
          console.log(`[AutomationEngine] Rule ${rule.id} in cooldown, skipping`);
          continue;
        }
      }

      // Execute rule
      const execution = await this.executeRule(rule, event);
      executions.push(execution);
    }

    return executions;
  },

  async getMatchingRules(event: AutomationEvent): Promise<AutomationRule[]> {
    // Get rules for this tenant
    const rules = await this.getRules(event.tenantId, event.companyId);

    return rules.filter(rule => {
      // Check if enabled
      if (!rule.enabled) return false;

      // Check event type match
      if (rule.trigger.event !== event.type) return false;

      // Check conditions
      if (rule.trigger.conditions) {
        for (const condition of rule.trigger.conditions) {
          if (!this.evaluateCondition(condition, event.data)) {
            return false;
          }
        }
      }

      return true;
    });
  },

  evaluateCondition(condition: RuleCondition, data: Record<string, unknown>): boolean {
    const value = this.getNestedValue(data, condition.field);

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'neq':
        return value !== condition.value;
      case 'gt':
        return typeof value === 'number' && value > (condition.value as number);
      case 'gte':
        return typeof value === 'number' && value >= (condition.value as number);
      case 'lt':
        return typeof value === 'number' && value < (condition.value as number);
      case 'lte':
        return typeof value === 'number' && value <= (condition.value as number);
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value as string);
      case 'not_contains':
        return typeof value === 'string' && !value.includes(condition.value as string);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'regex':
        return typeof value === 'string' && new RegExp(condition.value as string).test(value);
      default:
        return false;
    }
  },

  getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
    }, obj as unknown);
  },

  async executeRule(rule: AutomationRule, event: AutomationEvent): Promise<AutomationExecution> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const execution: AutomationExecution = {
      id: executionId,
      ruleId: rule.id,
      eventId: event.id,
      tenantId: event.tenantId,
      companyId: event.companyId,
      status: 'RUNNING',
      startedAt: now,
      actionResults: [],
    };

    try {
      // Sort actions by order
      const sortedActions = [...rule.actions].sort((a, b) => a.order - b.order);

      for (const action of sortedActions) {
        // Check action condition
        if (action.condition && !this.evaluateCondition(action.condition, event.data)) {
          execution.actionResults.push({
            actionId: action.id,
            status: 'SKIPPED',
            executedAt: new Date().toISOString(),
          });
          continue;
        }

        // Handle delay
        if (action.delayMinutes && action.delayMinutes > 0) {
          await this.scheduleDelayedAction(execution.id, action, event, action.delayMinutes);
          execution.actionResults.push({
            actionId: action.id,
            status: 'SUCCESS',
            result: { scheduled: true, delayMinutes: action.delayMinutes },
            executedAt: new Date().toISOString(),
          });
          continue;
        }

        // Execute action
        try {
          const result = await this.executeAction(action, event);
          execution.actionResults.push({
            actionId: action.id,
            status: 'SUCCESS',
            result,
            executedAt: new Date().toISOString(),
          });
        } catch (error) {
          execution.actionResults.push({
            actionId: action.id,
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Unknown error',
            executedAt: new Date().toISOString(),
          });

          if (!action.continueOnError) {
            throw error;
          }
        }
      }

      execution.status = execution.actionResults.some(r => r.status === 'FAILED') ? 'PARTIAL' : 'COMPLETED';
    } catch (error) {
      execution.status = 'FAILED';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
    }

    execution.completedAt = new Date().toISOString();

    // Save execution
    await this.saveExecution(execution);

    // Update rule last executed
    await this.updateRuleLastExecuted(rule.id, rule.tenantId);

    console.log(`[AutomationEngine] Rule ${rule.id} executed with status ${execution.status}`);

    return execution;
  },

  async executeAction(action: AutomationAction, event: AutomationEvent): Promise<unknown> {
    const config = this.interpolateConfig(action.config, event.data);

    switch (action.type) {
      case 'CREATE_TASK':
        return this.createTask(event.tenantId, event.companyId, config);

      case 'SEND_NOTIFICATION':
        return sendNotification({
          companyId: event.companyId,
          type: 'batch_complete', // Generic type
          priority: (config.priority as 'low' | 'normal' | 'high' | 'urgent') || 'normal',
          title: config.title as string,
          message: config.message as string,
          channels: (config.channels as ('in_app' | 'email' | 'push')[]) || ['in_app'],
          actionUrl: config.actionUrl as string,
        });

      case 'SEND_SLACK':
        return slackTeamsService.send({
          tenantId: event.tenantId,
          companyId: event.companyId,
          channel: 'slack',
          category: (config.channel as 'accounting' | 'compliance' | 'approvals' | 'alerts' | 'general') || 'general',
          priority: (config.priority as 'low' | 'normal' | 'high' | 'urgent') || 'normal',
          title: config.title as string || event.type,
          message: config.message as string,
          actionUrl: config.actionUrl as string,
        });

      case 'SEND_TEAMS':
        return slackTeamsService.send({
          tenantId: event.tenantId,
          companyId: event.companyId,
          channel: 'teams',
          category: (config.channel as 'accounting' | 'compliance' | 'approvals' | 'alerts' | 'general') || 'general',
          priority: (config.priority as 'low' | 'normal' | 'high' | 'urgent') || 'normal',
          title: config.title as string || event.type,
          message: config.message as string,
          actionUrl: config.actionUrl as string,
        });

      case 'ESCALATE':
        return this.escalate(event.tenantId, event.companyId, event.data, config);

      case 'START_PLAYBOOK':
        return this.startPlaybook(event.tenantId, event.companyId, config);

      case 'WEBHOOK':
        return this.callWebhook(config);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  },

  interpolateConfig(config: Record<string, unknown>, data: Record<string, unknown>): Record<string, unknown> {
    const interpolated: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        interpolated[key] = value.replace(/\{(\w+(?:\.\w+)*)\}/g, (_, path) => {
          const val = this.getNestedValue(data, path);
          return val !== undefined ? String(val) : `{${path}}`;
        });
      } else {
        interpolated[key] = value;
      }
    }

    return interpolated;
  },

  // ========== Action Implementations ==========

  async createTask(tenantId: string, companyId: string, config: Record<string, unknown>): Promise<unknown> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const dueDays = (config.dueDays as number) || 3;
    const dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);

    const task = {
      id: taskId,
      tenantId,
      companyId,
      title: config.title as string,
      description: config.description as string,
      assigneeType: config.assigneeType || 'role',
      assignee: config.assignee as string,
      priority: config.priority || 'medium',
      status: 'PENDING',
      dueDate: dueDate.toISOString(),
      createdAt: now.toISOString(),
      createdBy: 'automation',
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${tenantId}`,
        sk: `TASK#${taskId}`,
        gsi1pk: `COMPANY#${companyId}`,
        gsi1sk: `TASK#${task.status}#${task.dueDate}`,
        ...task,
      },
    }));

    return task;
  },

  async escalate(
    tenantId: string,
    companyId: string,
    eventData: Record<string, unknown>,
    config: Record<string, unknown>
  ): Promise<unknown> {
    // Would integrate with approval workflow service
    console.log('[AutomationEngine] Escalating:', {
      tenantId,
      companyId,
      escalateTo: config.escalateTo,
      reason: config.reason,
      entityId: eventData.entityId,
    });

    return { escalated: true, escalateTo: config.escalateTo };
  },

  async startPlaybook(
    tenantId: string,
    companyId: string,
    config: Record<string, unknown>
  ): Promise<unknown> {
    // Would integrate with playbook service
    console.log('[AutomationEngine] Starting playbook:', {
      tenantId,
      companyId,
      templateId: config.templateId,
      owner: config.owner,
    });

    return { playbookStarted: true, templateId: config.templateId };
  },

  async callWebhook(config: Record<string, unknown>): Promise<unknown> {
    const url = config.url as string;
    const method = (config.method as string) || 'POST';
    const headers = (config.headers as Record<string, string>) || {};
    const body = config.body;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return {
      status: response.status,
      ok: response.ok,
    };
  },

  async scheduleDelayedAction(
    executionId: string,
    action: AutomationAction,
    event: AutomationEvent,
    delayMinutes: number
  ): Promise<void> {
    const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `SCHEDULED_ACTION`,
        sk: `${scheduledTime.toISOString()}#${executionId}#${action.id}`,
        executionId,
        action,
        event,
        scheduledFor: scheduledTime.toISOString(),
        ttl: Math.floor(scheduledTime.getTime() / 1000) + 86400, // +1 day
      },
    }));
  },

  // ========== Rule Management ==========

  async getRules(tenantId: string, companyId?: string): Promise<AutomationRule[]> {
    const defaultRules = DEFAULT_AUTOMATION_RULES.map(r => ({
      ...r,
      tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionCount: 0,
    }));

    try {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}`,
          ':sk': 'RULE#',
        },
      }));

      const customRules = (result.Items || []) as AutomationRule[];

      // Merge default and custom rules, custom rules override defaults with same ID
      const ruleMap = new Map<string, AutomationRule>();
      for (const rule of defaultRules) {
        if (!companyId || !rule.companyId || rule.companyId === companyId) {
          ruleMap.set(rule.id, rule);
        }
      }
      for (const rule of customRules) {
        if (!companyId || !rule.companyId || rule.companyId === companyId) {
          ruleMap.set(rule.id, rule);
        }
      }

      return Array.from(ruleMap.values());
    } catch (error) {
      console.error('[AutomationEngine] Error getting rules:', error);
      return defaultRules;
    }
  },

  async saveExecution(execution: AutomationExecution): Promise<void> {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${execution.tenantId}`,
        sk: `EXECUTION#${execution.id}`,
        gsi1pk: `RULE#${execution.ruleId}`,
        gsi1sk: execution.startedAt,
        ...execution,
        ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
      },
    }));
  },

  async updateRuleLastExecuted(ruleId: string, tenantId: string): Promise<void> {
    try {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `TENANT#${tenantId}`,
          sk: `RULE#${ruleId}`,
        },
        UpdateExpression: 'SET lastExecutedAt = :now, executionCount = if_not_exists(executionCount, :zero) + :one',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString(),
          ':zero': 0,
          ':one': 1,
        },
      }));
    } catch (error) {
      // Rule might not exist in DB (using default)
      console.log('[AutomationEngine] Could not update rule execution time (default rule?)');
    }
  },

  // ========== Event Emitters ==========

  async emit(event: Omit<AutomationEvent, 'id' | 'timestamp'>): Promise<AutomationExecution[]> {
    const fullEvent: AutomationEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    // Log event
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${event.tenantId}`,
        sk: `EVENT#${fullEvent.timestamp}#${fullEvent.id}`,
        gsi1pk: `EVENT_TYPE#${event.type}`,
        gsi1sk: fullEvent.timestamp,
        ...fullEvent,
        ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      },
    }));

    return this.processEvent(fullEvent);
  },
};

export default automationEngine;


