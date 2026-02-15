/**
 * LSEG / Refinitiv ESG Data Provider
 *
 * Integrates with the LSEG Data Platform (Refinitiv) REST API to provide
 * ESG scores, controversy data, exclusion screening, PAI indicators,
 * carbon metrics, and SFDR alignment.
 *
 * Configure via environment variables:
 *   LSEG_API_KEY      - API key / App Key for LSEG Data Platform
 *   LSEG_API_SECRET   - Corresponding secret (used for OAuth2 token)
 *   LSEG_API_URL      - Base URL (default: https://api.refinitiv.com)
 *
 * LSEG endpoints used:
 *   - /data/environmental-social-governance/v2/views/scores-full?universe=<ISIN>
 *   - /data/environmental-social-governance/v2/views/measures-full?universe=<ISIN>
 *
 * See: https://developers.lseg.com/en/api-catalog/refinitiv-data-platform/esg-data-api
 */

import type {
  ESGDataProvider,
  NormalizedESGData,
  NormalizedExclusionScreening,
  PAIIndicator,
  ExclusionInvolvement,
} from '../types';

// ============================================================================
// LSEG API response shapes (simplified)
// ============================================================================

interface LSEGESGScore {
  instrument: string;
  esgScore?: number;
  esgCombinedScore?: number;
  environmentPillarScore?: number;
  socialPillarScore?: number;
  governancePillarScore?: number;
  esgControversiesScore?: number;
  co2EmissionTotal?: number;
  co2DirectScope1?: number;
  co2IndirectScope2?: number;
  co2IndirectScope3?: number;
  carbonIntensity?: number; // tCO2e / M$ revenue
  // Controversy categories
  controversies?: {
    category: string;
    count: number;
    significance: string;
  }[];
  // Business involvement flags
  alcoholProduction?: boolean;
  tobaccoProduction?: boolean;
  gamblingOperations?: boolean;
  weaponsProduction?: boolean;
  controversialWeapons?: boolean;
  thermalCoalRevenue?: number;
  fossilFuelInvolvement?: boolean;
  nuclearPower?: boolean;
  // Industry/sector
  trbc?: { industry?: string; sector?: string };
}

// ============================================================================
// Provider Implementation
// ============================================================================

export class LSEGESGProvider implements ESGDataProvider {
  readonly name = 'LSEG';

  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.apiKey = process.env.LSEG_API_KEY ?? '';
    this.apiSecret = process.env.LSEG_API_SECRET ?? '';
    this.baseUrl = process.env.LSEG_API_URL ?? 'https://api.refinitiv.com';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  // --------------------------------------------------------------------------
  // Auth (OAuth2 client-credentials flow)
  // --------------------------------------------------------------------------

