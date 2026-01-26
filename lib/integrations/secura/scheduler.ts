/**
 * NAV Automation Scheduler
 * 
 * Konfiguration för schemalagda jobb via AWS EventBridge
 * 
 * Schema:
 * - 06:00 - Hämta data från Secura
 * - 07:00 - Generera och skicka Notor
 * - 08:30 - Skicka NAV-rapporter (efter godkännande)
 * - 09:00 - Skicka prisdata
 * - 09:15 - Skicka ägardata
 * - 16:00 - Skicka SubReds
 */

import { 
  EventBridgeClient, 
  PutRuleCommand, 
  PutTargetsCommand,
  DeleteRuleCommand,
  RemoveTargetsCommand,
  ListRulesCommand,
  EnableRuleCommand,
  DisableRuleCommand,
} from '@aws-sdk/client-eventbridge';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const eventBridge = new EventBridgeClient({ region: REGION });

// ============================================================================
// Types
// ============================================================================

export interface ScheduledJob {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  jobType: 'DATA_FETCH' | 'NOTOR' | 'NAV_REPORTS' | 'PRICE_DATA' | 'OWNER_DATA' | 'SUBRED';
  targetEndpoint: string;
  lastRun?: string;
  nextRun?: string;
}

export interface SchedulerConfig {
  tenantId: string;
  companyId: string;
  jobs: ScheduledJob[];
}

// ============================================================================
// Default Schedule
// ============================================================================

export const DEFAULT_NAV_SCHEDULE: ScheduledJob[] = [
  {
    id: 'nav-data-fetch',
    name: 'Hämta NAV-data',
    description: 'Hämtar transaktions- och NAV-data från Secura',
    cronExpression: 'cron(0 6 ? * MON-FRI *)', // 06:00 vardagar
    timezone: 'Europe/Stockholm',
    enabled: true,
    jobType: 'DATA_FETCH',
    targetEndpoint: '/api/nav-automation?type=data-fetch',
  },
  {
    id: 'nav-notor',
    name: 'Notor utskick',
    description: 'Genererar och skickar Notor (gårdagens in/utflöden)',
    cronExpression: 'cron(0 7 ? * MON-FRI *)', // 07:00 vardagar
    timezone: 'Europe/Stockholm',
    enabled: true,
    jobType: 'NOTOR',
    targetEndpoint: '/api/nav-automation?type=notor',
  },
  {
    id: 'nav-reports',
    name: 'NAV-rapporter',
    description: 'Skickar NAV-rapporter efter godkännande',
    cronExpression: 'cron(30 8 ? * MON-FRI *)', // 08:30 vardagar
    timezone: 'Europe/Stockholm',
    enabled: true,
    jobType: 'NAV_REPORTS',
    targetEndpoint: '/api/nav-automation?type=nav-reports',
  },
  {
    id: 'nav-price-data',
    name: 'Prisdata utskick',
    description: 'Skickar prisdata till institut och uppdaterar hemsidan',
    cronExpression: 'cron(0 9 ? * MON-FRI *)', // 09:00 vardagar
    timezone: 'Europe/Stockholm',
    enabled: true,
    jobType: 'PRICE_DATA',
    targetEndpoint: '/api/nav-automation?type=price-data',
  },
  {
    id: 'nav-owner-data',
    name: 'Ägardata utskick',
    description: 'Skickar ägardata till Clearstream och andra kunder',
    cronExpression: 'cron(15 9 ? * MON-FRI *)', // 09:15 vardagar
    timezone: 'Europe/Stockholm',
    enabled: true,
    jobType: 'OWNER_DATA',
    targetEndpoint: '/api/nav-automation?type=owner-data',
  },
  {
    id: 'nav-subred',
    name: 'SubReds utskick',
    description: 'Skickar SubReds (dagens in/utflöden) och kontoutdrag',
    cronExpression: 'cron(0 15 ? * MON-FRI *)', // 15:00 vardagar
    timezone: 'Europe/Stockholm',
    enabled: true,
    jobType: 'SUBRED',
    targetEndpoint: '/api/nav-automation?type=subreds',
  },
];

// ============================================================================
// Scheduler Service
// ============================================================================

