/**
 * NAV Scheduler API Routes
 * 
 * Endpoints för att hantera schemalagda NAV-jobb
 */

import { NextRequest, NextResponse } from 'next/server';
import { navScheduler, DEFAULT_NAV_SCHEDULE } from '@/lib/integrations/secura/scheduler';
import { getNAVAutomationService } from '@/lib/integrations/secura';

/**
 * GET /api/nav-automation/scheduler
 * 
 * Hämta schema-status för alla jobb
 */
export async function GET() {
  try {
    const scheduleStatus = navScheduler.getScheduleStatus();
    
    // Get actual EventBridge rules if available
    let eventBridgeRules: Array<{ name: string; state: string; scheduleExpression: string }> = [];
    try {
      eventBridgeRules = await navScheduler.listRules();
    } catch {
      // EventBridge might not be configured yet
      console.log('[Scheduler API] EventBridge not configured or accessible');
    }

    return NextResponse.json({
      success: true,
      jobs: scheduleStatus,
      eventBridgeConfigured: eventBridgeRules.length > 0,
      eventBridgeRules,
      timezone: 'Europe/Stockholm',
    });
  } catch (error) {
    console.error('[Scheduler API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduler status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/nav-automation/scheduler
 * 
 * Kör ett jobb manuellt eller uppdatera jobbkonfiguration
 * 
 * Body:
 * {
 *   "action": "run" | "enable" | "disable" | "initialize",
 *   "jobId": string,
 *   ...
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, jobId } = body;

    switch (action) {
      case 'run': {
        // Kör ett jobb manuellt
        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId required' },
            { status: 400 }
          );
        }

        const job = DEFAULT_NAV_SCHEDULE.find(j => j.id === jobId);
        if (!job) {
          return NextResponse.json(
            { error: 'Job not found' },
            { status: 404 }
          );
        }

        const service = getNAVAutomationService();
        let result;

        switch (job.jobType) {
          case 'DATA_FETCH':
            // Would call Secura API to fetch data
            result = { message: 'Data hämtning startad (demo)' };
            break;
          
          case 'NOTOR':
            result = await service.processNotor({
              fundIds: ['FUND001'], // Would come from config
              recipients: ['test@example.com'],
              format: 'PDF',
            });
            break;
          
          case 'NAV_REPORTS':
            result = await service.processNAVReports({
              fundIds: ['FUND001'],
              recipients: ['test@example.com'],
              format: 'PDF',
            });
            break;
          
          case 'PRICE_DATA':
            result = await service.processPriceData({
              fundIds: ['FUND001'],
              recipients: ['test@example.com'],
              uploadToWebsite: false,
            });
            break;
          
          case 'OWNER_DATA':
            result = await service.processOwnerData({
              fundIds: ['FUND001'],
              recipients: ['test@example.com'],
              includeClearstream: true,
            });
            break;
          
          case 'SUBRED':
            result = await service.processSubReds({
              fundIds: ['FUND001'],
              recipients: ['test@example.com'],
              includeAccountStatement: true,
            });
            break;
          
          default:
            result = { message: 'Job type not implemented' };
        }

        return NextResponse.json({
          success: true,
          jobId,
          jobType: job.jobType,
          result,
          message: `Jobb "${job.name}" kördes manuellt`,
        });
      }

      case 'enable':
      case 'disable': {
        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId required' },
            { status: 400 }
          );
        }

        const enabled = action === 'enable';
        
        try {
          await navScheduler.setJobEnabled(jobId, enabled);
        } catch {
          // EventBridge might not be configured
          console.log('[Scheduler API] Could not update EventBridge rule');
        }

        return NextResponse.json({
          success: true,
          jobId,
          enabled,
          message: `Jobb ${enabled ? 'aktiverat' : 'inaktiverat'}`,
        });
      }

      case 'initialize': {
        // Initialize EventBridge rules (requires Lambda ARN and Role ARN)
        const { lambdaArn, roleArn } = body;
        
        if (!lambdaArn || !roleArn) {
          return NextResponse.json(
            { error: 'lambdaArn and roleArn required for initialization' },
            { status: 400 }
          );
        }

        await navScheduler.initializeDefaultSchedule(lambdaArn, roleArn);

        return NextResponse.json({
          success: true,
          message: 'Scheduler initialized with default schedule',
          jobs: DEFAULT_NAV_SCHEDULE.length,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: run, enable, disable, or initialize' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Scheduler API] POST error:', error);
    return NextResponse.json(
      { 
        error: 'Operation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
