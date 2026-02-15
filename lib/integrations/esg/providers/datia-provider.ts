/**
 * Datia ESG Data Provider
 *
 * Integrates with Datia ECO API (https://docs.datia.app/) to provide
 * ESG scores, exclusion screening (business involvements), PAI indicators,
 * SFDR sustainability profiles, and taxonomy alignment data.
 *
 * Configure via environment variables:
 *   DATIA_API_KEY   - x-api-key header value
 *   DATIA_API_URL   - Base URL (default: https://eco.datia.app)
 *
 * All Datia endpoints accept a list of holdings (by ISIN), making bulk
 * operations efficient (single HTTP call per endpoint).
 */

import type {
  ESGDataProvider,
  NormalizedESGData,
  NormalizedExclusionScreening,
  PAIIndicator,
  ExclusionInvolvement,
} from '../types';

// ---------------------------------------------------------------------------
// Datia response shapes (derived from live API responses 2026-02)
// ---------------------------------------------------------------------------

/** Datia returns metric values as { value, unit } objects */
interface DatiaMetric {
  value: number | boolean | null;
  unit?: string;
}

/** Shape returned by POST /instruments/esg-data */
interface DatiaESGItem {
  metadata?: { is_fund?: boolean; isin?: string };
  sustainability_data?: {
    total_score?: DatiaMetric;
    environment_score?: DatiaMetric;
    social_score?: DatiaMetric;
    governance_score?: DatiaMetric;
    carbon_footprint?: DatiaMetric;
    co2_and_equivalents_totals_by_revenue_or_sales?: DatiaMetric;
    [key: string]: DatiaMetric | undefined;
  };
}

/** Shape returned by POST /instruments/sustainability-profile */
interface DatiaSustainabilityProfileItem {
  isin?: string;
  sustainability_profile?: {
    classification?: number; // 6, 8, or 9
    description?: string;
    metadata?: Record<string, unknown> | null;
  };
}

/**
 * Shape returned by POST /instruments/business-involvements.
 * business_involvements is an **object** keyed by category name,
 * each value being { weight: 0-100, count: number }.
 */
interface DatiaBusinessInvolvementsItem {
  metadata?: { isin?: string; is_fund?: boolean };
  sustainability_data?: {
    total_score?: number;
    environment_score?: number;
    social_score?: number;
    governance_score?: number;
    business_involvements?: Record<string, { weight?: number; count?: number }>;
  };
}

/** Flattened involvement for internal use */
interface FlatInvolvement {
  category: string;
  weight: number;  // 0-100 (percent)
  count: number;
}

/** Shape returned by POST /instruments/sustainability-data (PAI) */
interface DatiaPAIItem {
  metadata?: { is_fund?: boolean; isin?: string };
  sustainability_data?: Record<string, DatiaMetric | undefined>;
}

/** Shape returned by POST /taxonomy/insights */
interface DatiaTaxonomyItem {
  isin?: string;
  'taxonomy_alignment_%'?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

export class DatiaESGProvider implements ESGDataProvider {
  readonly name = 'Datia';
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = (process.env.DATIA_API_URL || 'https://eco.datia.app').replace(/\/+$/, '');
    this.apiKey = process.env.DATIA_API_KEY || '';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  // ---------------------------------------------------------------------------
  // Core API — single ISIN
  // ---------------------------------------------------------------------------

  async getESGData(identifier: string): Promise<NormalizedESGData | null> {
    if (!this.isAvailable()) return null;

    try {
      const [esgResult, profileResult, invResult, taxResult] = await Promise.allSettled([
        this.fetchESGScores([identifier]),
        this.fetchSustainabilityProfiles([identifier]),
        this.fetchBusinessInvolvements([identifier]),
        this.fetchTaxonomyInsights([identifier]),
      ]);

      return this.buildNormalized(
        identifier,
        esgResult.status === 'fulfilled' ? esgResult.value.get(identifier) ?? null : null,
        profileResult.status === 'fulfilled' ? profileResult.value.get(identifier) ?? null : null,
        invResult.status === 'fulfilled' ? invResult.value.get(identifier) ?? null : null,
        taxResult.status === 'fulfilled' ? taxResult.value.get(identifier) ?? null : null,
      );
    } catch (err) {
      console.error(`[Datia] getESGData error for ${identifier}:`, err);
      return null;
    }
  }

