import { NextRequest, NextResponse } from 'next/server';
import { getAIModelForTask, buildAIMessages } from '@/lib/ai-knowledge';

/**
 * AI Process API - DEMO MODE
 * Returns mock processing results for demonstration purposes
 * Replace with real OpenAI integration when going to production
 */

const MOCK_RESULTS: Record<string, any> = {
  BANK_RECON: {
    analysis: 'Demo: Bankavstämning genomförd. Inga avvikelser hittades.',
    discrepancies: [],
    recommendations: [
      'Granska månatliga transaktioner',
      'Verifiera avgifter mot kontrakt',
    ],
    flags: [
      {
        severity: 'info',
        message: 'Demo-läge aktivt - ingen riktig analys utförd',
        code: 'DEMO_MODE',
      },
    ],
  },

  KYC_REVIEW: {
    approved: true,
    riskLevel: 'low',
    pepStatus: 'clear',
    sanctionStatus: 'clear',
    issues: [],
    recommendedActions: [
      'Demo: KYC-granskning klar',
      'Aktivera AI för full analys',
    ],
  },

  REPORT_DRAFT: {
    report: `# Demo Rapport

## Sammanfattning
Detta är en demo-rapport genererad utan AI.

## Status
- Demo-läge aktivt
- Ingen riktig dataanalys utförd

## Nästa steg
Aktivera OpenAI-integration för att generera riktiga rapporter.

---
*Genererad i demo-läge*`,
  },

  NAV_CALC: {
    nav: 125000000,
    navPerShare: 1250.00,
    totalShares: 100000,
    calculations: {
      totalAssets: 130000000,
      totalLiabilities: 5000000,
      netAssets: 125000000,
    },
    flags: [
      {
        severity: 'info',
        message: 'Demo-värden - inte baserat på riktig data',
        code: 'DEMO_MODE',
      },
    ],
  },

  COMPLIANCE_CHECK: {
    compliant: true,
    score: 0.95,
    checks: [
      { name: 'Leverage limit', status: 'pass' },
      { name: 'Concentration risk', status: 'pass' },
      { name: 'Liquidity requirements', status: 'pass' },
    ],
    notes: 'Demo-kontroll - aktivera AI för fullständig analys',
  },
};

export async function POST(request: NextRequest) {
  try {
    const { taskKind, context } = await request.json();

    if (!taskKind) {
      return NextResponse.json(
        { error: 'taskKind is required' },
        { status: 400 }
      );
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get mock result based on task kind
    const result = MOCK_RESULTS[taskKind] || {
      status: 'completed',
      message: `Demo-resultat för ${taskKind}`,
      data: context,
      flags: [
        {
          severity: 'info',
          message: 'Demo-läge - ingen AI-analys utförd',
          code: 'DEMO_MODE',
        },
      ],
    };

    // Add metadata
    result._meta = {
      mode: 'demo',
      taskKind,
      timestamp: new Date().toISOString(),
      note: 'Aktivera OpenAI för riktig AI-bearbetning',
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('AI processing error:', error);
    return NextResponse.json(
      { error: 'AI processing failed', details: error?.message },
      { status: 500 }
    );
  }
}
