/**
 * NAV Scheduler
 * 
 * Schemaläggning av dagliga NAV-körningar
 * Kan triggas av AWS EventBridge, cron, eller manuellt
 */

import { createNAVService, NAVService } from './nav-service';
import { 
  getNAVRunStore, 
  getNAVApprovalStore, 
  getNAVRecordStore,
  NAVRunRecord,
} from './nav-store';
import { NAVRun, NAVRunStatus, NAVCalculationResult } from './types';

// ============================================================================
// Types
// ============================================================================

export interface ScheduleConfig {
  // Timing
  navCalculationTime: string; // HH:mm format, e.g., "15:00"
  timezone: string; // e.g., "Europe/Stockholm"
  
  // Days to run
  runOnWeekdays: boolean;
  runOnWeekends: boolean;
  holidays: string[]; // ISO dates to skip
  
  // Options
  autoApprove: boolean; // Skip approval for small changes
  autoApproveThreshold: number; // Max % change for auto-approve
  
  // Notifications
  notifyOnComplete: boolean;
  notifyOnError: boolean;
  notificationEmails: string[];
  
  // Retry
  retryOnFailure: boolean;
  maxRetries: number;
  retryDelayMinutes: number;
}

export interface ScheduledRun {
  scheduledTime: string;
  actualStartTime?: string;
  navDate: string;
  status: 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  runId?: string;
  error?: string;
}

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  navCalculationTime: '15:00',
  timezone: 'Europe/Stockholm',
  runOnWeekdays: true,
  runOnWeekends: false,
  holidays: [],
  autoApprove: false,
  autoApproveThreshold: 1.0, // 1%
  notifyOnComplete: true,
  notifyOnError: true,
  notificationEmails: [],
  retryOnFailure: true,
  maxRetries: 3,
  retryDelayMinutes: 15,
};

// ============================================================================
// NAV Scheduler Class
// ============================================================================

export class NAVScheduler {
  private navService: NAVService;
  private config: ScheduleConfig;
  private runStore = getNAVRunStore();
  private approvalStore = getNAVApprovalStore();
  private recordStore = getNAVRecordStore();

  constructor(config: Partial<ScheduleConfig> = {}) {
    this.config = { ...DEFAULT_SCHEDULE_CONFIG, ...config };
    this.navService = createNAVService();
  }

  /**
   * Check if today should have a NAV run
   */
  shouldRunToday(date: Date = new Date()): boolean {
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    // Check if it's a holiday
    if (this.config.holidays.includes(dateStr)) {
      return false;
    }

    // Check weekday/weekend
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend && !this.config.runOnWeekends) {
      return false;
    }
    if (!isWeekend && !this.config.runOnWeekdays) {
      return false;
    }

    return true;
  }

  /**
   * Get the next scheduled run time
   */
  getNextScheduledRun(): ScheduledRun {
    const now = new Date();
    let targetDate = new Date(now);

    // Parse scheduled time
    const [hours, minutes] = this.config.navCalculationTime.split(':').map(Number);
    targetDate.setHours(hours, minutes, 0, 0);

    // If we've passed today's time, check tomorrow
    if (now > targetDate) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    // Find next valid run day
    while (!this.shouldRunToday(targetDate)) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    return {
      scheduledTime: targetDate.toISOString(),
      navDate: targetDate.toISOString().split('T')[0],
      status: 'SCHEDULED',
    };
  }

  /**
   * Execute a scheduled NAV run
   */
  async executeScheduledRun(navDate?: string): Promise<NAVRun> {
    const date = navDate || new Date().toISOString().split('T')[0];
    console.log(`[NAV Scheduler] Starting scheduled NAV run for ${date}`);

    try {
      // Run the NAV calculation
      const run = await this.navService.runDailyNAV(date);

      // Save run to database
      await this.runStore.saveRun(run);

      // Save individual NAV records
      const results: NAVCalculationResult[] = [];
      run.fundResults.forEach((result) => {
        results.push(result);
      });

      if (results.length > 0) {
        await this.recordStore.batchSaveNAVRecords(results);
      }

      // Create approval request if needed
      if (run.status !== 'FAILED' && results.length > 0) {
        const approval = await this.approvalStore.createApproval(
          run.runId,
          date,
          results
        );

        // Check for auto-approve
        if (this.config.autoApprove) {
          const maxChange = Math.max(...results.map(r => Math.abs(r.navChangePercent)));
          if (maxChange <= this.config.autoApproveThreshold) {
            console.log(`[NAV Scheduler] Auto-approving NAV (max change: ${maxChange.toFixed(2)}%)`);
            // Auto-approve would go here
          }
        }

        run.approvalStatus = 'PENDING';
      }

      console.log(`[NAV Scheduler] NAV run completed: ${run.completedFunds}/${run.totalFunds} funds`);

      return run;

    } catch (error) {
      console.error('[NAV Scheduler] NAV run failed:', error);
      
      // Create failed run record
      const failedRun: NAVRun = {
        runId: `NAV-${date}-${Date.now()}`,
        navDate: date,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: 'FAILED',
        fundResults: new Map(),
        totalFunds: 0,
        completedFunds: 0,
        failedFunds: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };

      await this.runStore.saveRun(failedRun);

      throw error;
    }
  }

  /**
   * Retry a failed run
   */
  async retryFailedRun(runId: string): Promise<NAVRun> {
    const existingRun = await this.runStore.getRun(runId);
    if (!existingRun) {
      throw new Error(`Run ${runId} not found`);
    }

    console.log(`[NAV Scheduler] Retrying failed run ${runId} for date ${existingRun.navDate}`);
    return this.executeScheduledRun(existingRun.navDate);
  }

  /**
   * Get run history
   */
  async getRunHistory(limit: number = 30): Promise<NAVRunRecord[]> {
    return this.runStore.getRecentRuns(limit);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ScheduleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ScheduleConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let schedulerInstance: NAVScheduler | null = null;

export function getNAVScheduler(config?: Partial<ScheduleConfig>): NAVScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new NAVScheduler(config);
  } else if (config) {
    schedulerInstance.updateConfig(config);
  }
  return schedulerInstance;
}

export function createNAVScheduler(config?: Partial<ScheduleConfig>): NAVScheduler {
  return new NAVScheduler(config);
}
