/**
 * Notification Service
 * 
 * Hanterar smarta notifikationer för bokföring:
 * - Fakturor som snart förfaller
 * - Dokument som väntar på godkännande
 * - Synkroniseringsfel
 * - Anomalier/varningar
 * - Påminnelser om periodbokslut
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { jobStore, AccountingJob } from '../jobStore';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';
const SES_REGION = 'eu-west-1'; // SES ofta i annan region

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export type NotificationType = 
  | 'invoice_due_soon'        // Faktura förfaller snart (3 dagar)
  | 'invoice_overdue'         // Faktura förfallen
  | 'pending_approval'        // Väntar på godkännande > 24h
  | 'sync_failed'             // Fortnox-synk misslyckades
  | 'anomaly_detected'        // Anomali upptäckt
  | 'period_closing_reminder' // Påminnelse om periodbokslut
  | 'vat_report_due'          // Momsdeklaration ska in
  | 'batch_complete'          // Batch-uppladdning klar
  | 'high_amount_alert'       // Högt belopp behöver godkännas
  | 'new_supplier_alert';     // Ny leverantör behöver verifieras

export type NotificationChannel = 'in_app' | 'email' | 'push';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  companyId: string;
  userId?: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  createdAt: string;
  readAt?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface NotificationPreferences {
  companyId: string;
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  
  // Per-type preferences
  typePreferences: Partial<Record<NotificationType, {
    enabled: boolean;
    channels: NotificationChannel[];
    minPriority: NotificationPriority;
  }>>;
  
  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string;   // "07:00"
  
  // Digest
  dailyDigestEnabled: boolean;
  dailyDigestTime: string; // "08:00"
}

// Default notifikationsinställningar
const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'companyId' | 'userId'> = {
  emailEnabled: true,
  pushEnabled: false,
  inAppEnabled: true,
  typePreferences: {
    invoice_overdue: { enabled: true, channels: ['in_app', 'email'], minPriority: 'normal' },
    invoice_due_soon: { enabled: true, channels: ['in_app'], minPriority: 'normal' },
    pending_approval: { enabled: true, channels: ['in_app'], minPriority: 'normal' },
    sync_failed: { enabled: true, channels: ['in_app', 'email'], minPriority: 'high' },
    anomaly_detected: { enabled: true, channels: ['in_app'], minPriority: 'normal' },
    period_closing_reminder: { enabled: true, channels: ['in_app', 'email'], minPriority: 'normal' },
    high_amount_alert: { enabled: true, channels: ['in_app', 'email'], minPriority: 'high' },
    new_supplier_alert: { enabled: true, channels: ['in_app'], minPriority: 'normal' },
  },
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  dailyDigestEnabled: true,
  dailyDigestTime: '08:00',
};

/**
 * Skapa och skicka en notifikation
 */
export async function sendNotification(
  notification: Omit<Notification, 'id' | 'createdAt'>
): Promise<Notification> {
  const now = new Date().toISOString();
  const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const fullNotification: Notification = {
    ...notification,
    id,
    createdAt: now,
  };

  // Spara till DynamoDB
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `NOTIFICATIONS#${notification.companyId}`,
        sk: `${now}#${id}`,
        gsi1pk: notification.userId ? `USER_NOTIFICATIONS#${notification.userId}` : undefined,
        gsi1sk: now,
        ...fullNotification,
        // TTL - ta bort efter 30 dagar
        ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      },
    }));
  } catch (error) {
    console.error('[NotificationService] Failed to save notification:', error);
  }

  // Skicka via aktiverade kanaler
  if (notification.channels.includes('email')) {
    await sendEmailNotification(fullNotification).catch(err => {
      console.error('[NotificationService] Email send failed:', err);
    });
  }

  // TODO: Implementera push notifications
  // if (notification.channels.includes('push')) { ... }

  console.log(`[NotificationService] Sent ${notification.type} notification: ${notification.title}`);
  return fullNotification;
}

/**
 * Hämta olästa notifikationer för ett bolag
 */
export async function getUnreadNotifications(
  companyId: string,
  limit: number = 20
): Promise<Notification[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'attribute_not_exists(readAt)',
      ExpressionAttributeValues: {
        ':pk': `NOTIFICATIONS#${companyId}`,
      },
      Limit: limit,
      ScanIndexForward: false, // Nyaste först
    }));

    return (result.Items || []) as Notification[];
  } catch (error) {
    console.error('[NotificationService] Failed to get notifications:', error);
    return [];
  }
}

/**
 * Markera notifikation som läst
 */
export async function markAsRead(
  companyId: string,
  notificationId: string
): Promise<void> {
  try {
    // Hitta notifikationen först
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':pk': `NOTIFICATIONS#${companyId}`,
        ':id': notificationId,
      },
      Limit: 1,
    }));

    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0];
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: item.pk, sk: item.sk },
        UpdateExpression: 'SET readAt = :readAt',
        ExpressionAttributeValues: {
          ':readAt': new Date().toISOString(),
        },
      }));
    }
  } catch (error) {
    console.error('[NotificationService] Failed to mark as read:', error);
  }
}

