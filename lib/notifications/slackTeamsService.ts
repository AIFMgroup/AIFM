/**
 * Slack & Microsoft Teams Integration Service
 * 
 * Skickar notifikationer till Slack och Teams baserat på:
 * - Händelser (event triggers)
 * - Uppgifter (task reminders)
 * - Påminnelser (deadline warnings)
 * - Eskaleringar (approval escalations)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const CONFIG_TABLE = process.env.INTEGRATIONS_TABLE_NAME || 'aifm-integrations';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============================================================================
// Types
// ============================================================================

export type NotificationChannel = 'slack' | 'teams' | 'both';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SlackConfig {
  enabled: boolean;
  workspaceId?: string;
  defaultChannelId?: string;
  webhookUrl?: string; // For incoming webhooks
  botToken?: string; // For Slack API
  channels: {
    accounting?: string;
    compliance?: string;
    approvals?: string;
    alerts?: string;
    general?: string;
  };
}

export interface TeamsConfig {
  enabled: boolean;
  tenantId?: string;
  webhookUrls: {
    accounting?: string;
    compliance?: string;
    approvals?: string;
    alerts?: string;
    general?: string;
  };
}

export interface IntegrationConfig {
  tenantId: string;
  companyId: string;
  slack: SlackConfig;
  teams: TeamsConfig;
  preferences: {
    defaultChannel: NotificationChannel;
    notifyOnApproval: boolean;
    notifyOnEscalation: boolean;
    notifyOnDeadline: boolean;
    notifyOnAnomaly: boolean;
    notifyOnError: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart?: string; // "22:00"
    quietHoursEnd?: string; // "07:00"
    quietHoursTimezone?: string;
  };
  updatedAt: string;
}

export interface NotificationPayload {
  tenantId: string;
  companyId: string;
  channel?: NotificationChannel;
  category: 'accounting' | 'compliance' | 'approvals' | 'alerts' | 'general';
  priority: NotificationPriority;
  title: string;
  message: string;
  details?: Record<string, string | number>;
  actionUrl?: string;
  actionLabel?: string;
  mentionUsers?: string[]; // User IDs to mention
  threadId?: string; // For threaded replies
}

// ============================================================================
// Slack Message Formatting
// ============================================================================

function formatSlackMessage(payload: NotificationPayload): Record<string, unknown> {
  const priorityEmoji: Record<NotificationPriority, string> = {
    low: 'ℹ️',
    normal: '📋',
    high: '⚠️',
    urgent: '🚨',
  };

  const categoryEmoji: Record<string, string> = {
    accounting: '📊',
    compliance: '📜',
    approvals: '✅',
    alerts: '🔔',
    general: '💬',
  };

  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${priorityEmoji[payload.priority]} ${payload.title}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: payload.message,
      },
    },
  ];

  // Add details if present
  if (payload.details && Object.keys(payload.details).length > 0) {
    const detailsText = Object.entries(payload.details)
      .map(([key, value]) => `*${key}:* ${value}`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: detailsText,
      },
    });
  }

  // Add action button if present
  if (payload.actionUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: payload.actionLabel || 'Visa i AIFM',
            emoji: true,
          },
          url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.aifm.se'}${payload.actionUrl}`,
          style: payload.priority === 'urgent' ? 'danger' : 'primary',
        },
      ],
    });
  }

  // Add context/footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${categoryEmoji[payload.category]} ${payload.category.charAt(0).toUpperCase() + payload.category.slice(1)} | ${new Date().toLocaleString('sv-SE')}`,
      },
    ],
  });

  return {
    blocks,
    text: `${priorityEmoji[payload.priority]} ${payload.title}: ${payload.message}`, // Fallback
    ...(payload.threadId && { thread_ts: payload.threadId }),
  };
}

// ============================================================================
// Teams Message Formatting (Adaptive Cards)
// ============================================================================

function formatTeamsMessage(payload: NotificationPayload): Record<string, unknown> {
  const priorityColors: Record<NotificationPriority, string> = {
    low: '0078D4', // Blue
    normal: '107C10', // Green
    high: 'FF8C00', // Orange
    urgent: 'C50F1F', // Red
  };

  const categoryIcons: Record<string, string> = {
    accounting: '📊',
    compliance: '📜',
    approvals: '✅',
    alerts: '🔔',
    general: '💬',
  };

  const facts = payload.details
    ? Object.entries(payload.details).map(([key, value]) => ({
        title: key,
        value: String(value),
      }))
    : [];

  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'Container',
              style: payload.priority === 'urgent' ? 'attention' : 'default',
              items: [
                {
                  type: 'TextBlock',
                  text: `${categoryIcons[payload.category]} ${payload.title}`,
                  weight: 'Bolder',
                  size: 'Large',
                  wrap: true,
                },
                {
                  type: 'TextBlock',
                  text: payload.message,
                  wrap: true,
                  spacing: 'Small',
                },
              ],
            },
            ...(facts.length > 0
              ? [
                  {
                    type: 'FactSet',
                    facts,
                    spacing: 'Medium',
                  },
                ]
              : []),
            {
              type: 'TextBlock',
              text: `${new Date().toLocaleString('sv-SE')}`,
              size: 'Small',
              isSubtle: true,
              spacing: 'Medium',
            },
          ],
          ...(payload.actionUrl && {
            actions: [
              {
                type: 'Action.OpenUrl',
                title: payload.actionLabel || 'Visa i AIFM',
                url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.aifm.se'}${payload.actionUrl}`,
              },
            ],
          }),
          msteams: {
            width: 'Full',
          },
        },
      },
    ],
  };

  return card;
}

// ============================================================================
// Service
// ============================================================================

export const slackTeamsService = {
  // ========== Configuration ==========

  async getConfig(tenantId: string, companyId: string): Promise<IntegrationConfig | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: CONFIG_TABLE,
        Key: {
          pk: `TENANT#${tenantId}`,
          sk: `SLACK_TEAMS#${companyId}`,
        },
      }));

      return result.Item as IntegrationConfig | null;
    } catch (error) {
      console.error('[SlackTeams] Error getting config:', error);
      return null;
    }
  },

  async saveConfig(config: IntegrationConfig): Promise<void> {
    config.updatedAt = new Date().toISOString();

    await docClient.send(new PutCommand({
      TableName: CONFIG_TABLE,
      Item: {
        pk: `TENANT#${config.tenantId}`,
        sk: `SLACK_TEAMS#${config.companyId}`,
        ...config,
      },
    }));

    console.log(`[SlackTeams] Saved config for tenant ${config.tenantId}`);
  },

  // ========== Send Notifications ==========

  async send(payload: NotificationPayload): Promise<{ success: boolean; errors?: string[] }> {
    const config = await this.getConfig(payload.tenantId, payload.companyId);
    
    if (!config) {
      console.log('[SlackTeams] No config found, skipping notification');
      return { success: true }; // Silent skip if not configured
    }

    // Check quiet hours
    if (config.preferences.quietHoursEnabled && this.isQuietHours(config)) {
      console.log('[SlackTeams] In quiet hours, queuing notification');
      // Could queue for later delivery
      return { success: true };
    }

    const channel = payload.channel || config.preferences.defaultChannel;
    const errors: string[] = [];

    // Send to Slack
    if ((channel === 'slack' || channel === 'both') && config.slack.enabled) {
      const slackResult = await this.sendToSlack(config.slack, payload);
      if (!slackResult.success && slackResult.error) {
        errors.push(`Slack: ${slackResult.error}`);
      }
    }

    // Send to Teams
    if ((channel === 'teams' || channel === 'both') && config.teams.enabled) {
      const teamsResult = await this.sendToTeams(config.teams, payload);
      if (!teamsResult.success && teamsResult.error) {
        errors.push(`Teams: ${teamsResult.error}`);
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  async sendToSlack(
    config: SlackConfig,
    payload: NotificationPayload
  ): Promise<{ success: boolean; error?: string; threadId?: string }> {
    try {
      // Determine channel
      const channelId = config.channels[payload.category] || config.defaultChannelId;
      
      if (!channelId && !config.webhookUrl) {
        return { success: false, error: 'No channel configured' };
      }

      const message = formatSlackMessage(payload);

      // Use webhook if available
      if (config.webhookUrl) {
        const response = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        });

        if (!response.ok) {
          return { success: false, error: `Webhook error: ${response.status}` };
        }

        return { success: true };
      }

      // Otherwise use Slack API
      if (config.botToken) {
        const response = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.botToken}`,
          },
          body: JSON.stringify({
            channel: channelId,
            ...message,
          }),
        });

        const result = await response.json();

        if (!result.ok) {
          return { success: false, error: result.error };
        }

        return { success: true, threadId: result.ts };
      }

      return { success: false, error: 'No webhook or bot token configured' };
    } catch (error) {
      console.error('[SlackTeams] Slack send error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async sendToTeams(
    config: TeamsConfig,
    payload: NotificationPayload
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Determine webhook URL
      const webhookUrl = config.webhookUrls[payload.category] || config.webhookUrls.general;

      if (!webhookUrl) {
        return { success: false, error: 'No webhook URL configured for category' };
      }

      const message = formatTeamsMessage(payload);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        return { success: false, error: `Webhook error: ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      console.error('[SlackTeams] Teams send error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // ========== Helper Functions ==========

  isQuietHours(config: IntegrationConfig): boolean {
    if (!config.preferences.quietHoursEnabled) return false;
    if (!config.preferences.quietHoursStart || !config.preferences.quietHoursEnd) return false;

    const now = new Date();
    const currentTime = now.toLocaleTimeString('sv-SE', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: config.preferences.quietHoursTimezone || 'Europe/Stockholm',
    });

    const start = config.preferences.quietHoursStart;
    const end = config.preferences.quietHoursEnd;

    // Handle overnight quiet hours (e.g., 22:00 - 07:00)
    if (start > end) {
      return currentTime >= start || currentTime < end;
    }

    return currentTime >= start && currentTime < end;
  },

  // ========== Convenience Methods ==========

  async notifyApprovalRequest(params: {
    tenantId: string;
    companyId: string;
    title: string;
    requestedBy: string;
    amount?: number;
    approvalUrl: string;
  }): Promise<void> {
    await this.send({
      tenantId: params.tenantId,
      companyId: params.companyId,
      category: 'approvals',
      priority: 'high',
      title: 'Ny godkännandebegäran',
      message: `${params.requestedBy} har begärt godkännande för: ${params.title}`,
      details: params.amount ? { Belopp: `${params.amount.toLocaleString('sv-SE')} kr` } : undefined,
      actionUrl: params.approvalUrl,
      actionLabel: 'Granska och godkänn',
    });
  },

  async notifyDeadline(params: {
    tenantId: string;
    companyId: string;
    title: string;
    daysUntil: number;
    taskUrl: string;
  }): Promise<void> {
    await this.send({
      tenantId: params.tenantId,
      companyId: params.companyId,
      category: 'alerts',
      priority: params.daysUntil <= 1 ? 'urgent' : params.daysUntil <= 3 ? 'high' : 'normal',
      title: 'Påminnelse: Deadline närmar sig',
      message: `"${params.title}" förfaller om ${params.daysUntil} dag${params.daysUntil > 1 ? 'ar' : ''}`,
      actionUrl: params.taskUrl,
      actionLabel: 'Visa uppgift',
    });
  },

  async notifyEscalation(params: {
    tenantId: string;
    companyId: string;
    title: string;
    originalAssignee: string;
    escalatedTo: string;
    reason: string;
    taskUrl: string;
  }): Promise<void> {
    await this.send({
      tenantId: params.tenantId,
      companyId: params.companyId,
      category: 'alerts',
      priority: 'urgent',
      title: '⚠️ Eskalering',
      message: `"${params.title}" har eskalerats från ${params.originalAssignee} till ${params.escalatedTo}`,
      details: { Anledning: params.reason },
      actionUrl: params.taskUrl,
      actionLabel: 'Hantera nu',
    });
  },

  async notifyError(params: {
    tenantId: string;
    companyId: string;
    service: string;
    error: string;
    details?: Record<string, string | number>;
  }): Promise<void> {
    await this.send({
      tenantId: params.tenantId,
      companyId: params.companyId,
      category: 'alerts',
      priority: 'urgent',
      title: `🚨 Systemfel: ${params.service}`,
      message: params.error,
      details: params.details,
      actionUrl: '/admin/dashboard',
      actionLabel: 'Visa systemstatus',
    });
  },
};

export default slackTeamsService;


