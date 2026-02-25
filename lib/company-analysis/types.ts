/**
 * Complete Company Analysis Types
 *
 * Aggregates all data sources: lookup, market, ESG, compliance, documents, news, AI analysis.
 */

import type { EnrichedSecurityData } from '../integrations/securities/enriched-lookup';
import type {
  NormalizedESGData,
  NormalizedExclusionScreening,
  PAIIndicator,
} from '../integrations/esg/types';
import type { HoldingDocument } from '../holding-documents/holding-document-store';
import type {
  RegulatoryFFFS,
  RegulatoryLVF,
  LiquidityAnalysis,
  ValuationInfo,
  FundComplianceCheck,
  ESGInfo,
} from '../integrations/securities/types';
import type { NewsArticle } from '../integrations/market-data/market-data-client';

// ---------------------------------------------------------------------------
// Section 1: Identification & Lookup
// ---------------------------------------------------------------------------

export interface IdentificationSection {
  /** Enriched lookup result (OpenFIGI + GLEIF + Yahoo) */
  lookup?: EnrichedSecurityData;
  companyName?: string;
  ticker?: string;
  isin?: string;
  sector?: string;
  industry?: string;
  country?: string;
  exchange?: string;
  currency?: string;
  emitter?: string;
  emitterLEI?: string;
}

// ---------------------------------------------------------------------------
// Section 2: Market Data
// ---------------------------------------------------------------------------

export interface MarketDataSection {
  currentPrice?: number;
  marketCap?: number;
  currency?: string;
  averageDailyVolume?: number;
  averageDailyValueSEK?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  priceVs52wRange?: string;
  exchange?: string;
  isRegulatedMarket?: boolean;
  listingType?: string;
  /** From enriched lookup liquidity */
  meetsLiquidityPresumption?: boolean;
  estimatedLiquidationDays?: number;
  liquidityCategory?: string;
  /** Detailed financial ratios (Yahoo Finance) */
  peRatio?: number;
  forwardPE?: number;
  pbRatio?: number;
  evToEbitda?: number;
  dividendYield?: number;
  returnOnEquity?: number;
  profitMargin?: number;
  operatingMargin?: number;
  debtToEquity?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  beta?: number;
  fiftyDayMA?: number;
  twoHundredDayMA?: number;
}

// ---------------------------------------------------------------------------
// Section 3: ESG & Sustainability
// ---------------------------------------------------------------------------

/** GHG emissions data (Scope 1/2/3, intensity) */
export interface GHGEmissions {
  scope1?: number;
  scope2?: number;
  scope3?: number;
  totalEmissions?: number;
  carbonIntensity?: number;
  unit?: string;
}

export interface ESGSection {
  esg?: NormalizedESGData | null;
  exclusionScreening?: NormalizedExclusionScreening | null;
  paiIndicators?: PAIIndicator[] | null;
  /** Provider used (Datia, LSEG, Yahoo) */
  provider?: string;
  /** Fund-specific ESG decision if fundId was provided */
  esgDecision?: 'approved' | 'rejected';
  esgDecisionMotivation?: string;
  /** Detailed GHG emissions (LSEG/Datia) */
  ghgEmissions?: GHGEmissions;
  /** EU Taxonomy alignment (e.g. percentage) */
  taxonomyAlignment?: number;
  /** Business involvement flags (weapons, tobacco, fossil fuels, etc.) */
  businessInvolvements?: Record<string, boolean>;
  /** AI-generated Do No Significant Harm assessment */
  dnshAssessment?: string;
  /** AI-generated Good Governance check */
  goodGovernanceCheck?: string;
}

// ---------------------------------------------------------------------------
// Section 4: Regulatory Compliance
// ---------------------------------------------------------------------------

export interface ComplianceSection {
  fffs?: RegulatoryFFFS | null;
  lvf?: RegulatoryLVF | null;
  /** Full FFFS 2013:9 compliance checks */
  fffsCompliance?: RegulatoryFFFS | null;
  /** Full LVF 2004:46 compliance checks */
  lvfCompliance?: RegulatoryLVF | null;
  liquidityAnalysis?: LiquidityAnalysis | null;
  valuationInfo?: ValuationInfo | null;
  fundCompliance?: FundComplianceCheck | null;
  /** Fund-specific placement/compliance checks */
  fundSpecificChecks?: FundComplianceCheck | null;
  esgInfo?: ESGInfo | null;
  /** Regulatory rule excerpts from Bedrock Knowledge Base */
  regulatoryContext?: string[];
}

// ---------------------------------------------------------------------------
// Section 5: Documents
// ---------------------------------------------------------------------------

/** Extracted text excerpt from an IR document (for AI context) */
export interface DocumentExcerpt {
  documentId: string;
  fileName: string;
  category?: string;
  excerpt: string;
  /** Character limit used (e.g. 5000) */
  excerptLength?: number;
}

export interface DocumentsSection {
  /** Scraped IR documents from S3 (holding-documents) */
  irDocuments: HoldingDocument[];
  /** Optional: user-uploaded document keys for AI analysis */
  uploadedDocumentKeys?: string[];
  /** Extracted text excerpts from top IR docs (for AI prompt) */
  documentExcerpts?: DocumentExcerpt[];
}

