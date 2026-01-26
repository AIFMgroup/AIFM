import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as bankReconciliationService from '@/lib/accounting/services/bankReconciliationService';
import * as bankMatchingService from '@/lib/accounting/services/bankMatchingService';


/**
 * GET /api/accounting/bank-reconciliation
 * Get reconciliation data, pending transactions, stats
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'summary';
    const companyId = searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    switch (action) {
      case 'summary': {
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
        
        const summary = await bankMatchingService.generateReconciliationSummary(companyId, year, month);
        return NextResponse.json({ summary });
      }
      
      case 'pending': {
        const transactions = await bankMatchingService.getPendingTransactions(companyId, 100);
        return NextResponse.json({ transactions });
      }
      
      case 'unmatched-invoices': {
        const invoices = await bankMatchingService.getUnmatchedJobs(companyId);
        return NextResponse.json({ invoices });
      }
      
      case 'unmatched-transactions': {
        const transactions = await bankMatchingService.getUnmatchedBankTransactions(companyId);
        return NextResponse.json({ transactions });
      }
      
      case 'rules': {
        const rules = await bankReconciliationService.getReconciliationRules(companyId);
        return NextResponse.json({ rules });
      }
      
      case 'stats': {
        const startDate = searchParams.get('startDate') || `${new Date().getFullYear()}-01-01`;
        const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
        const stats = await bankReconciliationService.getReconciliationStats(companyId, startDate, endDate);
        return NextResponse.json({ stats });
      }
      
      case 'bank-accounts': {
        const accounts = await bankReconciliationService.getBankAccounts(companyId);
        return NextResponse.json({ accounts });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Bank reconciliation GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/bank-reconciliation
 * Perform reconciliation actions
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, companyId } = body;
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    switch (action) {
      case 'import-csv': {
        const { csvContent, format, accountId } = body;
        const transactions = bankMatchingService.parseBankCSV(csvContent, format || 'GENERIC');
        
        const transactionsWithAccount = transactions.map(tx => ({
          ...tx,
          accountId: accountId || tx.accountId,
        }));
        
        const result = await bankMatchingService.importBankTransactions(
          companyId,
          transactionsWithAccount,
          'CSV'
        );
        
        return NextResponse.json({ 
          success: true, 
          imported: result.imported, 
          duplicates: result.duplicates 
        });
      }
      
      case 'start-session': {
        const { startDate, endDate, startedBy = 'User' } = body;
        const session = await bankReconciliationService.startReconciliationSession(
          companyId, startDate, endDate, startedBy
        );
        return NextResponse.json({ session });
      }
      
      case 'run-auto-reconciliation': {
        const { sessionId } = body;
        const result = await bankReconciliationService.runAutoReconciliation(companyId, sessionId);
        return NextResponse.json({ 
          success: true,
          matched: result.matched,
          suggested: result.suggested,
          unmatched: result.unmatched,
          results: result.results,
        });
      }
      
      case 'match': {
        const { transactionId, jobId, isManual = false } = body;
        await bankMatchingService.confirmMatch(companyId, transactionId, jobId, isManual ? 1.0 : 0.9, isManual);
        return NextResponse.json({ success: true });
      }
      
      case 'unmatch': {
        const { transactionId } = body;
        await bankMatchingService.unmatch(companyId, transactionId);
        return NextResponse.json({ success: true });
      }
      
      case 'ignore': {
        const { transactionId, reason } = body;
        await bankMatchingService.ignoreTransaction(companyId, transactionId, reason || 'Manuellt ignorerad');
        return NextResponse.json({ success: true });
      }
      
      case 'create-rule': {
        const { rule } = body;
        const newRule = await bankReconciliationService.createReconciliationRule(companyId, rule);
        return NextResponse.json({ rule: newRule });
      }
      
      case 'add-bank-account': {
        const { account } = body;
        const newAccount = await bankReconciliationService.addBankAccount(companyId, account);
        return NextResponse.json({ account: newAccount });
      }
      
      case 'complete-session': {
        const { sessionId } = body;
        await bankReconciliationService.completeReconciliationSession(companyId, sessionId);
        return NextResponse.json({ success: true });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Bank reconciliation POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

