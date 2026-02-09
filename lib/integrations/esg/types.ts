/**
 * Provider-agnostic ESG data types and interface.
 * All consumers use these normalized types regardless of data source.
 */

/** Principal Adverse Impact indicator (SFDR) */
export interface PAIIndicator {
  name: string;
  value: number | string | null;
  unit?: string;
  description?: string;
}

/** Exclusion involvement from provider (e.g. revenue % in controversial activities) */
export interface ExclusionInvolvement {
  category: string;
  categoryDescription: string;
  revenuePercent?: number;
  involvementLevel?: 'none' | 'low' | 'medium' | 'high';
  details?: string;
}

/** Normalized ESG data returned by any provider */
export interface NormalizedESGData {
  /** Identifier used for lookup (ISIN or ticker depending on provider) */
  identifier: string;
  /** Normalized E/S/G scores 0-100; null if not available */
  environmentScore: number | null;
  socialScore: number | null;
  governanceScore: number | null;
  /** Overall ESG score 0-100 if provider supplies it */
  totalScore: number | null;
  /** Controversy level 0-5 (higher = worse) */
  controversyLevel: number | null;
  relatedControversies?: string[];
  /** Peer group percentile if available */
  percentile: number | null;
  peerGroup: string | null;

  /** SFDR / EU Taxonomy */
  sfdrAlignment?: 'article_6' | 'article_8' | 'article_9' | 'not_disclosed';
  taxonomyAlignmentPercent?: number | null;
  /** Carbon intensity (e.g. tCO2e per million EUR revenue) */
  carbonIntensity?: number | null;
  carbonIntensityUnit?: string;

  /** Exclusion screening result from provider */
  exclusionFlags?: ExclusionInvolvement[];
  /** Whether the security passes fund exclusion criteria (if criteria were applied) */
  meetsExclusionCriteria?: boolean;

  /** PAI indicators (SFDR) */
  paiIndicators?: PAIIndicator[];

  /** Provider metadata */
  provider: string;
  providerDataVersion?: string;
  fetchedAt: string; // ISO date
  /** Raw provider response for debugging/audit (optional) */
  raw?: unknown;
}

/** Result of exclusion screening (can be from provider or internal rules) */
export interface NormalizedExclusionScreening {
  identifier: string;
  excluded: boolean;
  reasons: string[];
  warnings: string[];
  involvement?: ExclusionInvolvement[];
  sector?: string;
  industry?: string;
  controversyLevel?: number;
  source: string;
  fetchedAt: string;
}

/** Provider interface: implement per data source (Yahoo, MSCI, etc.) */
export interface ESGDataProvider {
  readonly name: string;

  /**
   * Get normalized ESG data for a security.
   * @param identifier - ISIN or ticker (provider may resolve ISIN to ticker internally)
   */
  getESGData(identifier: string): Promise<NormalizedESGData | null>;

  /**
   * Get exclusion screening result for a security.
   */
  getExclusionScreening(identifier: string): Promise<NormalizedExclusionScreening | null>;

  /**
   * Get ESG data for multiple securities (batch; optional for providers that don't support it).
   */
  getBulkESGData?(identifiers: string[]): Promise<Map<string, NormalizedESGData | null>>;

  /**
   * Get PAI indicators for a security (SFDR).
   */
  getPAIIndicators?(identifier: string): Promise<PAIIndicator[] | null>;

  /**
   * Whether this provider is configured and available.
   */
  isAvailable(): boolean;
}
