/**
 * NAV Scheduler API Routes
 * 
 * Endpoints för att hantera schemalagda NAV-jobb
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFundRegistry } from '@/lib/fund-registry';
import { getPriceDataProviderManager } from '@/lib/integrations/pricing';

// Default schedule configuration
const DEFAULT_NAV_SCHEDULE = [
  {
    id: 'data-fetch',
    name: 'Hämta NAV-data',
    jobType: 'DATA_FETCH',
    schedule: '06:00',
    enabled: true,
    description: 'Hämtar daglig NAV-data från fondregistret',
  },
  {
    id: 'notor',
    name: 'Notor utskick',
    jobType: 'NOTOR',
    schedule: '07:00',
    enabled: true,
    description: 'Skickar gårdagens transaktioner',
  },
  {
    id: 'nav-reports',
    name: 'NAV-rapporter',
    jobType: 'NAV_REPORTS',
    schedule: '08:30',
    enabled: true,
    description: 'Skickar NAV-rapporter efter godkännande',
  },
  {
    id: 'price-data',
    name: 'Prisdata-distribution',
    jobType: 'PRICE_DATA',
    schedule: '09:00',
    enabled: true,
    description: 'Distribuerar prisdata till institut',
  },
  {
    id: 'owner-data',
    name: 'Ägardata',
    jobType: 'OWNER_DATA',
    schedule: '09:15',
    enabled: true,
    description: 'Uppdaterar ägardata för Clearstream',
  },
  {
    id: 'subred',
    name: 'SubReds',
    jobType: 'SUBRED',
    schedule: '15:00',
    enabled: true,
    description: 'Skickar dagens/morgondagens in/utflöden',
  },
];

// In-memory job status (in production, store in database)
const jobStatus: Map<string, { lastRun?: string; lastResult?: string; enabled: boolean }> = new Map(
  DEFAULT_NAV_SCHEDULE.map(job => [job.id, { enabled: job.enabled }])
);

/**
 * GET /api/nav-automation/scheduler
 * 
 * Hämta schema-status för alla jobb
 */
export async function GET() {
  try {
    const scheduleStatus = DEFAULT_NAV_SCHEDULE.map(job => ({
      ...job,
      ...jobStatus.get(job.id),
    }));

    return NextResponse.json({
      success: true,
      jobs: scheduleStatus,
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
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, jobId } = body;

    switch (action) {
      case 'run': {
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

        const registry = getFundRegistry();
        const priceManager = getPriceDataProviderManager();
        let result;

        switch (job.jobType) {
          case 'DATA_FETCH': {
            const funds = await registry.listFunds();
            result = { message: 'Data hämtad', fundCount: funds.length };
            break;
          }
          
          case 'NAV_REPORTS':
          case 'PRICE_DATA': {
            const priceData = await registry.getPriceData();
            result = { message: 'Prisdata hämtad', recordCount: priceData.length };
            break;
          }
          
          case 'OWNER_DATA': {
            const funds = await registry.listFunds();
            result = { message: 'Ägardata uppdaterad (demo)', fundCount: funds.length };
            break;
          }
          
          default:
            result = { message: `Jobb ${job.jobType} kördes (demo)` };
        }

        // Update job status
        const status = jobStatus.get(jobId) || { enabled: true };
        status.lastRun = new Date().toISOString();
        status.lastResult = 'success';
        jobStatus.set(jobId, status);

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
        const status = jobStatus.get(jobId) || { enabled: true };
        status.enabled = enabled;
        jobStatus.set(jobId, status);

        return NextResponse.json({
          success: true,
          jobId,
          enabled,
          message: `Jobb ${enabled ? 'aktiverat' : 'inaktiverat'}`,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: run, enable, or disable' },
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
