import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  listPeriodizations,
  savePeriodization,
  getPeriodizationsForPeriod,
  getTotalPeriodizationBalance,
  markEntryProcessed,
} from '@/lib/accounting/services/periodizationStore';
import {
  detectPeriodizationNeed,
  createPeriodizationSchedule,
  generateMonthlyPeriodizationVoucher,
} from '@/lib/accounting/services/periodizationService';
import { getFortnoxClient } from '@/lib/fortnox/client';

function generateId() {
  return `per_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * GET /api/accounting/periodizations
 * Query params:
 *   - companyId: required
 *   - status: optional (active|completed|cancelled)
 *   - period: optional (YYYY-MM) - get entries due for this period
 *   - summary: optional (true) - get balance summary
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

  const status = request.nextUrl.searchParams.get('status') as 'active' | 'completed' | 'cancelled' | null;
  const period = request.nextUrl.searchParams.get('period');
  const summary = request.nextUrl.searchParams.get('summary') === 'true';

  try {
    if (summary) {
      const balance = await getTotalPeriodizationBalance(companyId);
      return NextResponse.json({ balance });
    }

    if (period) {
      const entries = await getPeriodizationsForPeriod(companyId, period);
      return NextResponse.json({
        period,
        entries: entries.map(({ schedule, entry }) => ({
          scheduleId: schedule.id,
          supplierName: schedule.supplierName,
          description: schedule.description,
          originalAmount: schedule.originalAmount,
          entry,
        })),
        count: entries.length,
      });
    }

    const schedules = await listPeriodizations(companyId, { status: status || undefined });
    return NextResponse.json({
      schedules,
      count: schedules.length,
    });
  } catch (error) {
    console.error('[Periodizations] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch periodizations' }, { status: 500 });
  }
}

/**
 * POST /api/accounting/periodizations
 * Actions:
 *   - detect: Detect if an invoice should be periodized
 *   - create: Create a new periodization schedule
 *   - process: Mark an entry as processed
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { companyId, action } = body;

  if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

  try {
    if (action === 'detect') {
      const { description, amount, invoiceDate, dueDate, supplierName } = body;
      const detection = detectPeriodizationNeed(
        description || '',
        amount || 0,
        invoiceDate || new Date().toISOString().slice(0, 10),
        dueDate,
        supplierName
      );
      return NextResponse.json({ detection });
    }

    if (action === 'create') {
      const { amount, costAccount, periodizationAccount, startDate, endDate, jobId, supplierName, description } = body;

      if (!amount || !costAccount || !periodizationAccount || !startDate || !endDate) {
        return NextResponse.json({ error: 'Missing required fields for periodization' }, { status: 400 });
      }

      const schedule = createPeriodizationSchedule(
        amount,
        costAccount,
        periodizationAccount,
        startDate,
        endDate
      );

      // Override the ID with our format
      schedule.id = generateId();

      const stored = await savePeriodization(companyId, schedule, {
        jobId,
        supplierName,
        description,
      });

      return NextResponse.json({ success: true, schedule: stored });
    }

    if (action === 'process') {
      const { scheduleId, period } = body;
      if (!scheduleId || !period) {
        return NextResponse.json({ error: 'Missing scheduleId or period' }, { status: 400 });
      }

      await markEntryProcessed(companyId, scheduleId, period);
      return NextResponse.json({ success: true });
    }

    if (action === 'book-period') {
      const { period, voucherSeries } = body as { period?: string; voucherSeries?: string };
      if (!period) return NextResponse.json({ error: 'Missing period (YYYY-MM)' }, { status: 400 });

      const client = await getFortnoxClient(companyId);
      if (!client) return NextResponse.json({ error: 'Fortnox is not connected for this company' }, { status: 400 });

      const due = await getPeriodizationsForPeriod(companyId, period);
      let booked = 0;
      let failed = 0;
      const results: Array<{ scheduleId: string; success: boolean; voucherNumber?: string; error?: string }> = [];

      for (const { schedule, entry } of due) {
        try {
          const voucherData = generateMonthlyPeriodizationVoucher(entry);
          const resp = await client.createVoucher({
            VoucherSeries: voucherSeries || 'A',
            TransactionDate: entry.date,
            Description: schedule.description ? `${entry.description} (${schedule.description})` : entry.description,
            VoucherRows: voucherData.lines.map(l => ({
              Account: parseInt(l.account, 10),
              Debit: l.debit || 0,
              Credit: l.credit || 0,
              Description: l.description,
            })),
          });

          if (resp.success && resp.data?.Voucher) {
            booked += 1;
            await markEntryProcessed(companyId, schedule.id, period);
            results.push({
              scheduleId: schedule.id,
              success: true,
              voucherNumber: `${resp.data.Voucher.VoucherSeries}${resp.data.Voucher.VoucherNumber}`,
            });
          } else {
            failed += 1;
            results.push({ scheduleId: schedule.id, success: false, error: resp.error || 'Fortnox error' });
          }
        } catch (e: unknown) {
          failed += 1;
          results.push({
            scheduleId: schedule.id,
            success: false,
            error: e instanceof Error ? e.message : 'Unknown error',
          });
        }
      }

      return NextResponse.json({ success: true, period, booked, failed, results });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Periodizations] POST error:', error);
    return NextResponse.json({ error: 'Failed to process periodization' }, { status: 500 });
  }
}