/**
 * Kör schemalagda notifikationskontroller
 */
export async function runScheduledNotificationChecks(companyId: string): Promise<void> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // 1. Kontrollera förfallodatum
  await checkDueDates(companyId);

  // 2. Kontrollera väntande godkännanden
  await checkPendingApprovals(companyId);

  // 3. Kontrollera periodstängning
  await checkPeriodClosingReminders(companyId);

  // 4. Kontrollera momsdeklaration
  await checkVatReportReminders(companyId);
}

// ============ Specifika notifikationskontroller ============

async function checkDueDates(companyId: string): Promise<void> {
  try {
    const jobs = await jobStore.getByCompany(companyId);
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    for (const job of jobs) {
      if (job.status !== 'approved' || !job.classification?.dueDate) continue;

      const dueDate = new Date(job.classification.dueDate);
      
      // Förfallen?
      if (dueDate < now) {
        await sendNotification({
          companyId,
          type: 'invoice_overdue',
          priority: 'high',
          title: 'Faktura förfallen',
          message: `Faktura från ${job.classification.supplier} på ${job.classification.totalAmount.toLocaleString('sv-SE')} kr förföll ${job.classification.dueDate}`,
          data: { jobId: job.id, supplier: job.classification.supplier, amount: job.classification.totalAmount },
          channels: ['in_app', 'email'],
          actionUrl: `/accounting/bookkeeping?job=${job.id}`,
          actionLabel: 'Visa faktura',
        });
      }
      // Förfaller inom 3 dagar?
      else if (dueDate <= threeDaysFromNow) {
        const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        await sendNotification({
          companyId,
          type: 'invoice_due_soon',
          priority: 'normal',
          title: 'Faktura förfaller snart',
          message: `Faktura från ${job.classification.supplier} på ${job.classification.totalAmount.toLocaleString('sv-SE')} kr förfaller om ${daysLeft} dag${daysLeft > 1 ? 'ar' : ''}`,
          data: { jobId: job.id, daysLeft },
          channels: ['in_app'],
          actionUrl: `/accounting/payments`,
          actionLabel: 'Gå till betalningar',
        });
      }
    }
  } catch (error) {
    console.error('[NotificationService] checkDueDates error:', error);
  }
}

async function checkPendingApprovals(companyId: string): Promise<void> {
  try {
    const jobs = await jobStore.getByCompany(companyId);
    const now = new Date();
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const pendingJobs = jobs.filter(j => 
      j.status === 'ready' && 
      new Date(j.createdAt) < oneDayAgo
    );

    if (pendingJobs.length > 0) {
      const totalAmount = pendingJobs.reduce(
        (sum, j) => sum + (j.classification?.totalAmount || 0), 
        0
      );

      await sendNotification({
        companyId,
        type: 'pending_approval',
        priority: 'normal',
        title: `${pendingJobs.length} dokument väntar på godkännande`,
        message: `Du har ${pendingJobs.length} dokument (totalt ${totalAmount.toLocaleString('sv-SE')} kr) som väntat på godkännande i mer än 24 timmar`,
        data: { count: pendingJobs.length, totalAmount },
        channels: ['in_app'],
        actionUrl: '/accounting/bookkeeping?status=ready',
        actionLabel: 'Granska nu',
      });
    }
  } catch (error) {
    console.error('[NotificationService] checkPendingApprovals error:', error);
  }
}

async function checkPeriodClosingReminders(companyId: string): Promise<void> {
  const now = new Date();
  const dayOfMonth = now.getDate();
  
  // Påminn om periodstängning den 3:e varje månad
  if (dayOfMonth === 3) {
    const previousMonth = new Date(now);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const monthName = previousMonth.toLocaleString('sv-SE', { month: 'long' });

    await sendNotification({
      companyId,
      type: 'period_closing_reminder',
      priority: 'normal',
      title: 'Dags för periodbokslut',
      message: `Har du stängt bokföringen för ${monthName}? Det är dags att göra månadsbokslut.`,
      channels: ['in_app'],
      actionUrl: '/accounting/closing',
      actionLabel: 'Gå till bokslut',
    });
  }
}

