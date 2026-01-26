/**
 * Bank Matching API
 * 
 * Hanterar banktransaktioner och matchning mot fakturor/kvitton.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  importBankTransactions,
  matchTransaction,
  matchAllPendingTransactions,
  getPendingTransactions,
  confirmMatch,
  ignoreTransaction,
  unmatch,
  generateReconciliationSummary,
  parseBankCSV,
  BankTransaction,
  MatchCandidate,
} from '@/lib/accounting/services/bankMatchingService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, companyId, ...data } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId krävs' }, { status: 400 });
    }

    switch (action) {
      // ============ Import ============
      case 'importTransactions': {
        const { transactions, source = 'MANUAL' } = data;
        
        if (!transactions || !Array.isArray(transactions)) {
          return NextResponse.json({ error: 'transactions krävs' }, { status: 400 });
        }
        
        const result = await importBankTransactions(companyId, transactions, source);
        return NextResponse.json({ 
          success: true,
          imported: result.imported,
          duplicates: result.duplicates,
        });
      }

      case 'importCSV': {
        const { csvContent, format = 'GENERIC' } = data;
        
        if (!csvContent) {
          return NextResponse.json({ error: 'csvContent krävs' }, { status: 400 });
        }
        
        const transactions = parseBankCSV(csvContent, format);
        const result = await importBankTransactions(companyId, transactions, 'CSV');
        
        return NextResponse.json({
          success: true,
          parsed: transactions.length,
          imported: result.imported,
          duplicates: result.duplicates,
        });
      }

      // ============ Matching ============
      case 'matchTransaction': {
        const { transaction, candidates } = data;
        
        if (!transaction || !candidates) {
          return NextResponse.json({ error: 'transaction och candidates krävs' }, { status: 400 });
        }
        
        const result = await matchTransaction(companyId, transaction, candidates);
        return NextResponse.json({ match: result });
      }

      case 'matchAllPending': {
        const { candidates } = data;
        
        if (!candidates || !Array.isArray(candidates)) {
          return NextResponse.json({ error: 'candidates krävs' }, { status: 400 });
        }
        
        const result = await matchAllPendingTransactions(companyId, candidates);
        return NextResponse.json({
          success: true,
          matched: result.matched,
          requiresReview: result.requiresReview,
          unmatched: result.unmatched,
          results: result.results,
        });
      }

      case 'confirmMatch': {
        const { transactionId, jobId, confidence = 1.0, isManual = true } = data;
        
        if (!transactionId || !jobId) {
          return NextResponse.json({ error: 'transactionId och jobId krävs' }, { status: 400 });
        }
        
        await confirmMatch(companyId, transactionId, jobId, confidence, isManual);
        return NextResponse.json({ success: true });
      }

      case 'ignoreTransaction': {
        const { transactionId, reason } = data;
        
        if (!transactionId) {
          return NextResponse.json({ error: 'transactionId krävs' }, { status: 400 });
        }
        
        await ignoreTransaction(companyId, transactionId, reason || 'Manuellt ignorerad');
        return NextResponse.json({ success: true });
      }

      case 'unmatch': {
        const { transactionId } = data;
        
        if (!transactionId) {
          return NextResponse.json({ error: 'transactionId krävs' }, { status: 400 });
        }
        
        await unmatch(companyId, transactionId);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Okänd action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[Bank API] Error:', error);
    return NextResponse.json(
      { error: 'Bankfel', message: error instanceof Error ? error.message : 'Okänt fel' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const action = searchParams.get('action');

  if (!companyId) {
    return NextResponse.json({ error: 'companyId krävs' }, { status: 400 });
  }

  try {
    switch (action) {
      case 'pendingTransactions': {
        const limit = searchParams.get('limit');
        const transactions = await getPendingTransactions(
          companyId,
          limit ? parseInt(limit) : undefined
        );
        return NextResponse.json({ transactions });
      }

      case 'reconciliation': {
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
        
        const summary = await generateReconciliationSummary(companyId, year, month);
        return NextResponse.json({ summary });
      }

      default:
        return NextResponse.json({ error: 'action krävs' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Bank API] GET Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta data', message: error instanceof Error ? error.message : 'Okänt fel' },
      { status: 500 }
    );
  }
}















