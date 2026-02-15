/**
 * Security Approval Types
 * Based on AIFM's "Rutinbeskrivning: Godkännande av nytt värdepapper"
 */

// Basic security information
export interface SecurityBasicInfo {
  name: string;
  category: 'transferable_security' | 'money_market' | 'fund_unit' | 'derivative' | 'other';
  type: 'stock' | 'bond' | 'etf' | 'fund' | 'certificate' | 'warrant' | 'option' | 'future' | 'other';
  isUCITS_ETF?: boolean; // If ETF type
  ticker: string;
  isin: string;
  marketPlace: string;
  listingType: 'regulated_market' | 'other_regulated' | 'planned_regulated' | 'planned_other' | 'unlisted';
  mic: string;
  securityUrl?: string;
  currency: string;
  country: string;
  emitter: string;
  emitterLEI?: string;
  gicsSector?: string;
  conflictsOfInterest?: string;
}

// Fund compliance check
export interface FundComplianceCheck {
  fundId: string;
  fundName: string;
  complianceMotivation: string; // Why the security is allowed in this fund
  placementRestrictions: string; // Reference to fund regulations (§4, §5, §7 etc.)
}

// FFFS 2013:9 24 kap. 1 § requirements
export interface RegulatoryFFFS {
  limitedPotentialLoss: boolean; // §1 pt. 1
  liquidityNotEndangered: boolean; // §1 pt. 2
  reliableValuation: {
    type: 'market_price' | 'independent_system' | 'emitter_info' | 'investment_analysis';
    checked: boolean;
  }; // §1 pt. 3
  appropriateInformation: {
    type: 'regular_market_info' | 'regular_fund_info';
    checked: boolean;
  }; // §1 pt. 4
  isMarketable: boolean; // §1 pt. 5
  compatibleWithFund: boolean; // §1 pt. 6
  riskManagementCaptures: boolean; // §1 pt. 7
}

// LVF (2004:46) requirements
export interface RegulatoryLVF {
  stateGuaranteed?: {
    applicable: boolean;
    maxExposure35Percent: boolean;
  }; // 5 kap. 6 § 1 pt.
  nonVotingShares?: {
    applicable: boolean;
    maxIssuedShares10Percent: boolean;
  }; // 5 kap. 19 § 1 pt.
  bondOrMoneyMarket?: {
    applicable: boolean;
    maxIssuedInstruments10Percent: boolean;
  }; // 5 kap. 19 § 2-3 pt.
  significantInfluence?: {
    willHaveInfluence: boolean;
  }; // 5 kap. 20 §
}

// For unlisted/irregular securities
export interface UnlistedSecurityInfo {
  transferRestrictionsByArticles: boolean; // Hembud, förköp
  transferRestrictionsByAgreement: boolean; // Aktieägaravtal
  isPublicCompany: boolean;
  isDeposited: boolean;
  allowedAssetMotivation: string; // Why it's an allowed asset
  plannedEmissionShare?: string; // For emissions
}

// For fund units
export interface FundUnitInfo {
  fundType: 'ucits' | 'ucits_like' | 'special_fund' | 'aif';
  complianceLinks?: string[];
  maxOwnFundUnits10Percent: boolean;
  maxTargetFundUnits25Percent: boolean;
}

// Liquidity analysis
export interface LiquidityAnalysis {
  // Instrument type for liquidity analysis
  instrumentType?: 'stock' | 'bond' | 'etf' | 'fund' | 'derivative' | 'money_market' | 'other';
  
  // ADV (Average Daily Volume) data
  averageDailyVolume?: number;
  averageDailyPrice?: number;
  averageDailyValueSEK?: number; // ADV × Price × Currency rate
  