async function checkVatReportReminders(companyId: string): Promise<void> {
  const now = new Date();
  const dayOfMonth = now.getDate();
  
  // Momsdeklaration ska in den 12:e varje månad (för månatlig moms)
  if (dayOfMonth >= 8 && dayOfMonth <= 12) {
    const daysUntilDeadline = 12 - dayOfMonth;
    
    await sendNotification({
      companyId,
      type: 'vat_report_due',
      priority: daysUntilDeadline <= 2 ? 'high' : 'normal',
      title: 'Momsdeklaration ska in',
      message: daysUntilDeadline === 0 
        ? 'Idag är sista dag att lämna momsdeklaration!'
        : `Momsdeklaration ska vara inne om ${daysUntilDeadline} dag${daysUntilDeadline > 1 ? 'ar' : ''}`,
      channels: daysUntilDeadline <= 2 ? ['in_app', 'email'] : ['in_app'],
      actionUrl: '/accounting/moms',
      actionLabel: 'Gå till momsrapport',
    });
  }
}

// ============ E-postutskick ============

async function sendEmailNotification(notification: Notification): Promise<void> {
  // Skippa om SES inte är konfigurerat
  if (!process.env.SES_FROM_EMAIL) {
    console.log('[NotificationService] SES not configured, skipping email');
    return;
  }

  const priorityColors: Record<NotificationPriority, string> = {
    low: '#6b7280',
    normal: '#3b82f6',
    high: '#f59e0b',
    urgent: '#ef4444',
  };

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: white; border-radius: 8px; padding: 24px; margin-top: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .header { border-bottom: 3px solid ${priorityColors[notification.priority]}; padding-bottom: 16px; margin-bottom: 16px; }
        .title { font-size: 18px; font-weight: 600; color: #111827; margin: 0; }
        .message { color: #4b5563; line-height: 1.6; }
        .button { display: inline-block; background: #c0a280; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-top: 16px; }
        .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1 class="title">${notification.title}</h1>
          </div>
          <p class="message">${notification.message}</p>
          ${notification.actionUrl ? `
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.aifm.se'}${notification.actionUrl}" class="button">
              ${notification.actionLabel || 'Visa detaljer'}
            </a>
          ` : ''}
        </div>
        <p class="footer">
          Detta meddelande skickades från AIFM Bokföring.<br>
          Du kan ändra dina notifikationsinställningar i appen.
        </p>
      </div>
    </body>
    </html>
  `;

  try {
    // Dynamisk import av SES (valfritt paket)
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses' as any);
    const sesClient = new SESClient({ region: SES_REGION });
    
    await sesClient.send(new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [process.env.ADMIN_EMAIL || 'admin@aifm.se'],
      },
      Message: {
        Subject: {
          Data: `[AIFM] ${notification.title}`,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
        },
      },
    }));

    console.log('[NotificationService] Email sent successfully');
  } catch (error) {
    // SES inte tillgängligt - logga och fortsätt
    console.warn('[NotificationService] Email not sent (SES unavailable):', error instanceof Error ? error.message : 'Unknown');
  }
}

/**
 * Skicka batchnotifikation
 */
export async function sendBatchCompleteNotification(
  companyId: string,
  results: { total: number; success: number; failed: number }
): Promise<void> {
  await sendNotification({
    companyId,
    type: 'batch_complete',
    priority: results.failed > 0 ? 'high' : 'normal',
    title: 'Batch-uppladdning klar',
    message: `${results.success} av ${results.total} dokument har behandlats${results.failed > 0 ? `. ${results.failed} misslyckades.` : ' framgångsrikt.'}`,
    data: results,
    channels: ['in_app'],
    actionUrl: '/accounting/bookkeeping',
    actionLabel: 'Visa dokument',
  });
}

/**
 * Skicka anomalinotifikation
 */
export async function sendAnomalyNotification(
  companyId: string,
  jobId: string,
  anomalies: { type: string; message: string; severity: string }[]
): Promise<void> {
  const highSeverity = anomalies.some(a => a.severity === 'high' || a.severity === 'critical');

  await sendNotification({
    companyId,
    type: 'anomaly_detected',
    priority: highSeverity ? 'high' : 'normal',
    title: `${anomalies.length} avvikelse${anomalies.length > 1 ? 'r' : ''} upptäckt${anomalies.length > 1 ? 'a' : ''}`,
    message: anomalies.map(a => a.message).join('. '),
    data: { jobId, anomalies },
    channels: highSeverity ? ['in_app', 'email'] : ['in_app'],
    actionUrl: `/accounting/bookkeeping?job=${jobId}`,
    actionLabel: 'Granska transaktion',
  });
}

/**
 * Skicka högt beloppsvarning
 */
export async function sendHighAmountAlert(
  companyId: string,
  jobId: string,
  amount: number,
  supplier: string
): Promise<void> {
  await sendNotification({
    companyId,
    type: 'high_amount_alert',
    priority: 'high',
    title: 'Högt belopp kräver godkännande',
    message: `Faktura från ${supplier} på ${amount.toLocaleString('sv-SE')} kr kräver manuellt godkännande`,
    data: { jobId, amount, supplier },
    channels: ['in_app', 'email'],
    actionUrl: `/accounting/bookkeeping?job=${jobId}`,
    actionLabel: 'Granska och godkänn',
  });
}

