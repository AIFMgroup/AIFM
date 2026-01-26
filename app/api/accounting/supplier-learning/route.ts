import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as supplierLearningService from '@/lib/accounting/services/supplierLearningService';

/**
 * GET /api/accounting/supplier-learning
 * Get supplier learning data
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'suggest';
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    switch (action) {
      case 'suggest': {
        const supplierName = searchParams.get('supplierName');
        if (!supplierName) {
          return NextResponse.json({ error: 'supplierName required' }, { status: 400 });
        }
        
        const amount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : undefined;
        const description = searchParams.get('description') || undefined;
        
        const suggestion = await supplierLearningService.getAccountSuggestion(
          companyId, supplierName, amount, description
        );
        
        return NextResponse.json({ suggestion });
      }
      
      case 'profiles': {
        const category = searchParams.get('category') as supplierLearningService.SupplierCategory | undefined;
        const minTransactions = searchParams.get('minTransactions') 
          ? parseInt(searchParams.get('minTransactions')!) 
          : undefined;
        const sortBy = searchParams.get('sortBy') as 'transactions' | 'lastUsed' | 'name' | undefined;
        
        const profiles = await supplierLearningService.getAllSupplierProfiles(companyId, {
          category,
          minTransactions,
          sortBy,
        });
        
        return NextResponse.json({ profiles });
      }
      
      case 'stats': {
        const stats = await supplierLearningService.getSupplierStats(companyId);
        return NextResponse.json({ stats });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Supplier learning GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/supplier-learning
 * Record transactions and corrections
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
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    switch (action) {
      case 'record-transaction': {
        const { 
          supplierName, 
          account, 
          accountName, 
          amount, 
          vatCode, 
          costCenter,
          orgNumber,
          wasCorrection,
          originalAccount 
        } = body;
        
        await supplierLearningService.recordTransaction(
          companyId,
          supplierName,
          account,
          accountName,
          amount,
          {
            vatCode,
            costCenter,
            orgNumber,
            wasCorrection,
            originalAccount,
          }
        );
        
        return NextResponse.json({ success: true });
      }
      
      case 'add-alias': {
        const { primaryName, aliasName } = body;
        await supplierLearningService.addSupplierAlias(companyId, primaryName, aliasName);
        return NextResponse.json({ success: true });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Supplier learning POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}