export const navScheduler = {
  /**
   * Skapa eller uppdatera ett schemalagt jobb
   */
  async createOrUpdateRule(
    job: ScheduledJob,
    lambdaArn: string,
    roleArn: string
  ): Promise<void> {
    const ruleName = `aifm-nav-${job.id}`;
    
    // Create/update the rule
    await eventBridge.send(new PutRuleCommand({
      Name: ruleName,
      Description: job.description,
      ScheduleExpression: job.cronExpression,
      State: job.enabled ? 'ENABLED' : 'DISABLED',
      Tags: [
        { Key: 'project', Value: 'aifm' },
        { Key: 'type', Value: 'nav-automation' },
        { Key: 'jobType', Value: job.jobType },
      ],
    }));
    
    // Set the target (Lambda function)
    await eventBridge.send(new PutTargetsCommand({
      Rule: ruleName,
      Targets: [
        {
          Id: `${job.id}-target`,
          Arn: lambdaArn,
          RoleArn: roleArn,
          Input: JSON.stringify({
            jobId: job.id,
            jobType: job.jobType,
            endpoint: job.targetEndpoint,
            timestamp: '$.time',
          }),
        },
      ],
    }));
    
    console.log(`[NAVScheduler] Created/updated rule: ${ruleName}`);
  },
  
  /**
   * Ta bort ett schemalagt jobb
   */
  async deleteRule(jobId: string): Promise<void> {
    const ruleName = `aifm-nav-${jobId}`;
    
    // Remove targets first
    await eventBridge.send(new RemoveTargetsCommand({
      Rule: ruleName,
      Ids: [`${jobId}-target`],
    }));
    
    // Delete the rule
    await eventBridge.send(new DeleteRuleCommand({
      Name: ruleName,
    }));
    
    console.log(`[NAVScheduler] Deleted rule: ${ruleName}`);
  },
  
  /**
   * Aktivera/inaktivera ett jobb
   */
  async setJobEnabled(jobId: string, enabled: boolean): Promise<void> {
    const ruleName = `aifm-nav-${jobId}`;
    
    if (enabled) {
      await eventBridge.send(new EnableRuleCommand({
        Name: ruleName,
      }));
    } else {
      await eventBridge.send(new DisableRuleCommand({
        Name: ruleName,
      }));
    }
    
    console.log(`[NAVScheduler] ${enabled ? 'Enabled' : 'Disabled'} rule: ${ruleName}`);
  },
  
  /**
   * Lista alla NAV-relaterade regler
   */
  async listRules(): Promise<Array<{
    name: string;
    state: string;
    scheduleExpression: string;
  }>> {
    const result = await eventBridge.send(new ListRulesCommand({
      NamePrefix: 'aifm-nav-',
    }));
    
    return (result.Rules || []).map(rule => ({
      name: rule.Name || '',
      state: rule.State || 'DISABLED',
      scheduleExpression: rule.ScheduleExpression || '',
    }));
  },
  
  /**
   * Initiera alla standard-jobb
   */
  async initializeDefaultSchedule(
    lambdaArn: string,
    roleArn: string
  ): Promise<void> {
    console.log('[NAVScheduler] Initializing default schedule...');
    
    for (const job of DEFAULT_NAV_SCHEDULE) {
      await this.createOrUpdateRule(job, lambdaArn, roleArn);
    }
    
    console.log('[NAVScheduler] Default schedule initialized');
  },
  
  /**
   * Beräkna nästa körtid för ett cron-uttryck
   */
  getNextRunTime(cronExpression: string): Date {
    // Simplified - in production use a proper cron parser
    const now = new Date();
    const match = cronExpression.match(/cron\((\d+) (\d+)/);
    
    if (match) {
      const minute = parseInt(match[1]);
      const hour = parseInt(match[2]);
      
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);
      
      // If time has passed today, move to next weekday
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      
      // Skip weekends
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1);
      }
      
      return next;
    }
    
    return new Date();
  },
  
  /**
   * Hämta schedule-status för dashboard
   */
  getScheduleStatus(): Array<ScheduledJob & { nextRun: string }> {
    return DEFAULT_NAV_SCHEDULE.map(job => ({
      ...job,
      nextRun: this.getNextRunTime(job.cronExpression).toISOString(),
    }));
  },
};

export default navScheduler;
