import { NextRequest, NextResponse } from 'next/server';

/**
 * AI Report Generation API - DEMO MODE
 * Returns mock reports for demonstration purposes
 * Replace with real OpenAI integration when going to production
 */

const MOCK_REPORTS: Record<string, string> = {
  quarterly: `# Quarterly Fund Report - Q4 2024

## Executive Summary
This report provides a comprehensive overview of fund performance during Q4 2024.

## Performance Highlights
- **Total AUM**: SEK 2.5 billion
- **Quarterly Return**: +3.2%
- **YTD Return**: +12.8%

## Portfolio Allocation
| Asset Class | Allocation | Change |
|-------------|------------|--------|
| Equities | 65% | +2% |
| Fixed Income | 25% | -1% |
| Alternatives | 8% | -1% |
| Cash | 2% | 0% |

## Risk Metrics
- Sharpe Ratio: 1.45
- Max Drawdown: -4.2%
- Volatility: 8.3%

## Compliance Status
All regulatory requirements met. No breaches reported.

---
*This is a demo report generated for demonstration purposes.*`,

  annual: `# Annual Fund Report - 2024

## Year in Review
The fund delivered strong performance throughout 2024, outperforming benchmark by 2.3%.

## Key Achievements
1. Successfully completed 3 new fund launches
2. AUM growth of 18%
3. Zero compliance breaches
4. Implemented new ESG framework

## Financial Summary
- Opening NAV: SEK 2.1 billion
- Closing NAV: SEK 2.5 billion
- Total distributions: SEK 45 million

---
*This is a demo report generated for demonstration purposes.*`,

  compliance: `# Compliance Report

## Regulatory Status: ✅ COMPLIANT

### Checks Performed
- [x] AIF Directive compliance
- [x] UCITS requirements
- [x] Risk limits
- [x] Leverage ratios
- [x] Investor eligibility

### No issues found

---
*This is a demo report generated for demonstration purposes.*`,
};

export async function POST(request: NextRequest) {
  try {
    const { clientName, reportType } = await request.json();

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get mock report based on type
    const reportKey = reportType?.toLowerCase() || 'quarterly';
    let content = MOCK_REPORTS[reportKey] || MOCK_REPORTS.quarterly;

    // Personalize with client name if provided
    if (clientName) {
      content = content.replace(/Fund Report/g, `${clientName} Fund Report`);
    }

    // Add timestamp
    content += `\n\n*Generated: ${new Date().toISOString()}*`;

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'Report generation failed' },
      { status: 500 }
    );
  }
}