  async getExclusionScreening(identifier: string): Promise<NormalizedExclusionScreening | null> {
    if (!this.isAvailable()) return null;
    try {
      const map = await this.fetchBusinessInvolvements([identifier]);
      return this.buildExclusionScreening(identifier, map.get(identifier) ?? []);
    } catch (err) {
      console.error(`[Datia] getExclusionScreening error for ${identifier}:`, err);
      return null;
    }
  }

  async getPAIIndicators(identifier: string): Promise<PAIIndicator[] | null> {
    if (!this.isAvailable()) return null;
    try {
      const map = await this.fetchPAIData([identifier]);
      return map.get(identifier) ?? null;
    } catch (err) {
      console.error(`[Datia] getPAIIndicators error for ${identifier}:`, err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Bulk API — all Datia endpoints are bulk-native
  // ---------------------------------------------------------------------------

  async getBulkESGData(identifiers: string[]): Promise<Map<string, NormalizedESGData | null>> {
    const result = new Map<string, NormalizedESGData | null>();
    if (!this.isAvailable() || identifiers.length === 0) {
      identifiers.forEach((id) => result.set(id, null));
      return result;
    }

    try {
      const [esgResult, profileResult, invResult, taxResult] = await Promise.allSettled([
        this.fetchESGScores(identifiers),
        this.fetchSustainabilityProfiles(identifiers),
        this.fetchBusinessInvolvements(identifiers),
        this.fetchTaxonomyInsights(identifiers),
      ]);

      const esgMap = esgResult.status === 'fulfilled' ? esgResult.value : new Map<string, DatiaESGItem>();
      const profileMap = profileResult.status === 'fulfilled' ? profileResult.value : new Map<string, DatiaSustainabilityProfileItem>();
      const invMap = invResult.status === 'fulfilled' ? invResult.value : new Map<string, FlatInvolvement[]>();
      const taxMap = taxResult.status === 'fulfilled' ? taxResult.value : new Map<string, DatiaTaxonomyItem>();

      for (const id of identifiers) {
        result.set(id, this.buildNormalized(
          id,
          esgMap.get(id) ?? null,
          profileMap.get(id) ?? null,
          invMap.get(id) ?? null,
          taxMap.get(id) ?? null,
        ));
      }
    } catch (err) {
      console.error('[Datia] getBulkESGData error:', err);
      identifiers.forEach((id) => result.set(id, null));
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Datia HTTP calls
  // ---------------------------------------------------------------------------

  private headers(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private simpleHoldings(ids: string[]) {
    return ids.map((isin) => ({ isin }));
  }

  /** POST /instruments/esg-data */
  private async fetchESGScores(ids: string[]): Promise<Map<string, DatiaESGItem>> {
    const out = new Map<string, DatiaESGItem>();
    const res = await fetch(`${this.baseUrl}/instruments/esg-data`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ holdings: this.simpleHoldings(ids) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { console.warn(`[Datia] esg-data HTTP ${res.status}`); return out; }
    const body = await res.json();
    for (const item of (body?.data ?? []) as DatiaESGItem[]) {
      const isin = item.metadata?.isin;
      if (isin) out.set(isin, item);
    }
    return out;
  }

  /** POST /instruments/sustainability-profile */
  private async fetchSustainabilityProfiles(ids: string[]): Promise<Map<string, DatiaSustainabilityProfileItem>> {
    const out = new Map<string, DatiaSustainabilityProfileItem>();
    const res = await fetch(`${this.baseUrl}/instruments/sustainability-profile`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ holdings: this.simpleHoldings(ids) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { console.warn(`[Datia] sustainability-profile HTTP ${res.status}`); return out; }
    const body = await res.json();
    for (const item of (body?.data ?? []) as DatiaSustainabilityProfileItem[]) {
      if (item.isin) out.set(item.isin, item);
    }
    return out;
  }

  /** POST /instruments/business-involvements → flattened to FlatInvolvement[] per ISIN */
  private async fetchBusinessInvolvements(ids: string[]): Promise<Map<string, FlatInvolvement[]>> {
    const out = new Map<string, FlatInvolvement[]>();
    const res = await fetch(`${this.baseUrl}/instruments/business-involvements`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ minimum_threshold: 0, holdings: this.simpleHoldings(ids) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { console.warn(`[Datia] business-involvements HTTP ${res.status}`); return out; }
    const body = await res.json();

    for (const item of (body?.data ?? []) as DatiaBusinessInvolvementsItem[]) {
      const isin = item.metadata?.isin;
      if (!isin) continue;

      const biObj = item.sustainability_data?.business_involvements;
      if (!biObj || typeof biObj !== 'object') { out.set(isin, []); continue; }

      const flat: FlatInvolvement[] = Object.entries(biObj).map(([cat, v]) => ({
        category: cat,
        weight: v?.weight ?? 0,
        count: v?.count ?? 0,
      }));
      out.set(isin, flat);
    }
    return out;
  }

  /** POST /instruments/sustainability-data (PAI indicators) */
  private async fetchPAIData(ids: string[]): Promise<Map<string, PAIIndicator[]>> {
    const out = new Map<string, PAIIndicator[]>();
    const res = await fetch(`${this.baseUrl}/instruments/sustainability-data`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ holdings: this.simpleHoldings(ids) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { console.warn(`[Datia] sustainability-data HTTP ${res.status}`); return out; }
    const body = await res.json();

    for (const item of (body?.data ?? []) as DatiaPAIItem[]) {
      const isin = item.metadata?.isin;
      if (!isin) continue;

      const sd = item.sustainability_data ?? {};
      const indicators: PAIIndicator[] = [];
      for (const [key, metric] of Object.entries(sd)) {
        if (!metric || metric.value === undefined) continue;
        indicators.push({
          name: this.formatIndicatorName(key),
          value: typeof metric.value === 'boolean' ? (metric.value ? 'Yes' : 'No') : metric.value,
          unit: metric.unit || undefined,
          description: key,
        });
      }
      out.set(isin, indicators);
    }
    return out;
  }

  /** POST /taxonomy/insights */
  private async fetchTaxonomyInsights(ids: string[]): Promise<Map<string, DatiaTaxonomyItem>> {
    const out = new Map<string, DatiaTaxonomyItem>();
    const holdings = ids.map((isin) => ({
      isin,
      name: '',
      instrument_type: 'stock' as const,
      currency: 'EUR',
      market_value: 0,
    }));
    const res = await fetch(`${this.baseUrl}/taxonomy/insights`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ holdings }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      if (res.status !== 404) console.warn(`[Datia] taxonomy/insights HTTP ${res.status}`);
      return out;
    }
    const body = await res.json();
    for (const item of (body?.data ?? []) as DatiaTaxonomyItem[]) {
      if (item.isin) out.set(item.isin as string, item);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Normalization / mapping
  // ---------------------------------------------------------------------------

  /** Extract numeric value from Datia metric object */
  private metricValue(m: DatiaMetric | undefined | null): number | null {
    if (!m || m.value === null || m.value === undefined || typeof m.value === 'boolean') return null;
    return m.value;
  }

  private buildNormalized(
    identifier: string,
    esgItem: DatiaESGItem | null,
    profile: DatiaSustainabilityProfileItem | null,
    involvements: FlatInvolvement[] | null,
    taxonomy: DatiaTaxonomyItem | null,
  ): NormalizedESGData {
    const sd = esgItem?.sustainability_data;

    // Scores are already 0-100 per dimension from Datia
    const envScore = this.metricValue(sd?.environment_score);
    const socScore = this.metricValue(sd?.social_score);
    const govScore = this.metricValue(sd?.governance_score);
    // total_score is out of 300 (E+S+G), normalize to 0-100
    const rawTotal = this.metricValue(sd?.total_score);
    const totalScore = rawTotal !== null ? Math.round((rawTotal / 300) * 100) : null;

    // Carbon intensity from ESG endpoint
    const carbonIntensity = this.metricValue(sd?.co2_and_equivalents_totals_by_revenue_or_sales);
    const carbonUnit = sd?.co2_and_equivalents_totals_by_revenue_or_sales?.unit || 'tonnes/M€ revenue';

    // SFDR classification
    const sfdrClass = profile?.sustainability_profile?.classification;
    const sfdrAlignment: NormalizedESGData['sfdrAlignment'] =
      sfdrClass === 9 ? 'article_9'
        : sfdrClass === 8 ? 'article_8'
          : sfdrClass === 6 ? 'article_6'
            : 'not_disclosed';

    // Taxonomy
    const taxonomyPercent = taxonomy?.['taxonomy_alignment_%'];

    // Exclusion: any involvement with weight > 0 fails
    const exclusionFlags = this.mapInvolvements(involvements);
    const meetsExclusion = involvements
      ? involvements.every((i) => i.weight === 0)
      : undefined;

    return {
      identifier,
      environmentScore: envScore !== null ? Math.round(envScore) : null,
      socialScore: socScore !== null ? Math.round(socScore) : null,
      governanceScore: govScore !== null ? Math.round(govScore) : null,
      totalScore,
      controversyLevel: null,
      relatedControversies: [],
      percentile: null,
      peerGroup: null,

      sfdrAlignment,
      taxonomyAlignmentPercent: typeof taxonomyPercent === 'number' ? taxonomyPercent : null,
      carbonIntensity: carbonIntensity,
      carbonIntensityUnit: carbonUnit,

      exclusionFlags,
      meetsExclusionCriteria: meetsExclusion,

      paiIndicators: undefined, // fetched separately via getPAIIndicators()

      provider: this.name,
      providerDataVersion: undefined,
      fetchedAt: new Date().toISOString(),
      raw: { esg: esgItem, profile, involvements, taxonomy },
    };
  }

  private buildExclusionScreening(
    identifier: string,
    involvements: FlatInvolvement[],
  ): NormalizedExclusionScreening {
    const flagged = involvements.filter((i) => i.weight > 0);
    return {
      identifier,
      excluded: flagged.length > 0,
      reasons: flagged.map(
        (i) => `${this.formatIndicatorName(i.category)}: ${i.weight.toFixed(1)}% revenue involvement`,
      ),
      warnings: involvements
        .filter((i) => i.weight > 0 && i.weight < 5)
        .map((i) => `Low involvement in ${this.formatIndicatorName(i.category)}: ${i.weight.toFixed(1)}%`),
      involvement: this.mapInvolvements(involvements),
      sector: undefined,
      industry: undefined,
      controversyLevel: undefined,
      source: this.name,
      fetchedAt: new Date().toISOString(),
    };
  }

  private mapInvolvements(involvements: FlatInvolvement[] | null): ExclusionInvolvement[] {
    if (!involvements) return [];
    return involvements.map((i) => ({
      category: i.category,
      categoryDescription: this.formatIndicatorName(i.category),
      revenuePercent: i.weight,
      involvementLevel:
        i.weight === 0 ? 'none' as const
          : i.weight < 5 ? 'low' as const
            : i.weight < 20 ? 'medium' as const
              : 'high' as const,
      details: i.count > 0 ? `${i.count} compan${i.count === 1 ? 'y' : 'ies'} involved` : undefined,
    }));
  }

  /** Format a snake_case key to a readable name */
  private formatIndicatorName(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }
}
