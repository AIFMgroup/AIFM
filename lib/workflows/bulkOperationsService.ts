/**
 * Bulk Operations & Templates Service
 * 
 * Hanterar:
 * - Massuppdateringar (bulk actions)
 * - Återanvändbara mallar
 * - Standardkommentarer
 * - One-click återkommande jobb
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, UpdateCommand, DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { sendNotification } from '../accounting/services/notificationService';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.BULK_TABLE_NAME || 'aifm-bulk-operations';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============================================================================
// Types
// ============================================================================

export type BulkActionType =
  | 'APPROVE_DOCUMENTS'
  | 'REJECT_DOCUMENTS'
  | 'CLASSIFY_DOCUMENTS'
  | 'SYNC_TO_FORTNOX'
  | 'UPDATE_ACCOUNTS'
  | 'UPDATE_COST_CENTER'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'ASSIGN_USER'
  | 'CHANGE_STATUS'
  | 'DELETE_DOCUMENTS'
  | 'ARCHIVE_DOCUMENTS'
  | 'EXPORT_DOCUMENTS'
  | 'APPLY_TEMPLATE';

export interface BulkOperation {
  id: string;
  tenantId: string;
  companyId: string;
  
  type: BulkActionType;
  name: string;
  description?: string;
  
  // Vad som påverkas
  targetType: 'document' | 'transaction' | 'supplier' | 'customer' | 'user' | 'task';
  targetIds: string[];
  targetCount: number;
  
  // Vad som ska göras
  action: Record<string, unknown>;
  
  // Status
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PENDING_APPROVAL';
  progress: number; // 0-100
  
  // Resultat
  results: {
    successful: number;
    failed: number;
    skipped: number;
    errors: { targetId: string; error: string }[];
  };
  
  // Godkännande
  requiresApproval: boolean;
  approvalId?: string;
  
  // Audit
  createdBy: string;
  createdByName: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // Scheduling
  scheduledFor?: string;
  isRecurring: boolean;
  recurringSchedule?: {
    type: 'daily' | 'weekly' | 'monthly';
    time: string; // "08:00"
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
  };
}

export type TemplateCategory =
  | 'INVOICE_CLASSIFICATION'
  | 'EXPENSE_REPORT'
  | 'JOURNAL_ENTRY'
  | 'RECONCILIATION'
  | 'REPORT'
  | 'EMAIL'
  | 'COMMENT'
  | 'CHECKLIST';

export interface Template {
  id: string;
  tenantId: string;
  companyId?: string;
  
  category: TemplateCategory;
  name: string;
  description: string;
  
  // Mall-innehåll
  content: Record<string, unknown>;
  
  // Variabler som kan ersättas
  variables: TemplateVariable[];
  
  // Metadata
  tags: string[];
  isDefault: boolean;
  isPublic: boolean; // Synlig för alla i tenant
  
  // Användningsstatistik
  usageCount: number;
  lastUsedAt?: string;
  
  // Audit
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'user' | 'company' | 'account';
  required: boolean;
  defaultValue?: unknown;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface StandardComment {
  id: string;
  tenantId: string;
  companyId?: string;
  
  category: string;
  text: string;
  shortcut?: string; // T.ex. "/ok" för "Godkänt utan anmärkning"
  
  // Villkor för att visa
  showFor?: {
    documentTypes?: string[];
    statuses?: string[];
    actions?: string[];
  };
  
  // Metadata
  usageCount: number;
  createdBy: string;
  createdAt: string;
}

export interface RecurringJob {
  id: string;
  tenantId: string;
  companyId: string;
  
  name: string;
  description: string;
  
  // Vad som ska göras
  actionType: BulkActionType;
  action: Record<string, unknown>;
  
  // Selektionskriterier
  selectionCriteria: {
    type: 'query' | 'fixed';
    query?: Record<string, unknown>;
    fixedIds?: string[];
  };
  
  // Schema
  schedule: {
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    monthOfYear?: number;
    timezone: string;
  };
  
  // Status
  enabled: boolean;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'partial' | 'failed';
  nextRunAt: string;
  
  // Notifieringar
  notifyOnComplete: boolean;
  notifyOnFailure: boolean;
  notifyRecipients: string[];
  
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Default Templates
// ============================================================================

const DEFAULT_TEMPLATES: Omit<Template, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'template-invoice-standard',
    tenantId: 'default',
    category: 'INVOICE_CLASSIFICATION',
    name: 'Standard leverantörsfaktura',
    description: 'Mall för vanliga leverantörsfakturor',
    content: {
      documentType: 'INVOICE',
      defaultAccount: '4010',
      vatHandling: 'reverse_charge',
      paymentTerms: 30,
    },
    variables: [
      {
        name: 'account',
        label: 'Bokföringskonto',
        type: 'account',
        required: true,
        defaultValue: '4010',
      },
      {
        name: 'costCenter',
        label: 'Kostnadsställe',
        type: 'select',
        required: false,
        options: [],
      },
      {
        name: 'project',
        label: 'Projekt',
        type: 'text',
        required: false,
      },
    ],
    tags: ['faktura', 'leverantör', 'standard'],
    isDefault: true,
    isPublic: true,
    usageCount: 0,
    createdBy: 'system',
  },
  {
    id: 'template-expense-travel',
    tenantId: 'default',
    category: 'EXPENSE_REPORT',
    name: 'Reseräkning',
    description: 'Mall för reseersättningar och utlägg',
    content: {
      documentType: 'EXPENSE',
      defaultAccount: '7330',
      requiresReceipts: true,
      perDiemEnabled: true,
      mileageEnabled: true,
    },
    variables: [
      {
        name: 'travelDate',
        label: 'Resedatum',
        type: 'date',
        required: true,
      },
      {
        name: 'destination',
        label: 'Destination',
        type: 'text',
        required: true,
      },
      {
        name: 'purpose',
        label: 'Syfte',
        type: 'text',
        required: true,
      },
      {
        name: 'kilometers',
        label: 'Antal kilometer',
        type: 'number',
        required: false,
        validation: { min: 0 },
      },
    ],
    tags: ['utlägg', 'resa', 'ersättning'],
    isDefault: true,
    isPublic: true,
    usageCount: 0,
    createdBy: 'system',
  },
  {
    id: 'template-journal-accrual',
    tenantId: 'default',
    category: 'JOURNAL_ENTRY',
    name: 'Periodisering',
    description: 'Mall för periodiseringsbokningar',
    content: {
      entryType: 'ACCRUAL',
      reversalDate: 'next_period_start',
      autoReverse: true,
    },
    variables: [
      {
        name: 'amount',
        label: 'Belopp',
        type: 'number',
        required: true,
        validation: { min: 0 },
      },
      {
        name: 'debitAccount',
        label: 'Debetkonto',
        type: 'account',
        required: true,
      },
      {
        name: 'creditAccount',
        label: 'Kreditkonto',
        type: 'account',
        required: true,
      },
      {
        name: 'startDate',
        label: 'Startdatum',
        type: 'date',
        required: true,
      },
      {
        name: 'endDate',
        label: 'Slutdatum',
        type: 'date',
        required: true,
      },
      {
        name: 'description',
        label: 'Beskrivning',
        type: 'text',
        required: true,
      },
    ],
    tags: ['verifikat', 'periodisering', 'bokslut'],
    isDefault: true,
    isPublic: true,
    usageCount: 0,
    createdBy: 'system',
  },
];

const DEFAULT_COMMENTS: Omit<StandardComment, 'createdAt'>[] = [
  {
    id: 'comment-approved',
    tenantId: 'default',
    category: 'approval',
    text: 'Godkänt utan anmärkning',
    shortcut: '/ok',
    showFor: { actions: ['APPROVE'] },
    usageCount: 0,
    createdBy: 'system',
  },
  {
    id: 'comment-approved-note',
    tenantId: 'default',
    category: 'approval',
    text: 'Godkänt med mindre avvikelser - se bifogad kommentar',
    shortcut: '/okm',
    showFor: { actions: ['APPROVE'] },
    usageCount: 0,
    createdBy: 'system',
  },
  {
    id: 'comment-rejected-info',
    tenantId: 'default',
    category: 'rejection',
    text: 'Avvisas - behöver kompletterande information',
    shortcut: '/info',
    showFor: { actions: ['REJECT'] },
    usageCount: 0,
    createdBy: 'system',
  },
  {
    id: 'comment-rejected-amount',
    tenantId: 'default',
    category: 'rejection',
    text: 'Avvisas - belopp stämmer inte med underlag',
    shortcut: '/belopp',
    showFor: { actions: ['REJECT'] },
    usageCount: 0,
    createdBy: 'system',
  },
  {
    id: 'comment-rejected-duplicate',
    tenantId: 'default',
    category: 'rejection',
    text: 'Avvisas - dubblettfaktura redan bokförd',
    shortcut: '/dup',
    showFor: { actions: ['REJECT'] },
    usageCount: 0,
    createdBy: 'system',
  },
  {
    id: 'comment-question',
    tenantId: 'default',
    category: 'question',
    text: 'Vänligen förtydliga kostnadsställe för denna transaktion',
    shortcut: '/ks',
    showFor: { statuses: ['pending'] },
    usageCount: 0,
    createdBy: 'system',
  },
  {
    id: 'comment-verification',
    tenantId: 'default',
    category: 'verification',
    text: 'Verifierat mot kontoutdrag',
    shortcut: '/ver',
    usageCount: 0,
    createdBy: 'system',
  },
  {
    id: 'comment-reconciled',
    tenantId: 'default',
    category: 'reconciliation',
    text: 'Avstämd - inga avvikelser',
    shortcut: '/avstämd',
    usageCount: 0,
    createdBy: 'system',
  },
];

// ============================================================================
// Service
// ============================================================================

export const bulkOperationsService = {
  // ========== Bulk Operations ==========

  async createBulkOperation(params: {
    tenantId: string;
    companyId: string;
    type: BulkActionType;
    name: string;
    description?: string;
    targetType: BulkOperation['targetType'];
    targetIds: string[];
    action: Record<string, unknown>;
    createdBy: string;
    createdByName: string;
    scheduledFor?: string;
    requiresApproval?: boolean;
  }): Promise<BulkOperation> {
    const operationId = `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Determine if approval is required based on operation type and count
    const needsApproval = params.requiresApproval ?? this.shouldRequireApproval(params.type, params.targetIds.length);

    const operation: BulkOperation = {
      id: operationId,
      tenantId: params.tenantId,
      companyId: params.companyId,
      type: params.type,
      name: params.name,
      description: params.description,
      targetType: params.targetType,
      targetIds: params.targetIds,
      targetCount: params.targetIds.length,
      action: params.action,
      status: needsApproval ? 'PENDING_APPROVAL' : (params.scheduledFor ? 'PENDING' : 'PENDING'),
      progress: 0,
      results: {
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: [],
      },
      requiresApproval: needsApproval,
      createdBy: params.createdBy,
      createdByName: params.createdByName,
      createdAt: now,
      scheduledFor: params.scheduledFor,
      isRecurring: false,
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${params.tenantId}`,
        sk: `BULK#${operationId}`,
        gsi1pk: `COMPANY#${params.companyId}`,
        gsi1sk: `BULK#${operation.status}#${now}`,
        ...operation,
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days
      },
    }));

    console.log(`[BulkOperations] Created bulk operation ${operationId} for ${params.targetIds.length} items`);

    return operation;
  },

  shouldRequireApproval(type: BulkActionType, count: number): boolean {
    // High-risk operations always need approval
    const highRiskTypes: BulkActionType[] = [
      'DELETE_DOCUMENTS',
      'SYNC_TO_FORTNOX',
      'UPDATE_ACCOUNTS',
    ];

    if (highRiskTypes.includes(type)) return true;

    // Large batches need approval
    if (count > 50) return true;

    // Approval/rejection bulk operations over 10 items
    if ((type === 'APPROVE_DOCUMENTS' || type === 'REJECT_DOCUMENTS') && count > 10) return true;

    return false;
  },

  async executeBulkOperation(operation: BulkOperation): Promise<BulkOperation> {
    const now = new Date().toISOString();
    operation.status = 'RUNNING';
    operation.startedAt = now;

    // Update status
    await this.updateOperation(operation);

    const batchSize = 25; // DynamoDB batch limit
    let processed = 0;

    try {
      for (let i = 0; i < operation.targetIds.length; i += batchSize) {
        const batch = operation.targetIds.slice(i, i + batchSize);
        
        for (const targetId of batch) {
          try {
            await this.executeActionOnTarget(operation.type, targetId, operation.action, operation);
            operation.results.successful++;
          } catch (error) {
            operation.results.failed++;
            operation.results.errors.push({
              targetId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
          
          processed++;
          operation.progress = Math.round((processed / operation.targetCount) * 100);
        }

        // Update progress
        await this.updateOperation(operation);
      }

      operation.status = operation.results.failed > 0 ? 'COMPLETED' : 'COMPLETED';
      operation.completedAt = new Date().toISOString();
    } catch (error) {
      operation.status = 'FAILED';
      operation.completedAt = new Date().toISOString();
    }

    await this.updateOperation(operation);

    // Send notification
    await sendNotification({
      companyId: operation.companyId,
      type: 'batch_complete',
      priority: operation.results.failed > 0 ? 'high' : 'normal',
      title: `Bulk-operation "${operation.name}" klar`,
      message: `${operation.results.successful} lyckades, ${operation.results.failed} misslyckades av ${operation.targetCount} objekt.`,
      channels: ['in_app'],
      actionUrl: `/admin/bulk-operations/${operation.id}`,
      actionLabel: 'Visa resultat',
    });

    return operation;
  },

  async executeActionOnTarget(
    type: BulkActionType,
    targetId: string,
    action: Record<string, unknown>,
    operation: BulkOperation
  ): Promise<void> {
    // In production, this would call the appropriate service for each action type
    console.log(`[BulkOperations] Executing ${type} on ${targetId}`, action);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 50));

    // Would implement actual logic here based on type
    switch (type) {
      case 'APPROVE_DOCUMENTS':
        // Call accounting service to approve
        break;
      case 'REJECT_DOCUMENTS':
        // Call accounting service to reject
        break;
      case 'SYNC_TO_FORTNOX':
        // Call Fortnox integration
        break;
      case 'UPDATE_ACCOUNTS':
        // Update account mappings
        break;
      case 'ADD_TAG':
        // Add tag to document
        break;
      case 'REMOVE_TAG':
        // Remove tag from document
        break;
      case 'ASSIGN_USER':
        // Assign user to document
        break;
      case 'ARCHIVE_DOCUMENTS':
        // Archive document
        break;
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  },

  async updateOperation(operation: BulkOperation): Promise<void> {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${operation.tenantId}`,
        sk: `BULK#${operation.id}`,
        gsi1pk: `COMPANY#${operation.companyId}`,
        gsi1sk: `BULK#${operation.status}#${operation.createdAt}`,
        ...operation,
      },
    }));
  },

  async getOperation(tenantId: string, operationId: string): Promise<BulkOperation | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `TENANT#${tenantId}`,
          sk: `BULK#${operationId}`,
        },
      }));

      return result.Item as BulkOperation | null;
    } catch (error) {
      console.error('[BulkOperations] Error getting operation:', error);
      return null;
    }
  },

  async getOperations(params: {
    tenantId: string;
    companyId?: string;
    status?: BulkOperation['status'];
    limit?: number;
  }): Promise<BulkOperation[]> {
    let queryParams: Record<string, unknown>;

    if (params.companyId) {
      queryParams = {
        TableName: TABLE_NAME,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :pk AND begins_with(gsi1sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `COMPANY#${params.companyId}`,
          ':sk': params.status ? `BULK#${params.status}#` : 'BULK#',
        },
        ScanIndexForward: false,
        Limit: params.limit || 50,
      };
    } else {
      queryParams = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${params.tenantId}`,
          ':sk': 'BULK#',
        },
        ScanIndexForward: false,
        Limit: params.limit || 50,
      };

      if (params.status) {
        queryParams.FilterExpression = '#status = :status';
        queryParams.ExpressionAttributeNames = { '#status': 'status' };
        (queryParams.ExpressionAttributeValues as Record<string, string>)[':status'] = params.status;
      }
    }

    try {
      const result = await docClient.send(new QueryCommand(queryParams as any));
      return (result.Items || []) as BulkOperation[];
    } catch (error) {
      console.error('[BulkOperations] Error getting operations:', error);
      return [];
    }
  },

  // ========== Templates ==========

  async getTemplates(params: {
    tenantId: string;
    companyId?: string;
    category?: TemplateCategory;
  }): Promise<Template[]> {
    const defaults = DEFAULT_TEMPLATES.map(t => ({
      ...t,
      tenantId: params.tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    try {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${params.tenantId}`,
          ':sk': 'TEMPLATE#',
        },
      }));

      const customTemplates = (result.Items || []) as Template[];

      // Merge defaults with custom
      const allTemplates = [...defaults, ...customTemplates];

      // Filter
      let filtered = allTemplates;
      if (params.category) {
        filtered = filtered.filter(t => t.category === params.category);
      }
      if (params.companyId) {
        filtered = filtered.filter(t => !t.companyId || t.companyId === params.companyId || t.isPublic);
      }

      return filtered;
    } catch (error) {
      console.error('[BulkOperations] Error getting templates:', error);
      return defaults.filter(t => !params.category || t.category === params.category);
    }
  },

  async getTemplate(tenantId: string, templateId: string): Promise<Template | null> {
    // Check defaults first
    const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.id === templateId);
    if (defaultTemplate) {
      return {
        ...defaultTemplate,
        tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `TENANT#${tenantId}`,
          sk: `TEMPLATE#${templateId}`,
        },
      }));

      return result.Item as Template | null;
    } catch (error) {
      console.error('[BulkOperations] Error getting template:', error);
      return null;
    }
  },

  async saveTemplate(template: Omit<Template, 'createdAt' | 'updatedAt'>): Promise<Template> {
    const now = new Date().toISOString();
    const fullTemplate: Template = {
      ...template,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${template.tenantId}`,
        sk: `TEMPLATE#${template.id}`,
        gsi1pk: `TEMPLATE_CAT#${template.category}`,
        gsi1sk: template.name,
        ...fullTemplate,
      },
    }));

    return fullTemplate;
  },

  async applyTemplate(
    tenantId: string,
    templateId: string,
    variables: Record<string, unknown>,
    targetIds: string[]
  ): Promise<BulkOperation> {
    const template = await this.getTemplate(tenantId, templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Merge template content with variables
    const mergedContent = { ...template.content };
    for (const variable of template.variables) {
      if (variables[variable.name] !== undefined) {
        mergedContent[variable.name] = variables[variable.name];
      } else if (variable.defaultValue !== undefined) {
        mergedContent[variable.name] = variable.defaultValue;
      } else if (variable.required) {
        throw new Error(`Required variable ${variable.name} not provided`);
      }
    }

    // Update template usage
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `TENANT#${tenantId}`,
        sk: `TEMPLATE#${templateId}`,
      },
      UpdateExpression: 'SET usageCount = usageCount + :one, lastUsedAt = :now',
      ExpressionAttributeValues: {
        ':one': 1,
        ':now': new Date().toISOString(),
      },
    })).catch(() => {/* Default template */});

    // Create bulk operation to apply template
    return this.createBulkOperation({
      tenantId,
      companyId: template.companyId || '',
      type: 'APPLY_TEMPLATE',
      name: `Applicera mall: ${template.name}`,
      description: `Applicerar mall "${template.name}" på ${targetIds.length} objekt`,
      targetType: 'document',
      targetIds,
      action: mergedContent,
      createdBy: 'system',
      createdByName: 'System',
    });
  },

  // ========== Standard Comments ==========

  async getStandardComments(params: {
    tenantId: string;
    companyId?: string;
    category?: string;
    action?: string;
  }): Promise<StandardComment[]> {
    const defaults = DEFAULT_COMMENTS.map(c => ({
      ...c,
      tenantId: params.tenantId,
      createdAt: new Date().toISOString(),
    }));

    try {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${params.tenantId}`,
          ':sk': 'COMMENT#',
        },
      }));

      const customComments = (result.Items || []) as StandardComment[];
      const allComments = [...defaults, ...customComments];

      // Filter
      let filtered = allComments;
      if (params.category) {
        filtered = filtered.filter(c => c.category === params.category);
      }
      if (params.action) {
        filtered = filtered.filter(c => 
          !c.showFor?.actions || c.showFor.actions.includes(params.action!)
        );
      }
      if (params.companyId) {
        filtered = filtered.filter(c => !c.companyId || c.companyId === params.companyId);
      }

      return filtered;
    } catch (error) {
      console.error('[BulkOperations] Error getting comments:', error);
      return defaults;
    }
  },

  async useComment(tenantId: string, commentId: string): Promise<void> {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `TENANT#${tenantId}`,
        sk: `COMMENT#${commentId}`,
      },
      UpdateExpression: 'SET usageCount = usageCount + :one',
      ExpressionAttributeValues: {
        ':one': 1,
      },
    })).catch(() => {/* Default comment */});
  },

  // ========== Recurring Jobs ==========

  async createRecurringJob(params: {
    tenantId: string;
    companyId: string;
    name: string;
    description: string;
    actionType: BulkActionType;
    action: Record<string, unknown>;
    selectionCriteria: RecurringJob['selectionCriteria'];
    schedule: RecurringJob['schedule'];
    notifyOnComplete: boolean;
    notifyOnFailure: boolean;
    notifyRecipients: string[];
    createdBy: string;
  }): Promise<RecurringJob> {
    const jobId = `recurring-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const nextRun = this.calculateNextRun(params.schedule);

    const job: RecurringJob = {
      id: jobId,
      tenantId: params.tenantId,
      companyId: params.companyId,
      name: params.name,
      description: params.description,
      actionType: params.actionType,
      action: params.action,
      selectionCriteria: params.selectionCriteria,
      schedule: params.schedule,
      enabled: true,
      nextRunAt: nextRun.toISOString(),
      notifyOnComplete: params.notifyOnComplete,
      notifyOnFailure: params.notifyOnFailure,
      notifyRecipients: params.notifyRecipients,
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${params.tenantId}`,
        sk: `RECURRING#${jobId}`,
        gsi1pk: `COMPANY#${params.companyId}`,
        gsi1sk: `RECURRING#${job.enabled}#${job.nextRunAt}`,
        ...job,
      },
    }));

    console.log(`[BulkOperations] Created recurring job ${jobId}`);

    return job;
  },

  calculateNextRun(schedule: RecurringJob['schedule']): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);

    let next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    // If time has passed today, start from tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    switch (schedule.type) {
      case 'daily':
        // Already set
        break;
      case 'weekly':
        const dayDiff = (schedule.dayOfWeek! - next.getDay() + 7) % 7;
        next.setDate(next.getDate() + (dayDiff === 0 && next <= now ? 7 : dayDiff));
        break;
      case 'monthly':
        next.setDate(schedule.dayOfMonth!);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        break;
      case 'quarterly':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        next.setMonth((currentQuarter + 1) * 3 + (schedule.monthOfYear! % 3));
        next.setDate(schedule.dayOfMonth!);
        if (next <= now) {
          next.setMonth(next.getMonth() + 3);
        }
        break;
      case 'yearly':
        next.setMonth(schedule.monthOfYear!);
        next.setDate(schedule.dayOfMonth!);
        if (next <= now) {
          next.setFullYear(next.getFullYear() + 1);
        }
        break;
    }

    return next;
  },

  async getRecurringJobs(params: {
    tenantId: string;
    companyId?: string;
    enabled?: boolean;
  }): Promise<RecurringJob[]> {
    let queryParams: Record<string, unknown>;

    if (params.companyId) {
      queryParams = {
        TableName: TABLE_NAME,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :pk AND begins_with(gsi1sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `COMPANY#${params.companyId}`,
          ':sk': params.enabled !== undefined ? `RECURRING#${params.enabled}#` : 'RECURRING#',
        },
      };
    } else {
      queryParams = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${params.tenantId}`,
          ':sk': 'RECURRING#',
        },
      };

      if (params.enabled !== undefined) {
        queryParams.FilterExpression = 'enabled = :enabled';
        (queryParams.ExpressionAttributeValues as Record<string, boolean>)[':enabled'] = params.enabled;
      }
    }

    try {
      const result = await docClient.send(new QueryCommand(queryParams as any));
      return (result.Items || []) as RecurringJob[];
    } catch (error) {
      console.error('[BulkOperations] Error getting recurring jobs:', error);
      return [];
    }
  },

  async executeRecurringJob(job: RecurringJob): Promise<BulkOperation> {
    // Get targets based on selection criteria
    let targetIds: string[] = [];

    if (job.selectionCriteria.type === 'fixed') {
      targetIds = job.selectionCriteria.fixedIds || [];
    } else {
      // In production, would execute query to get matching items
      console.log('[BulkOperations] Would execute query:', job.selectionCriteria.query);
      targetIds = []; // Placeholder
    }

    // Create and execute bulk operation
    const operation = await this.createBulkOperation({
      tenantId: job.tenantId,
      companyId: job.companyId,
      type: job.actionType,
      name: `${job.name} (automatisk)`,
      description: job.description,
      targetType: 'document',
      targetIds,
      action: job.action,
      createdBy: 'system',
      createdByName: 'Schemalagt jobb',
      requiresApproval: false,
    });

    // Update job status
    const now = new Date().toISOString();
    job.lastRunAt = now;
    job.nextRunAt = this.calculateNextRun(job.schedule).toISOString();
    job.updatedAt = now;

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${job.tenantId}`,
        sk: `RECURRING#${job.id}`,
        gsi1pk: `COMPANY#${job.companyId}`,
        gsi1sk: `RECURRING#${job.enabled}#${job.nextRunAt}`,
        ...job,
      },
    }));

    // Execute immediately
    return this.executeBulkOperation(operation);
  },
};

export default bulkOperationsService;


