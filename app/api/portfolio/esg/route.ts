/**
 * Portfolio ESG API
 *
 * Aggregates ESG data across all approved securities in a fund.
 * Returns weighted average scores, exclusion violations, and PAI summary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getESGServiceClient } from '@/lib/integrations/esg/esg-service';
import type { NormalizedESGData } from '@/lib/integrations/esg/types';

/** Approved holding from DynamoDB or mock data */
interface HoldingInput {
  identifier: string; // ISIN or ticker
  name: string;
  weight: number; // portfolio weight 0-1
}

/** Per-holding ESG result */
export interface HoldingESGResult {
  identifier: string;
  name: string;
  weight: number;
  esg: NormalizedESGData | null;
  exclusionStatus: 'pass' | 'warning' | 'fail' | 'noData';
  exclusionNotes: string[];
}

/** Aggregated portfolio ESG */
export interface PortfolioESGSummary {
  fundId: string;
  /** Weighted average scores (null if insufficient data) */
  weightedEnvironmentScore: number | null;
  weightedSocialScore: number | null;
  weightedGovernanceScore: number | null;
  weightedTotalScore: number | null;
  /** Coverage: fraction of portfolio weight with ESG data */
  dataCoverage: number;
  /** Holdings count by exclusion status */
  exclusionSummary: {
    pass: number;
    warning: number;
    fail: number;
    noData: number;
  };
  /** Carbon intensity (weighted avg, if available) */
  weightedCarbonIntensity: number | null;
  /** Article distribution across holdings */
  sfdrDistribution: Record<string, number>;
  /** Individual holdings */
  holdings: HoldingESGResult[];
  /** Provider used */
  provider: string | null;
  /** Timestamp */
  generatedAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fundId, holdings } = body as { fundId: string; holdings: HoldingInput[] };

    if (!fundId || !holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return NextResponse.json(
        { error: 'fundId and holdings array are required' },
        { status: 400 }
      );
    }

    const esgClient = getESGServiceClient();
    const providerName = esgClient.getActiveProviderName();

    // Fetch ESG data for all holdings (uses cache + bulk if supported)
    const identifiers = holdings.map((h) => h.identifier);
    const esgDataMap = await esgClient.getBulkESGData(identifiers);

    // Build per-holding results and aggregate
    let weightedE = 0, weightedS = 0, weightedG = 0, weightedTotal = 0;
    let coveredWeight = 0;
    let weightedCarbon = 0;
    let carbonCoveredWeight = 0;
    const sfdrDist: Record<string, number> = {};
    const exclusionSummary = { pass: 0, warning: 0, fail: 0, noData: 0 };
    const holdingResults: HoldingESGResult[] = [];

    for (const h of holdings) {
      const esg = esgDataMap.get(h.identifier) ?? null;
      let exclusionStatus: HoldingESGResult['exclusionStatus'] = 'noData';
      const exclusionNotes: string[] = [];

      if (esg) {
        // Aggregate weighted scores
        if (esg.totalScore !== null) {
          weightedTotal += esg.totalScore * h.weight;
          coveredWeight += h.weight;
        }
        if (esg.environmentScore !== null) weightedE += esg.environmentScore * h.weight;
        if (esg.socialScore !== null) weightedS += esg.socialScore * h.weight;
        if (esg.governanceScore !== null) weightedG += esg.governanceScore * h.weight;

        // Carbon
        if (esg.carbonIntensity !== null && esg.carbonIntensity !== undefined) {
          weightedCarbon += esg.carbonIntensity * h.weight;
          carbonCoveredWeight += h.weight;
        }

        // SFDR distribution
        const alignment = esg.sfdrAlignment || 'not_disclosed';
        sfdrDist[alignment] = (sfdrDist[alignment] || 0) + 1;

        // Exclusion evaluation
        if (esg.exclusionFlags && esg.exclusionFlags.length > 0) {
          const hasHigh = esg.exclusionFlags.some(
            (f) => f.involvementLevel === 'high' || (f.revenuePercent !== undefined && f.revenuePercent > 5)
          );
          const hasMedium = esg.exclusionFlags.some(
            (f) => f.involvementLevel === 'medium' || (f.revenuePercent !== undefined && f.revenuePercent > 1)
          );
          if (hasHigh) {
            exclusionStatus = 'fail';
            esg.exclusionFlags
              .filter((f) => f.involvementLevel === 'high')
              .forEach((f) => exclusionNotes.push(f.categoryDescription));
          } else if (hasMedium) {
            exclusionStatus = 'warning';
            esg.exclusionFlags
              .filter((f) => f.involvementLevel === 'medium')
              .forEach((f) => exclusionNotes.push(f.categoryDescription));
          } else {
            exclusionStatus = 'pass';
          }
        } else if (esg.meetsExclusionCriteria === true) {
          exclusionStatus = 'pass';
        } else if (esg.meetsExclusionCriteria === false) {
          exclusionStatus = 'fail';
          exclusionNotes.push('Uppfyller inte exkluderingskriterier');
        } else {
          exclusionStatus = 'pass'; // No flags and no explicit failure
        }
      }

      exclusionSummary[exclusionStatus]++;

      holdingResults.push({
        identifier: h.identifier,
        name: h.name,
        weight: h.weight,
        esg,
        exclusionStatus,
        exclusionNotes,
      });
    }

    // Normalize weighted averages by covered weight
    const normalize = (val: number) => (coveredWeight > 0 ? val / coveredWeight : null);

    const summary: PortfolioESGSummary = {
      fundId,
      weightedEnvironmentScore: normalize(weightedE),
      weightedSocialScore: normalize(weightedS),
      weightedGovernanceScore: normalize(weightedG),
      weightedTotalScore: normalize(weightedTotal),
      dataCoverage: coveredWeight,
      exclusionSummary,
      weightedCarbonIntensity: carbonCoveredWeight > 0 ? weightedCarbon / carbonCoveredWeight : null,
      sfdrDistribution: sfdrDist,
      holdings: holdingResults,
      provider: providerName,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[Portfolio ESG] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate portfolio ESG summary' },
      { status: 500 }
    );
  }
}
