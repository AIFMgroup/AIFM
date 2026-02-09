/**
 * Generic / Stub ESG Data Provider
 *
 * Skeleton adapter for an external ESG data provider (e.g. MSCI, Sustainalytics,
 * Refinitiv, ISS, or any other REST/GraphQL API).
 *
 * Configure via environment variables:
 *   ESG_PROVIDER_URL      - Base URL of the ESG data API
 *   ESG_PROVIDER_API_KEY  - API key / bearer token
 *   ESG_PROVIDER_NAME     - Display name (e.g. "MSCI ESG", "Sustainalytics")
 *
 * When the provider is decided, only this file needs to be completed.
 */

import type {
  ESGDataProvider,
  NormalizedESGData,
  NormalizedExclusionScreening,
  PAIIndicator,
  ExclusionInvolvement,
} from '../types';

export class GenericESGProvider implements ESGDataProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.name = process.env.ESG_PROVIDER_NAME || 'external_esg';
    this.baseUrl = process.env.ESG_PROVIDER_URL || '';
    this.apiKey = process.env.ESG_PROVIDER_API_KEY || '';
  }

  /** Provider is available only when URL and API key are configured */
  isAvailable(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  // ---------------------------------------------------------------------------
  // Core API
  // ---------------------------------------------------------------------------

  async getESGData(identifier: string): Promise<NormalizedESGData | null> {
    if (!this.isAvailable()) return null;

    try {
      // TODO: Replace with actual API endpoint and response mapping
      const response = await fetch(`${this.baseUrl}/esg/${encodeURIComponent(identifier)}`, {
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        console.warn(`[${this.name}] HTTP ${response.status} for ESG data: ${identifier}`);
        return null;
      }

      const raw = await response.json();

      // TODO: Map the provider's response to NormalizedESGData.
      // The mapping below is a placeholder -- replace field names with the
      // actual response schema once the API documentation is available.
      return this.mapESGResponse(identifier, raw);
    } catch (err) {
      console.error(`[${this.name}] getESGData error:`, err);
      return null;
    }
  }

  async getExclusionScreening(identifier: string): Promise<NormalizedExclusionScreening | null> {
    if (!this.isAvailable()) return null;

    try {
      // TODO: Replace with actual exclusion screening endpoint
      const response = await fetch(`${this.baseUrl}/screening/${encodeURIComponent(identifier)}`, {
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) return null;
      const raw = await response.json();

      return this.mapExclusionResponse(identifier, raw);
    } catch (err) {
      console.error(`[${this.name}] getExclusionScreening error:`, err);
      return null;
    }
  }

  async getBulkESGData(identifiers: string[]): Promise<Map<string, NormalizedESGData | null>> {
    const result = new Map<string, NormalizedESGData | null>();

    if (!this.isAvailable()) {
      identifiers.forEach((id) => result.set(id, null));
      return result;
    }

    try {
      // TODO: Replace with actual bulk endpoint if provider supports it.
      // Many providers accept a comma-separated list of ISINs.
      const response = await fetch(`${this.baseUrl}/esg/bulk`, {
        method: 'POST',
        headers: { ...this.buildHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        identifiers.forEach((id) => result.set(id, null));
        return result;
      }

      const raw = await response.json();

      // TODO: Iterate over response array and map each item
      // Placeholder: assume response is { items: [{ isin, ...esgFields }] }
      const items = Array.isArray(raw.items) ? raw.items : [];
      for (const item of items) {
        const id = item.isin || item.identifier;
        if (id) {
          result.set(id, this.mapESGResponse(id, item));
        }
      }

      // Mark missing identifiers as null
      for (const id of identifiers) {
        if (!result.has(id)) result.set(id, null);
      }
    } catch (err) {
      console.error(`[${this.name}] getBulkESGData error:`, err);
      identifiers.forEach((id) => result.set(id, null));
    }

    return result;
  }

  async getPAIIndicators(identifier: string): Promise<PAIIndicator[] | null> {
    if (!this.isAvailable()) return null;

    try {
      // TODO: Replace with actual PAI endpoint
      const response = await fetch(`${this.baseUrl}/pai/${encodeURIComponent(identifier)}`, {
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) return null;
      const raw = await response.json();

      return this.mapPAIResponse(raw);
    } catch (err) {
      console.error(`[${this.name}] getPAIIndicators error:`, err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
    };
  }

  /**
   * TODO: Map provider-specific ESG response to NormalizedESGData.
   * Replace the placeholder field names below with the actual API schema.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapESGResponse(identifier: string, raw: any): NormalizedESGData {
    return {
      identifier,
      // TODO: Replace with actual field mappings
      environmentScore: raw.environment_score ?? raw.environmentScore ?? null,
      socialScore: raw.social_score ?? raw.socialScore ?? null,
      governanceScore: raw.governance_score ?? raw.governanceScore ?? null,
      totalScore: raw.total_score ?? raw.totalScore ?? null,
      controversyLevel: raw.controversy_level ?? raw.controversyLevel ?? null,
      relatedControversies: raw.controversies ?? [],
      percentile: raw.percentile ?? null,
      peerGroup: raw.peer_group ?? raw.peerGroup ?? null,

      sfdrAlignment: raw.sfdr_alignment ?? raw.sfdrAlignment ?? undefined,
      taxonomyAlignmentPercent: raw.taxonomy_alignment_percent ?? raw.taxonomyAlignmentPercent ?? null,
      carbonIntensity: raw.carbon_intensity ?? raw.carbonIntensity ?? null,
      carbonIntensityUnit: raw.carbon_intensity_unit ?? 'tCO2e/MEUR revenue',

      exclusionFlags: this.mapExclusionFlags(raw.exclusion_flags || raw.exclusionFlags || []),
      meetsExclusionCriteria: raw.meets_exclusion_criteria ?? raw.meetsExclusionCriteria ?? undefined,

      paiIndicators: this.mapPAIResponse(raw.pai_indicators || raw.paiIndicators),

      provider: this.name,
      providerDataVersion: raw.data_version ?? raw.dataVersion ?? undefined,
      fetchedAt: new Date().toISOString(),
      raw,
    };
  }

  /**
   * TODO: Map provider exclusion screening response.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapExclusionResponse(identifier: string, raw: any): NormalizedExclusionScreening {
    return {
      identifier,
      excluded: raw.excluded ?? false,
      reasons: raw.reasons ?? [],
      warnings: raw.warnings ?? [],
      involvement: this.mapExclusionFlags(raw.involvement || []),
      sector: raw.sector ?? undefined,
      industry: raw.industry ?? undefined,
      controversyLevel: raw.controversy_level ?? raw.controversyLevel ?? undefined,
      source: this.name,
      fetchedAt: new Date().toISOString(),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapExclusionFlags(flags: any[]): ExclusionInvolvement[] {
    if (!Array.isArray(flags)) return [];
    return flags.map((f) => ({
      category: f.category ?? 'unknown',
      categoryDescription: f.category_description ?? f.categoryDescription ?? f.category ?? '',
      revenuePercent: f.revenue_percent ?? f.revenuePercent ?? undefined,
      involvementLevel: f.involvement_level ?? f.involvementLevel ?? undefined,
      details: f.details ?? undefined,
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapPAIResponse(indicators: any): PAIIndicator[] | undefined {
    if (!Array.isArray(indicators)) return undefined;
    return indicators.map((i) => ({
      name: i.name ?? i.indicator_name ?? '',
      value: i.value ?? null,
      unit: i.unit ?? undefined,
      description: i.description ?? undefined,
    }));
  }
}
