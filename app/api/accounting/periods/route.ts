/**
 * Period Management API
 * 
 * Hanterar periodstängning enligt svenska bokföringsregler.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOrCreatePeriod,
  runPreCloseChecks,
  closePeriod,
  lockPeriod,
  reopenPeriod,
  getAllPeriods,
  getOpenPeriods,
  isPeriodOpen,
  getLastClosedPeriod,
} from '@/lib/accounting/services/periodClosingService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, companyId, year, month, ...data } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId krävs' }, { status: 400 });
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const targetYear = year || currentYear;
    const targetMonth = month || currentMonth;

    switch (action) {
      // ============ Period Management ============
      case 'getPeriod': {
        const period = await getOrCreatePeriod(companyId, targetYear, targetMonth);
        return NextResponse.json({ period });
      }

      case 'runChecks': {
        const { checks, allPassed, blockers } = await runPreCloseChecks(
          companyId,
          targetYear,
          targetMonth
        );
        
        return NextResponse.json({
          checks,
          allPassed,
          blockers,
          warnings: checks.filter(c => c.status === 'WARNING'),
        });
      }

      case 'closePeriod': {
        const { closedBy, force = false } = data;
        
        if (!closedBy) {
          return NextResponse.json({ error: 'closedBy krävs' }, { status: 400 });
        }
        
        const result = await closePeriod(companyId, targetYear, targetMonth, closedBy, force);
        
        if (!result.success) {
          return NextResponse.json({
            success: false,
            message: 'Kunde inte stänga perioden',
            blockers: result.blockers,
            warnings: result.warnings,
          }, { status: 400 });
        }
        
        return NextResponse.json({
          success: true,
          period: result.period,
          warnings: result.warnings,
        });
      }

      case 'lockPeriod': {
        const { lockedBy } = data;
        
        if (!lockedBy) {
          return NextResponse.json({ error: 'lockedBy krävs' }, { status: 400 });
        }
        
        const result = await lockPeriod(companyId, targetYear, targetMonth, lockedBy);
        
        if (!result.success) {
          return NextResponse.json({ success: false, message: result.message }, { status: 400 });
        }
        
        return NextResponse.json({ success: true, message: result.message });
      }

      case 'reopenPeriod': {
        const { openedBy, reason } = data;
        
        if (!openedBy || !reason) {
          return NextResponse.json({ error: 'openedBy och reason krävs' }, { status: 400 });
        }
        
        const result = await reopenPeriod(companyId, targetYear, targetMonth, openedBy, reason);
        
        if (!result.success) {
          return NextResponse.json({ success: false, message: result.message }, { status: 400 });
        }
        
        return NextResponse.json({ success: true, message: result.message });
      }

      // ============ Bulk Operations ============
      case 'closeMultiplePeriods': {
        const { periods, closedBy, force = false } = data;
        
        if (!periods || !Array.isArray(periods) || !closedBy) {
          return NextResponse.json({ error: 'periods och closedBy krävs' }, { status: 400 });
        }
        
        const results = [];
        for (const p of periods) {
          const result = await closePeriod(companyId, p.year, p.month, closedBy, force);
          results.push({
            period: `${p.year}-${String(p.month).padStart(2, '0')}`,
            success: result.success,
            blockers: result.blockers.length,
          });
        }
        
        return NextResponse.json({
          success: results.every(r => r.success),
          results,
        });
      }

      default:
        return NextResponse.json({ error: `Okänd action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[Periods API] Error:', error);
    return NextResponse.json(
      { error: 'Periodfel', message: error instanceof Error ? error.message : 'Okänt fel' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const action = searchParams.get('action') || 'list';

  if (!companyId) {
    return NextResponse.json({ error: 'companyId krävs' }, { status: 400 });
  }

  try {
    switch (action) {
      case 'list': {
        const periods = await getAllPeriods(companyId);
        return NextResponse.json({ periods });
      }

      case 'open': {
        const periods = await getOpenPeriods(companyId);
        return NextResponse.json({ periods });
      }

      case 'isOpen': {
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
        
        const isOpen = await isPeriodOpen(companyId, year, month);
        return NextResponse.json({ isOpen, year, month });
      }

      case 'lastClosed': {
        const period = await getLastClosedPeriod(companyId);
        return NextResponse.json({ period });
      }

      case 'get': {
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
        
        const period = await getOrCreatePeriod(companyId, year, month);
        return NextResponse.json({ period });
      }

      case 'checks': {
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
        
        const { checks, allPassed, blockers } = await runPreCloseChecks(companyId, year, month);
        return NextResponse.json({ checks, allPassed, blockers });
      }

      default:
        return NextResponse.json({ error: `Okänd action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[Periods API] GET Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta perioder', message: error instanceof Error ? error.message : 'Okänt fel' },
      { status: 500 }
    );
  }
}















