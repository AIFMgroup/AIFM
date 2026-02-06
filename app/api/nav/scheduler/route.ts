/**
 * NAV Scheduler API
 * 
 * Endpoints för att hantera schemalagda NAV-körningar
 * Kan triggas av AWS EventBridge eller manuellt
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNAVScheduler, ScheduleConfig } from '@/lib/nav-engine/scheduler';

// ============================================================================
// GET - Get scheduler status and upcoming runs
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    const scheduler = getNAVScheduler();

    switch (action) {
      case 'status': {
        const config = scheduler.getConfig();
        const nextRun = scheduler.getNextScheduledRun();
        const shouldRunToday = scheduler.shouldRunToday();

        return NextResponse.json({
          success: true,
          data: {
            config,
            nextRun,
            shouldRunToday,
            currentTime: new Date().toISOString(),
          },
        });
      }

      case 'history': {
        const limit = parseInt(searchParams.get('limit') || '30', 10);
        const history = await scheduler.getRunHistory(limit);

        return NextResponse.json({
          success: true,
          data: { runs: history },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[NAV Scheduler API] GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get scheduler status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Execute NAV run or update config
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, navDate, config, runId } = body;

    const scheduler = getNAVScheduler();

    switch (action) {
      case 'run': {
        // Execute NAV calculation
        console.log(`[NAV Scheduler API] Triggering NAV run for ${navDate || 'today'}`);
        
        const run = await scheduler.executeScheduledRun(navDate);

        return NextResponse.json({
          success: true,
          data: {
            runId: run.runId,
            navDate: run.navDate,
            status: run.status,
            completedFunds: run.completedFunds,
            failedFunds: run.failedFunds,
            errors: run.errors,
          },
        });
      }

      case 'retry': {
        if (!runId) {
          return NextResponse.json(
            { success: false, error: 'runId is required for retry' },
            { status: 400 }
          );
        }

        const run = await scheduler.retryFailedRun(runId);

        return NextResponse.json({
          success: true,
          data: {
            runId: run.runId,
            navDate: run.navDate,
            status: run.status,
            completedFunds: run.completedFunds,
            failedFunds: run.failedFunds,
          },
        });
      }

      case 'update_config': {
        if (!config) {
          return NextResponse.json(
            { success: false, error: 'config is required' },
            { status: 400 }
          );
        }

        scheduler.updateConfig(config as Partial<ScheduleConfig>);

        return NextResponse.json({
          success: true,
          data: { config: scheduler.getConfig() },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[NAV Scheduler API] POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Scheduler operation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