// ---------------------------------------------------------------------------
// Section 6: Financial Analysis (AI-generated)
// ---------------------------------------------------------------------------

export interface FinancialAnalysisSection {
  executiveSummary?: string;
  companyOverview?: string;
  businessModel?: string;
  marketPosition?: string;
  financialAnalysis?: string;
  valuationMetrics?: string;
  managementGovernance?: string;
  /** AI-generated peer comparison (when fund context available) */
  peerComparison?: string;
  /** AI-generated sector outlook */
  sectorOutlook?: string;
  /** AI-generated dividend analysis */
  dividendAnalysis?: string;
  /** AI-generated debt analysis */
  debtAnalysis?: string;
  /** AI-generated growth assessment */
  growthAssessment?: string;
  /** AI-generated assessment of how the security fits the fund's placement strategy */
  placementStrategyFit?: string;
}

// ---------------------------------------------------------------------------
// Section 7: Risk & SWOT (AI-generated)
// ---------------------------------------------------------------------------

export interface RiskSWOTSection {
  riskAnalysis?: string;
  swotAnalysis?: {
    strengths?: string[];
    weaknesses?: string[];
    opportunities?: string[];
    threats?: string[];
  };
  controversySummary?: string;
}

// ---------------------------------------------------------------------------
// Section 8: News & Omvärld
// ---------------------------------------------------------------------------

export interface NewsSection {
  articles: NewsArticle[];
  regulatoryUpdates?: Array<{
    id: string;
    title: string;
    summary: string;
    source: string;
    publishedAt: string;
    url: string;
  }>;
}

// ---------------------------------------------------------------------------
// Section 9: Summary & Beslut (AI-generated)
// ---------------------------------------------------------------------------

export type OverallRating =
  | 'strong_buy'
  | 'buy'
  | 'hold'
  | 'sell'
  | 'strong_sell';

export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high';

export type ESGRating =
  | 'excellent'
  | 'good'
  | 'adequate'
  | 'poor'
  | 'critical';

export interface SummarySection {
  overallRating?: OverallRating;
  riskLevel?: RiskLevel;
  esgRating?: ESGRating;
  investmentThesis?: string;
  prosAndCons?: { pros?: string[]; cons?: string[] };
  conclusion?: string;
  esgDecision?: 'approved' | 'rejected';
  esgDecisionMotivation?: string;
}

// ---------------------------------------------------------------------------
// Complete Company Analysis (aggregate)
// ---------------------------------------------------------------------------

/** Fund and peer context when fundId is provided */
export interface FundContext {
  /** This position's weight in the fund (e.g. 0.05 = 5%) */
  positionWeight?: number;
  /** Other holdings in same sector (for peer context) */
  sectorPeers?: Array<{ name: string; isin?: string; weight?: number }>;
  /** NAV or fund summary if relevant */
  fundNavDate?: string;
}

/** Structured exclusion evaluation result per category (fund-specific thresholds) */
export interface ExclusionEvaluation {
  category: string;
  label: string;
  threshold: number;
  actualPercent: number | null;
  approved: boolean;
  severity: 'high' | 'medium';
  source?: string;
}

/** Fund terms context injected into analysis when fundId is provided */
export interface FundTermsContext {
  fundId: string;
  fundName: string;
  article: '6' | '8' | '9';
  exclusions: ExclusionEvaluation[];
  placementStrategy?: string;
  fundPurpose?: string;
  promotedCharacteristics?: string[];
  normScreening?: {
    ungc: boolean;
    oecd: boolean;
    humanRights: boolean;
    antiCorruption: boolean;
    controversyAutoReject: number;
  };
  /** Raw fondvillkor document text (truncated for prompt) */
  fondvillkorExcerpt?: string;
}

export interface CompleteCompanyAnalysis {
  /** When the analysis was run */
  analyzedAt: string;

  /** Optional fund context (for compliance/ESG decision) */
  fundId?: string;
  fundName?: string;
  /** Position weight and peer context when analyzed in fund context */
  fundContext?: FundContext;
  /** Fund terms context with exclusion evaluation */
  fundTermsContext?: FundTermsContext;

  /** 1. Identifiering & Lookup */
  identification: IdentificationSection;

  /** 2. Marknadsdata */
  marketData: MarketDataSection;

  /** 3. ESG & Hållbarhet */
  esg: ESGSection;

  /** 4. Regulatorisk compliance */
  compliance: ComplianceSection;

  /** 5. Dokumentanalys */
  documents: DocumentsSection;

  /** 6. Finansiell analys (AI) */
  financialAnalysis: FinancialAnalysisSection;

  /** 7. Risk & SWOT (AI) */
  riskSwot: RiskSWOTSection;

  /** 8. Nyheter & Omvärld */
  news: NewsSection;

  /** 9. Sammanfattning & Beslut (AI) */
  summary: SummarySection;

  /** Errors/warnings from data collection (non-fatal) */
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Compare request/response (2-3 companies)
// ---------------------------------------------------------------------------

export interface CompanyAnalysisCompareRequest {
  /** 2-3 identifiers: ISIN, ticker, or company name */
  identifiers: string[];
  fundId?: string;
}

export interface CompanyAnalysisCompareResponse {
  analyses: CompleteCompanyAnalysis[];
  comparedAt: string;
}
