/**
 * Yahoo Finance ESG Provider
 *
 * Wraps the existing Yahoo Finance ESG logic and maps it to
 * the provider-agnostic NormalizedESGData format.
 *
 * Yahoo Finance data quality is limited (often missing, no SLA).
 * This adapter exists for backward compatibility and as a fallback
 * until a dedicated ESG data provider is connected.
 */

import type {
  ESGDataProvider,
  NormalizedESGData,
  NormalizedExclusionScreening,
  ExclusionInvolvement,
} from '../types';
import {
  ESG_EXCLUSION_LIST,
  checkExclusions,
} from '../../securities/esg-data';

const YAHOO_QUOTESUMMARY_URL = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary';

export class YahooFinanceESGProvider implements ESGDataProvider {
  readonly name = 'yahoo_finance';

  isAvailable(): boolean {
    // Yahoo Finance is a free public API; always available as fallback
    return true;
  }

  async getESGData(identifier: string): Promise<NormalizedESGData | null> {
    try {
      const url = `${YAHOO_QUOTESUMMARY_URL}/${encodeURIComponent(identifier)}?modules=esgScores,assetProfile`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIFM/1.0)',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        console.warn(`[Yahoo ESG] HTTP ${response.status} for ${identifier}`);
        return null;
      }

      const json = await response.json();
      const result = json.quoteSummary?.result?.[0];
      const esgData = result?.esgScores;
      const profile = result?.assetProfile;

      if (!esgData) {
        console.log(`[Yahoo ESG] No ESG data for ${identifier}`);
        return null;
      }

      // Map Yahoo's risk scores (lower = better) to our 0-100 scale.
      // Yahoo totalEsg is a risk score (0-50+, lower better).
      // We invert to a "quality" scale: 100 - score, clamped to [0, 100].
      const totalRisk = esgData.totalEsg?.raw ?? null;
      const envRisk = esgData.environmentScore?.raw ?? null;
      const socRisk = esgData.socialScore?.raw ?? null;
      const govRisk = esgData.governanceScore?.raw ?? null;

      const invertScore = (risk: number | null): number | null => {
        if (risk === null) return null;
        return Math.max(0, Math.min(100, 100 - risk));
      };

      const normalized: NormalizedESGData = {
        identifier,
        environmentScore: invertScore(envRisk),
        socialScore: invertScore(socRisk),
        governanceScore: invertScore(govRisk),
        totalScore: invertScore(totalRisk),
        controversyLevel: esgData.highestControversy ?? null,
        relatedControversies: esgData.relatedControversy ?? [],
        percentile: esgData.percentile?.raw ?? null,
        peerGroup: esgData.peerGroup ?? null,

        // Yahoo doesn't provide SFDR / taxonomy data
        sfdrAlignment: undefined,
        taxonomyAlignmentPercent: null,
        carbonIntensity: null,

        // Build exclusion flags from sector/industry
        exclusionFlags: this.buildExclusionFlags(profile),

        provider: this.name,
        fetchedAt: new Date().toISOString(),
        raw: { esgScores: esgData, sector: profile?.sector, industry: profile?.industry },
      };

      return normalized;
    } catch (err) {
      console.error('[Yahoo ESG] Fetch error:', err);
      return null;
    }
  }

  async getExclusionScreening(identifier: string): Promise<NormalizedExclusionScreening | null> {
    try {
      const url = `${YAHOO_QUOTESUMMARY_URL}/${encodeURIComponent(identifier)}?modules=assetProfile,esgScores`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIFM/1.0)' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) return null;

      const json = await response.json();
      const result = json.quoteSummary?.result?.[0];
      const profile = result?.assetProfile;
      const esgData = result?.esgScores;

      const sector = profile?.sector as string | undefined;
      const industry = profile?.industry as string | undefined;
      const name = profile?.longName || profile?.shortName || identifier;
      const controversy = esgData?.highestControversy ?? undefined;

      // Re-use existing exclusion logic
      const check = checkExclusions(sector, industry, name, controversy);

      return {
        identifier,
        excluded: check.excluded,
        reasons: check.reasons,
        warnings: check.warnings,
        involvement: this.buildExclusionFlags(profile),
        sector,
        industry,
        controversyLevel: controversy,
        source: this.name,
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildExclusionFlags(profile?: Record<string, unknown>): ExclusionInvolvement[] {
    if (!profile) return [];
    const flags: ExclusionInvolvement[] = [];
    const sector = ((profile.sector as string) || '').toLowerCase();
    const industry = ((profile.industry as string) || '').toLowerCase();

    for (const [key, cat] of Object.entries(ESG_EXCLUSION_LIST)) {
      const match = cat.keywords.some(
        (kw) => sector.includes(kw.toLowerCase()) || industry.includes(kw.toLowerCase())
      );
      if (match) {
        flags.push({
          category: key,
          categoryDescription: cat.description,
          involvementLevel: cat.severity === 'high' ? 'high' : cat.severity === 'medium' ? 'medium' : 'low',
        });
      }
    }

    return flags;
  }
}