  // For stocks
  stockLiquidity?: {
    presumption400MSEK: boolean;
    canLiquidate1Day: boolean; // Position/Daily volume < 85%
    canLiquidate2Days: boolean; // < 170%
    canLiquidate3Days: boolean; // < 250%
    moreThan3Days: boolean; // > 250%
  };
  // For IPO/Spin-off (no history)
  noHistoryEstimate?: string;
  // Portfolio impact
  portfolioIlliquidShareBefore?: number;
  portfolioIlliquidShareAfter?: number;
  portfolioMotivation?: string;
  // For bonds/FRN/certificates
  bondLiquidity?: {
    bloombergLQA?: string;
    canLiquidate1Day: boolean;
    canLiquidate2Days: boolean;
    canLiquidate3Days: boolean;
    moreThan3Days: boolean;
  };
  // For new emissions
  emissionEstimate?: string;
  // Overall requirements
  fffsLiquidityNotEndangered: boolean;
  fffsIsMarketable: boolean;
  howLiquidityRequirementMet?: string;
  howMarketabilityRequirementMet?: string;
}

// Valuation information
export interface ValuationInfo {
  reliableDailyPrices: boolean;
  priceSourceUrl?: string;
  priceSourceComment?: string;
  isEmission: boolean;
  emissionValuationMethod?: string;
  proposedValuationMethod?: string;
}

// ESG Information (Article 8 & 9 funds)
export interface ESGInfo {
  article8Or9Fund: boolean;
  environmentalCharacteristics?: string;
  socialCharacteristics?: string;
  meetsExclusionCriteria: boolean;
  meetsSustainableInvestmentMinimum: boolean;
  paiConsidered?: boolean; // Principal Adverse Impacts
  // Additional for Article 9
  article9NoSignificantHarm?: string;
  article9GoodGovernance?: boolean;
  article9OECDCompliant?: boolean;
  article9UNGPCompliant?: boolean;
  // Extended ESG pre-trade (norm screening, exclusions, governance, risk, PAI, taxonomy, allocation, summary)
  fundArticle?: '6' | '8' | '9';
  normScreening?: Record<string, string>;
  exclusionResults?: Record<string, { hasExposure: boolean; aboveThreshold: boolean; approved: boolean; comment: string; percent?: number }>;
  governance?: Record<string, string>;
  envRiskLevel?: string;
  socialRiskLevel?: string;
  govRiskLevel?: string;
  ghgData?: string;
  sbtiTarget?: boolean | null;
  fossilExposurePercent?: number | string;
  pai?: Record<string, string | boolean | null>;
  sustainableGoalCategory?: string;
  revenueCapExFromSustainable?: string;
  taxonomyQualifiedPercent?: number | string;
  taxonomyAlignedPercent?: number | string;
  allocationBeforePercent?: number | string;
  allocationAfterPercent?: number | string;
  promotedCharacteristicsResult?: string;
  esgDecision?: 'approved' | 'rejected';
  esgDecisionMotivation?: string;
  engagementRequired?: boolean | null;
  engagementComment?: string;
}

// Complete security approval request
export interface SecurityApprovalRequest {
  id: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  expiresAt?: string; // Approval valid for 12 months
  
  // Who
  createdBy: string;
  createdByEmail: string;
  reviewedBy?: string;
  reviewedByEmail?: string;
  
  // Which fund
  fundId: string;
  fundName: string;
  
  // Form data
  basicInfo: SecurityBasicInfo;
  fundCompliance: FundComplianceCheck;
  regulatoryFFFS: RegulatoryFFFS;
  regulatoryLVF: RegulatoryLVF;
  unlistedInfo?: UnlistedSecurityInfo;
  fundUnitInfo?: FundUnitInfo;
  liquidityAnalysis: LiquidityAnalysis;
  valuationInfo: ValuationInfo;
  esgInfo: ESGInfo;
  
  // Acquisition details
  plannedAcquisitionShare?: string; // How much of the company/emission
  
  // Review
  reviewComments?: string;
  rejectionReason?: string;
  
  // Attachments
  attachments?: {
    name: string;
    url: string;
    type: string;
  }[];
}

// Approval list for Operations view
export interface FundApprovalList {
  fundId: string;
  fundName: string;
  approvals: SecurityApprovalRequest[];
  pendingCount: number;
  approvedCount: number;
  totalCount: number;
}

// Summary for dashboard
export interface SecurityApprovalSummary {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  recentApprovals: SecurityApprovalRequest[];
  expiringApprovals: SecurityApprovalRequest[];
}