  private async ensureAuth(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 30_000) {
      return this.accessToken;
    }
    const res = await fetch(`${this.baseUrl}/auth/oauth2/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.apiKey,
        client_secret: this.apiSecret,
        scope: 'trapi',
      }),
    });
    if (!res.ok) {
      throw new Error(`LSEG auth failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in ?? 600) * 1000;
    return this.accessToken!;
  }

  private async apiGet<T>(path: string): Promise<T> {
    const token = await this.ensureAuth();
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`LSEG API ${path}: ${res.status}`);
    return res.json() as Promise<T>;
  }

  // --------------------------------------------------------------------------
  // ESG Data
  // --------------------------------------------------------------------------

  async getESGData(identifier: string): Promise<NormalizedESGData | null> {
    if (!this.isAvailable()) return null;

    try {
      const raw = await this.apiGet<{ data?: LSEGESGScore[] }>(
        `/data/environmental-social-governance/v2/views/scores-full?universe=${encodeURIComponent(identifier)}`
      );
      const item = raw.data?.[0];
      if (!item) return null;

      const exclusionFlags = this.buildExclusionFlags(item);
      const controversyLevel = item.esgControversiesScore != null
        ? Math.round((100 - item.esgControversiesScore) / 20) // 0-5 scale from 0-100
        : null;

      return {
        identifier,
        environmentScore: item.environmentPillarScore ?? null,
        socialScore: item.socialPillarScore ?? null,
        governanceScore: item.governancePillarScore ?? null,
        totalScore: item.esgCombinedScore ?? item.esgScore ?? null,
        controversyLevel,
        relatedControversies: item.controversies?.map(c => c.category),
        percentile: null, // LSEG provides grades; map to percentile if needed
        peerGroup: item.trbc?.industry ?? null,
        sfdrAlignment: undefined, // LSEG doesn't directly classify SFDR article; derive externally
        taxonomyAlignmentPercent: null,
        carbonIntensity: item.carbonIntensity ?? null,
        carbonIntensityUnit: 'tCO2e/M$ revenue',
        exclusionFlags,
        meetsExclusionCriteria: exclusionFlags.every(f => (f.revenuePercent ?? 0) === 0 && f.involvementLevel === 'none'),
        paiIndicators: this.buildPAIIndicators(item),
        provider: 'LSEG',
        fetchedAt: new Date().toISOString(),
        raw: item,
      };
    } catch (err) {
      console.error('[LSEG ESG] getESGData error:', err);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Exclusion Screening
  // --------------------------------------------------------------------------

  async getExclusionScreening(identifier: string): Promise<NormalizedExclusionScreening | null> {
    const esg = await this.getESGData(identifier);
    if (!esg) return null;

    const flags = esg.exclusionFlags ?? [];
    const excluded = flags.some(f => (f.revenuePercent ?? 0) > 0 || f.involvementLevel === 'high');
    return {
      identifier,
      excluded,
      reasons: flags.filter(f => (f.revenuePercent ?? 0) > 0 || f.involvementLevel !== 'none').map(f => f.categoryDescription),
      warnings: flags.filter(f => f.involvementLevel === 'medium').map(f => f.categoryDescription),
      involvement: flags,
      sector: esg.peerGroup ?? undefined,
      controversyLevel: esg.controversyLevel ?? undefined,
      source: 'LSEG',
      fetchedAt: esg.fetchedAt,
    };
  }

  // --------------------------------------------------------------------------
  // PAI Indicators
  // --------------------------------------------------------------------------

  async getPAIIndicators(identifier: string): Promise<PAIIndicator[] | null> {
    const esg = await this.getESGData(identifier);
    if (!esg) return null;
    return esg.paiIndicators ?? null;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private buildExclusionFlags(item: LSEGESGScore): ExclusionInvolvement[] {
    const flags: ExclusionInvolvement[] = [];
    const add = (category: string, desc: string, involved: boolean | undefined, revPct?: number) => {
      flags.push({
        category,
        categoryDescription: desc,
        revenuePercent: revPct ?? (involved ? 100 : 0),
        involvementLevel: involved ? 'high' : 'none',
      });
    };
    add('controversial_weapons', 'Kontroversiella vapen', item.controversialWeapons);
    add('weapons', 'Vapenproduktion', item.weaponsProduction);
    add('tobacco', 'Tobaksproduktion', item.tobaccoProduction);
    add('alcohol', 'Alkoholproduktion', item.alcoholProduction);
    add('gambling', 'Spelverksamhet', item.gamblingOperations);
    add('thermal_coal', 'Termiskt kol', undefined, item.thermalCoalRevenue);
    add('fossil_fuels', 'Fossila bränslen', item.fossilFuelInvolvement);
    add('nuclear_power', 'Kärnkraft', item.nuclearPower);
    return flags;
  }

  private buildPAIIndicators(item: LSEGESGScore): PAIIndicator[] {
    const pai: PAIIndicator[] = [];
    if (item.co2EmissionTotal != null) {
      pai.push({ name: 'GHG Emissions Total', value: item.co2EmissionTotal, unit: 'tCO2e', description: 'Scope 1+2+3' });
    }
    if (item.co2DirectScope1 != null) {
      pai.push({ name: 'GHG Scope 1', value: item.co2DirectScope1, unit: 'tCO2e' });
    }
    if (item.co2IndirectScope2 != null) {
      pai.push({ name: 'GHG Scope 2', value: item.co2IndirectScope2, unit: 'tCO2e' });
    }
    if (item.carbonIntensity != null) {
      pai.push({ name: 'Carbon Intensity', value: item.carbonIntensity, unit: 'tCO2e/M$ revenue' });
    }
    if (item.thermalCoalRevenue != null) {
      pai.push({ name: 'Share of Thermal Coal Revenue', value: item.thermalCoalRevenue, unit: '%' });
    }
    return pai;
  }
}
