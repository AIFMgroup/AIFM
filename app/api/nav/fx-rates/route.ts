/**
 * FX Rates API
 * 
 * Hämtar valutakurser från ECB och andra källor
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getECBRates, 
  getRate, 
  getRatesForCurrency, 
  getCommonRates,
  fetchECBHistoricalRates,
} from '@/lib/integrations/fx/ecb-rates';

// ============================================================================
// GET - Hämta valutakurser
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const baseCurrency = searchParams.get('base') || 'SEK';
    const quoteCurrency = searchParams.get('quote');
    const date = searchParams.get('date');
    const common = searchParams.get('common') === 'true';

    // Get single rate
    if (quoteCurrency) {
      const rate = await getRate(baseCurrency, quoteCurrency, date || undefined);
      
      return NextResponse.json({
        success: true,
        data: rate,
      });
    }

    // Get common rates (SEK, EUR, USD, etc.)
    if (common) {
      const rates = await getCommonRates(baseCurrency, date || undefined);
      
      return NextResponse.json({
        success: true,
        data: {
          baseCurrency,
          date: rates[0]?.rateDate || new Date().toISOString().split('T')[0],
          rates,
        },
      });
    }

    // Get all rates for base currency
    const rates = await getRatesForCurrency(baseCurrency, date || undefined);
    
    return NextResponse.json({
      success: true,
      data: {
        baseCurrency,
        date: rates[0]?.rateDate || new Date().toISOString().split('T')[0],
        rates,
        source: 'ECB',
      },
    });

  } catch (error) {
    console.error('[FX Rates API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch FX rates',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Hämta flera kurser
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pairs, date, baseCurrency } = body;

    // Get multiple specific pairs
    if (pairs && Array.isArray(pairs)) {
      const rates = await Promise.all(
        pairs.map(async (pair: { from: string; to: string }) => {
          try {
            return await getRate(pair.from, pair.to, date);
          } catch {
            return null;
          }
        })
      );

      return NextResponse.json({
        success: true,
        data: {
          date: date || new Date().toISOString().split('T')[0],
          rates: rates.filter(r => r !== null),
        },
      });
    }

    // Get all rates for a base currency
    if (baseCurrency) {
      const rates = await getRatesForCurrency(baseCurrency, date);
      
      return NextResponse.json({
        success: true,
        data: {
          baseCurrency,
          date: rates[0]?.rateDate || date || new Date().toISOString().split('T')[0],
          rates,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'pairs or baseCurrency required' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[FX Rates API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch FX rates',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
