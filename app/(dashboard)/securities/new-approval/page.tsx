'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Building2,
  FileText,
  Scale,
  Droplets,
  BarChart3,
  Leaf,
  Send,
  Save,
  X,
  Info,
  ExternalLink,
  Globe,
  HelpCircle,
  Download,
  ShieldCheck,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { 
  SourceIndicator, 
  FieldSourceInfo,
  SourcedInput,
  SourcedCheckbox,
  SourcedTextarea,
} from '@/components/ui/SourceIndicator';
import { useFundsData } from '@/lib/fundsApi';
import { getESGFundConfig, getFundArticle, type ESGFundConfig } from '@/lib/integrations/securities/esg-fund-configs';
import AgentProgressBanner from '@/components/ui/AgentProgressBanner';

// ISIN: 12 chars = 2-letter country + 9 alphanumeric (NSIN) + 1 check digit (Luhn)
function validateISIN(isin: string): { valid: boolean; message?: string } {
  const trimmed = isin.trim().toUpperCase();
  if (!trimmed) return { valid: true };
  if (trimmed.length !== 12) {
    return { valid: false, message: 'ISIN ska vara exakt 12 tecken.' };
  }
  const ok = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(trimmed);
  if (!ok) {
    return { valid: false, message: 'ISIN: 2 bokstäver, 9 bokstäver/siffror, 1 siffra (checksiffra).' };
  }
  // Luhn: convert to digits (A=10 -> 1,0), then sum with doubling every second from right
  let digits = '';
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c >= 'A' && c <= 'Z') {
      const n = c.charCodeAt(0) - 55;
      digits += String(n);
    } else {
      digits += c;
    }
  }
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if ((digits.length - 1 - i) % 2 === 1) {
      d *= 2;
      if (d >= 10) d -= 9;
    }
    sum += d;
  }
  if (sum % 10 !== 0) {
    return { valid: false, message: 'Ogiltig ISIN (felaktig checksiffra).' };
  }
  return { valid: true };
}

// Types
interface SecurityData {
  name: string;
  ticker: string;
  isin: string;
  exchangeCode: string;
  mic?: string;
  securityType: string;
  marketSector: string;
  country?: string;
  countryName?: string;
  currency?: string;
  figi?: string;
  category?: string;
  type?: string;
  listingType?: string;
  gicsSector?: string;
  emitter?: string;
  isRegulatedMarket?: boolean;
  micInfo?: {
    name: string;
    country: string;
    type: string;
    currency: string;
    regulated: boolean;
  };
  regulatoryDefaults?: Record<string, boolean>;
  valuationDefaults?: Record<string, string | boolean>;
  liquidityDefaults?: Record<string, boolean>;
  // ADV (Average Daily Volume) data
  averageDailyVolume?: number;
  currentPrice?: number;
  averageDailyValueSEK?: number;
  meetsLiquidityPresumption?: boolean;
}

interface FormData {
  // Step 1: Lookup
  isin: string;
  mic: string;
  ticker: string;
  securityData: SecurityData | null;
  
  // Step 2: Basic Info
  name: string;
  category: string;
  type: string;
  isUCITS_ETF: boolean;
  listingType: string;
  currency: string;
  country: string;
  emitter: string;
  emitterLEI: string;
  gicsSector: string;
  securityUrl: string;
  conflictsOfInterest: string;
  
  // Step 3: Fund Compliance
  fundId: string;
  fundName: string;
  complianceMotivation: string;
  placementRestrictions: string;
  
  // Step 4: Regulatory FFFS
  limitedPotentialLoss: boolean;
  liquidityNotEndangered: boolean;
  reliableValuationType: string;
  reliableValuationChecked: boolean;
  appropriateInfoType: string;
  appropriateInfoChecked: boolean;
  isMarketable: boolean;
  compatibleWithFund: boolean;
  riskManagementCaptures: boolean;
  
  // Step 5: Regulatory LVF
  stateGuaranteed: boolean;
  stateGuaranteedMax35: boolean;
  nonVotingShares: boolean;
  nonVotingSharesMax10: boolean;
  bondOrMoneyMarket: boolean;
  bondMax10Issued: boolean;
  significantInfluence: boolean;
  plannedAcquisitionShare: string;
  
  // Step 6: Liquidity
  liquidityInstrumentType: 'stock' | 'bond' | 'etf' | 'fund' | 'derivative' | 'money_market' | 'other' | '';
  stockLiquidityPresumption: boolean;
  canLiquidate1Day: boolean;
  canLiquidate2Days: boolean;
  canLiquidate3Days: boolean;
  moreThan3Days: boolean;
  noHistoryEstimate: string;
  portfolioIlliquidBefore: string;
  portfolioIlliquidAfter: string;
  portfolioMotivation: string;
  liquidityRequirementMotivation: string;
  marketabilityMotivation: string;
  // ADV (Average Daily Volume) data
  averageDailyVolume: number | null;
  averageDailyPrice: number | null;
  averageDailyValueSEK: number | null;
  
  // Step 7: Valuation
  reliableDailyPrices: boolean;
  priceSourceUrl: string;
  priceSourceComment: string;
  isEmission: boolean;
  emissionValuationMethod: string;
  proposedValuationMethod: string;
  
  // Step 8+: ESG (legacy single step + new sub-steps)
  article8Or9Fund: boolean;
  fundArticle: '6' | '8' | '9';
  fundArticleDisplay?: string;
  environmentalCharacteristics: string;
  socialCharacteristics: string;
  meetsExclusionCriteria: boolean;
  meetsSustainableMinimum: boolean;
  paiConsidered: boolean;
  article9NoSignificantHarm: string;
  article9GoodGovernance: boolean;
  article9OECDCompliant: boolean;
  article9UNGPCompliant: boolean;
  // Normbaserad screening
  normScreeningUNGC: 'ok' | 'not_ok' | '';
  normScreeningOECD: 'ok' | 'not_ok' | '';
  normScreeningHumanRights: 'ok' | 'not_ok' | '';
  normScreeningAntiCorruption: 'ok' | 'not_ok' | '';
  normScreeningControversy: 'ok' | 'not_ok' | '';
  controversyLevel: number | '';
  normScreeningComment: string;
  // Exkluderingskontroll (per category key from fund config)
  exclusionResults: Record<string, { hasExposure: boolean; aboveThreshold: boolean; approved: boolean; comment: string; percent?: number }>;
  exclusionSummaryComment: string;
  // Good Governance
  governanceStructure: 'ok' | 'not_ok' | '';
  compensationSystem: 'ok' | 'not_ok' | '';
  taxCompliance: 'ok' | 'not_ok' | '';
  antiCorruption: 'ok' | 'not_ok' | '';
  transparencyReporting: 'ok' | 'not_ok' | '';
  governanceControversies: 'ok' | 'not_ok' | '';
  governanceComment: string;
  // ESG-riskanalys (E/S/G)
  envRiskLevel: 'low' | 'medium' | 'high' | '';
  socialRiskLevel: 'low' | 'medium' | 'high' | '';
  govRiskLevel: 'low' | 'medium' | 'high' | '';
  envRiskMotivation: string;
  socialRiskMotivation: string;
  govRiskMotivation: string;
  ghgData: string;
  sbtiTarget: boolean | null;
  fossilExposurePercent: number | '';
  // PAI-indikatorer
  paiGhgScope1: string;
  paiGhgScope2: string;
  paiGhgScope3: string;
  paiCarbonIntensity: string;
  paiFossilExposure: string;
  paiBiodiversity: string;
  paiWaterDischarge: string;
  paiHazardousWaste: string;
  paiWageGap: string;
  paiBoardDiversity: string;
  paiControversialWeapons: boolean | null;
  paiSummaryComment: string;
  // Artikel 9: Bidrag till hållbarhetsmål
  sustainableGoalCategory: string;
  revenueCapExFromSustainable: string;
  contributesToClimateGoal: boolean | null;
  contributesToClimateGoalComment: string;
  strengthensPortfolioGoal: boolean | null;
  strengthensPortfolioGoalComment: string;
  // Artikel 9: DNSH (redan article9NoSignificantHarm + PAI ovan)
  // Artikel 9: EU Taxonomi
  taxonomyQualifiedPercent: number | '';
  taxonomyAlignedPercent: number | '';
  taxonomyDataSource: string;
  taxonomyComment: string;
  // Artikel 9: Allokeringskontroll
  allocationBeforePercent: number | '';
  allocationAfterPercent: number | '';
  allocationComment: string;
  // Främjade egenskaper (Art 8)
  promotedCharacteristicsResult: 'weak' | 'moderate' | 'strong' | '';
  promotedCharacteristicsComment: string;
  // Datakvalitet
  dataQualityComment: string;
  // Sammanfattning och beslut
  esgSummaryNormScreening: 'approved' | 'rejected' | '';
  esgSummaryExclusion: 'approved' | 'rejected' | '';
  esgSummaryGovernance: 'meets' | 'does_not_meet' | '';
  esgSummaryRisk: 'low' | 'medium' | 'high' | '';
  esgSummaryPAI: 'low' | 'medium' | 'high' | '';
  esgSummaryPromoted: 'weak' | 'moderate' | 'strong' | '';
  esgDecision: 'approved' | 'rejected' | '';
  esgDecisionMotivation: string;
  // Engagemangsprocess (Vinga etc.)
  engagementRequired: boolean | null;
  engagementComment: string;
}

// Interface for tracking field sources
interface FieldSources {
  name?: FieldSourceInfo;
  ticker?: FieldSourceInfo;
  isin?: FieldSourceInfo;
  mic?: FieldSourceInfo;
  exchangeName?: FieldSourceInfo;
  category?: FieldSourceInfo;
  type?: FieldSourceInfo;
  currency?: FieldSourceInfo;
  country?: FieldSourceInfo;
  emitter?: FieldSourceInfo;
  emitterLEI?: FieldSourceInfo;
  gicsSector?: FieldSourceInfo;
  industry?: FieldSourceInfo;
  listingType?: FieldSourceInfo;
  isRegulatedMarket?: FieldSourceInfo;
  averageDailyVolume?: FieldSourceInfo;
  meetsLiquidityPresumption?: FieldSourceInfo;
  // Regulatory
  limitedPotentialLoss?: FieldSourceInfo;
  liquidityNotEndangered?: FieldSourceInfo;
  reliableValuationChecked?: FieldSourceInfo;
  appropriateInfoChecked?: FieldSourceInfo;
  isMarketable?: FieldSourceInfo;
  compatibleWithFund?: FieldSourceInfo;
  riskManagementCaptures?: FieldSourceInfo;
  // Valuation
  reliableDailyPrices?: FieldSourceInfo;
  priceSourceUrl?: FieldSourceInfo;
  // AI-generated
  complianceMotivation?: FieldSourceInfo;
  placementRestrictions?: FieldSourceInfo;
  environmentalCharacteristics?: FieldSourceInfo;
  socialCharacteristics?: FieldSourceInfo;
  liquidityMotivation?: FieldSourceInfo;
  marketabilityMotivation?: FieldSourceInfo;
  valuationMethod?: FieldSourceInfo;
}

// Shape expected by the form (from /api/funds)
type AvailableFundOption = { id: string; name: string; article: '6' | '8' | '9'; nav: number; currency: string; illiquidPercent: number };

// ---------------------------------------------------------------------------
// Liquidity calculation helpers
// ---------------------------------------------------------------------------

/**
 * Calculate which liquidation timeframe the position falls into:
 *   - <85% of ADV → within 1 day
 *   - <170% of ADV → within 2 days
 *   - <250% of ADV → within 3 days
 *   - ≥250% of ADV → more than 3 days
 *
 * @param positionValueSEK  planned position value in SEK
 * @param avgDailyValueSEK  average daily traded value in SEK
 */
function calcLiquidationBucket(positionValueSEK: number, avgDailyValueSEK: number) {
  if (avgDailyValueSEK <= 0) return null;
  const ratio = (positionValueSEK / avgDailyValueSEK) * 100; // as percentage
  return {
    ratio,
    canLiquidate1Day: ratio < 85,
    canLiquidate2Days: ratio >= 85 && ratio < 170,
    canLiquidate3Days: ratio >= 170 && ratio < 250,
    moreThan3Days: ratio >= 250,
  };
}

/**
 * Estimate position value in SEK from planned acquisition share.
 * `plannedAcquisitionShare` is a string like "2.5" representing %, or a SEK amount like "5000000".
 * We interpret:
 *   - Values ≤100 as a percentage of the fund NAV
 *   - Values >100 as a direct SEK amount
 */
function estimatePositionSEK(plannedAcquisitionShare: string, fundNav: number): number | null {
  const val = parseFloat(plannedAcquisitionShare);
  if (isNaN(val) || val <= 0) return null;
  if (val <= 100) {
    // Percentage of fund NAV
    return (val / 100) * fundNav;
  }
  // Direct SEK amount
  return val;
}

/**
 * Calculate portfolio illiquid shares before and after adding this position.
 * A position is considered illiquid if it cannot be liquidated within 1 day.
 */
function calcPortfolioIlliquid(
  fundNav: number,
  currentIlliquidPercent: number,
  positionValueSEK: number,
  canLiquidate1Day: boolean,
) {
  const currentIlliquid = (currentIlliquidPercent / 100) * fundNav;
  const newNav = fundNav + positionValueSEK;
  // If position is illiquid (cannot be sold in 1 day), add to illiquid pool
  const addedIlliquid = canLiquidate1Day ? 0 : positionValueSEK;
  const newIlliquid = currentIlliquid + addedIlliquid;
  return {
    before: currentIlliquidPercent,
    after: newNav > 0 ? (newIlliquid / newNav) * 100 : 0,
  };
}

// Base steps (1-7) – same for all funds
const BASE_STEPS = [
  { id: 1, name: 'Sök värdepapper', icon: Search },
  { id: 2, name: 'Grundläggande info', icon: Building2 },
  { id: 3, name: 'Fondöverensstämmelse', icon: FileText },
  { id: 4, name: 'FFFS 2013:9', icon: Scale },
  { id: 5, name: 'LVF 2004:46', icon: FileText },
  { id: 6, name: 'Likviditetsanalys', icon: Droplets },
  { id: 7, name: 'Värdering', icon: BarChart3 },
];

// Initial form data
const initialFormData: FormData = {
  isin: '',
  mic: '',
  ticker: '',
  securityData: null,
  name: '',
  category: '',
  type: '',
  isUCITS_ETF: false,
  listingType: 'regulated_market',
  currency: '',
  country: '',
  emitter: '',
  emitterLEI: '',
  gicsSector: '',
  securityUrl: '',
  conflictsOfInterest: '',
  fundId: '',
  fundName: '',
  complianceMotivation: '',
  placementRestrictions: '',
  limitedPotentialLoss: true,
  liquidityNotEndangered: true,
  reliableValuationType: 'market_price',
  reliableValuationChecked: true,
  appropriateInfoType: 'regular_market_info',
  appropriateInfoChecked: true,
  isMarketable: true,
  compatibleWithFund: true,
  riskManagementCaptures: true,
  stateGuaranteed: false,
  stateGuaranteedMax35: false,
  nonVotingShares: false,
  nonVotingSharesMax10: false,
  bondOrMoneyMarket: false,
  bondMax10Issued: false,
  significantInfluence: false,
  plannedAcquisitionShare: '',
  liquidityInstrumentType: '',
  stockLiquidityPresumption: false,
  canLiquidate1Day: false,
  canLiquidate2Days: false,
  canLiquidate3Days: false,
  moreThan3Days: false,
  noHistoryEstimate: '',
  portfolioIlliquidBefore: '',
  portfolioIlliquidAfter: '',
  portfolioMotivation: '',
  liquidityRequirementMotivation: '',
  marketabilityMotivation: '',
  averageDailyVolume: null,
  averageDailyPrice: null,
  averageDailyValueSEK: null,
  reliableDailyPrices: true,
  priceSourceUrl: '',
  priceSourceComment: '',
  isEmission: false,
  emissionValuationMethod: '',
  proposedValuationMethod: '',
  article8Or9Fund: false,
  fundArticle: '6',
  environmentalCharacteristics: '',
  socialCharacteristics: '',
  meetsExclusionCriteria: true,
  meetsSustainableMinimum: true,
  paiConsidered: false,
  article9NoSignificantHarm: '',
  article9GoodGovernance: false,
  article9OECDCompliant: false,
  article9UNGPCompliant: false,
  normScreeningUNGC: '',
  normScreeningOECD: '',
  normScreeningHumanRights: '',
  normScreeningAntiCorruption: '',
  normScreeningControversy: '',
  controversyLevel: '',
  normScreeningComment: '',
  exclusionResults: {},
  exclusionSummaryComment: '',
  governanceStructure: '',
  compensationSystem: '',
  taxCompliance: '',
  antiCorruption: '',
  transparencyReporting: '',
  governanceControversies: '',
  governanceComment: '',
  envRiskLevel: '',
  socialRiskLevel: '',
  govRiskLevel: '',
  envRiskMotivation: '',
  socialRiskMotivation: '',
  govRiskMotivation: '',
  ghgData: '',
  sbtiTarget: null,
  fossilExposurePercent: '',
  paiGhgScope1: '',
  paiGhgScope2: '',
  paiGhgScope3: '',
  paiCarbonIntensity: '',
  paiFossilExposure: '',
  paiBiodiversity: '',
  paiWaterDischarge: '',
  paiHazardousWaste: '',
  paiWageGap: '',
  paiBoardDiversity: '',
  paiControversialWeapons: null,
  paiSummaryComment: '',
  sustainableGoalCategory: '',
  revenueCapExFromSustainable: '',
  contributesToClimateGoal: null,
  contributesToClimateGoalComment: '',
  strengthensPortfolioGoal: null,
  strengthensPortfolioGoalComment: '',
  taxonomyQualifiedPercent: '',
  taxonomyAlignedPercent: '',
  taxonomyDataSource: '',
  taxonomyComment: '',
  allocationBeforePercent: '',
  allocationAfterPercent: '',
  allocationComment: '',
  promotedCharacteristicsResult: '',
  promotedCharacteristicsComment: '',
  dataQualityComment: '',
  esgSummaryNormScreening: '',
  esgSummaryExclusion: '',
  esgSummaryGovernance: '',
  esgSummaryRisk: '',
  esgSummaryPAI: '',
  esgSummaryPromoted: '',
  esgDecision: '',
  esgDecisionMotivation: '',
  engagementRequired: null,
  engagementComment: '',
};

export default function NewSecurityApprovalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: fundsData, loading: fundsLoading, error: fundsError } = useFundsData();
  const availableFunds = useMemo(() => {
    if (!fundsData) return [];
    return fundsData.funds.map(f => ({
      id: f.id,
      name: f.name,
      nav: f.nav,
      article: getFundArticle(f.id, f.name),
      illiquidPercent: 0,
    }));
  }, [fundsData]);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isinError, setIsinError] = useState<string | null>(null);
  const [esgWarnings, setEsgWarnings] = useState<string[]>([]);
  const [showEsgWarning, setShowEsgWarning] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  // Track field sources for provenance
  const [fieldSources, setFieldSources] = useState<FieldSources>({});
  const [sourcesUsed, setSourcesUsed] = useState<{id: string; name: string}[]>([]);
  const [lookupWarnings, setLookupWarnings] = useState<string[]>([]);

  // Auto-save state
  const [draftId, setDraftId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ESG and Restrictions state
  const [restrictionResults, setRestrictionResults] = useState<{
    passed: boolean;
    errors: string[];
    warnings: string[];
    esg?: {
      status: 'passed' | 'warning' | 'failed';
      message: string;
      details: string[];
    };
  } | null>(null);
  const [isCheckingRestrictions, setIsCheckingRestrictions] = useState(false);
  const [esgApiLoading, setEsgApiLoading] = useState(false);
  const [esgApiError, setEsgApiError] = useState<string | null>(null);
  const [isAgentAnalyzing, setIsAgentAnalyzing] = useState(false);
  const [agentProgress, setAgentProgress] = useState<string>('');
  const [agentStepIndex, setAgentStepIndex] = useState(0);
  const [agentComplete, setAgentComplete] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const agentSteps = useMemo(() => [
    { label: 'ESG-data', estimatedDuration: 10 },
    { label: 'AI-analys', estimatedDuration: 120 },
    { label: 'Klart', estimatedDuration: 2 },
  ], []);

  // Dynamic steps: Article 6 = 8 steps, Article 8 = 13 steps, Article 9 = 16 steps
  const STEPS = useMemo(() => {
    const article = formData.fundArticle || '6';
    if (article === '6') {
      return [...BASE_STEPS, { id: 8, name: 'ESG', icon: Leaf }];
    }
    if (article === '8') {
      return [
        ...BASE_STEPS,
        { id: 8, name: 'Normbaserad screening', icon: Leaf },
        { id: 9, name: 'Exkluderingskontroll', icon: ShieldCheck },
        { id: 10, name: 'Good Governance', icon: ShieldCheck },
        { id: 11, name: 'ESG-riskanalys', icon: BarChart3 },
        { id: 12, name: 'PAI-indikatorer', icon: Leaf },
        { id: 13, name: 'Sammanfattning ESG', icon: CheckCircle2 },
      ];
    }
    return [
      ...BASE_STEPS,
      { id: 8, name: 'Normbaserad screening', icon: Leaf },
      { id: 9, name: 'Exkluderingskontroll', icon: ShieldCheck },
      { id: 10, name: 'Good Governance', icon: ShieldCheck },
      { id: 11, name: 'Bidrag hållbarhetsmål', icon: Leaf },
      { id: 12, name: 'DNSH-PAI', icon: Leaf },
      { id: 13, name: 'ESG-riskanalys', icon: BarChart3 },
      { id: 14, name: 'EU Taxonomi', icon: Leaf },
      { id: 15, name: 'Allokeringskontroll', icon: BarChart3 },
      { id: 16, name: 'Sammanfattning ESG', icon: CheckCircle2 },
    ];
  }, [formData.fundArticle]);

  // ESG fund config for current fund (for Article 8/9 – exclusions, PAI list, etc.)
  const esgFundConfig = useMemo(
    () => (formData.fundId && formData.fundName ? getESGFundConfig(formData.fundId, formData.fundName) : null),
    [formData.fundId, formData.fundName]
  );

  // When STEPS shrinks (e.g. user changes to Article 6), clamp current step to last available
  const lastStepId = STEPS[STEPS.length - 1]?.id ?? 8;
  useEffect(() => {
    if (currentStep > lastStepId) setCurrentStep(lastStepId);
  }, [lastStepId, currentStep]);

  // Auto-fetch ESG when user reaches first ESG step (step 8) – only when fund has ESG steps and we have identifier
  const hasAutoFetchedESGRef = useRef(false);
  useEffect(() => {
    hasAutoFetchedESGRef.current = false;
  }, [formData.isin, formData.ticker, formData.fundId]);

  // Update field helper - marks as having unsaved changes
  const updateField = (field: keyof FormData, value: FormData[keyof FormData]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  /** Apply ESG API response to form (used after lookup esgSummary and after "Fyll i från ESG-API") */
  const applyESGSummaryToFormData = useCallback((esg: Record<string, unknown>, esgFundConfig?: ESGFundConfig | null) => {
    const scoreToRisk = (s: number | null): 'low' | 'medium' | 'high' | '' => {
      if (s == null) return '';
      if (s >= 70) return 'low';
      if (s >= 40) return 'medium';
      return 'high';
    };
    // Maps provider category names (Datia etc.) → fund config category names
    const CATEGORY_ALIAS: Record<string, string[]> = {
      fossilFuels: [
        'fossil_fuels', 'fossil fuels', 'thermal_coal', 'thermal coal',
        'black_coal', 'black coal', 'coking_coal', 'coking coal',
        'oil_sands', 'oil sands', 'arctic_drilling', 'arctic drilling',
        'shale_energy', 'shale energy', 'coal', 'oil', 'gas',
      ],
      controversialWeapons: [
        'controversial_weapons', 'controversial weapons',
        'cluster_munitions', 'cluster munitions',
        'anti_personnel_mines', 'anti personnel mines',
        'biological_weapons', 'biological weapons',
        'chemical_weapons', 'chemical weapons',
        'depleted_uranium', 'depleted uranium',
        'white_phosphorus', 'white phosphorus',
      ],
      nuclearWeapons: ['nuclear_weapons', 'nuclear weapons', 'nuclear'],
      weapons: ['weapons', 'military', 'small_arms', 'small arms', 'arms', 'military_contracting', 'military contracting'],
      tobacco: ['tobacco'],
      alcohol: ['alcohol', 'alcoholic_beverages', 'alcoholic beverages'],
      adultContent: ['adult_entertainment', 'adult entertainment', 'pornography', 'adult_content', 'adult content'],
      gambling: ['gambling', 'casinos'],
    };

    const matchExclusionCategory = (fundCat: string, flagCat: string): boolean => {
      const flagNorm = (flagCat || '').toLowerCase().replace(/_/g, ' ').trim();
      const fundNorm = fundCat.toLowerCase().replace(/_/g, ' ').trim();

      // Direct match
      if (fundNorm === flagNorm) return true;

      // Check alias table
      const aliases = CATEGORY_ALIAS[fundCat] ?? CATEGORY_ALIAS[fundNorm.replace(/ /g, '')];
      if (aliases) {
        const flagVariants = [flagNorm, flagCat.toLowerCase()];
        for (const alias of aliases) {
          for (const fv of flagVariants) {
            if (fv === alias || fv.includes(alias) || alias.includes(fv)) return true;
          }
        }
      }

      // Fallback: camelCase → words, then substring match
      const aCamel = fundCat.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
      return aCamel === flagNorm || flagNorm.includes(aCamel) || aCamel.includes(flagNorm);
    };
    console.log('[ESG applyESGSummary] Called with esg:', JSON.stringify(esg, null, 2).slice(0, 500));
    console.log('[ESG applyESGSummary] meetsExclusionCriteria:', esg.meetsExclusionCriteria, typeof esg.meetsExclusionCriteria);
    setFormData(prev => {
      const updates: Partial<FormData> = {};
      if (esg.environmentScore != null || esg.carbonIntensity != null) {
        const parts: string[] = [];
        if (esg.environmentScore != null) parts.push(`Miljöpoäng: ${esg.environmentScore}/100 (${esg.provider})`);
        if (esg.carbonIntensity != null) parts.push(`Koldioxidintensitet: ${esg.carbonIntensity} ${esg.carbonIntensityUnit || 'tonnes/M€'}`);
        if (esg.taxonomyAlignmentPercent != null) {
          parts.push(`EU-taxonomi: ${esg.taxonomyAlignmentPercent}% anpassad`);
        }
        if (parts.length > 0) {
          updates.environmentalCharacteristics = parts.join('. ') + '.';
        }
      }
      if (esg.socialScore != null) {
        const parts: string[] = [];
        parts.push(`Socialpoäng: ${esg.socialScore}/100 (${esg.provider})`);
        if (esg.governanceScore != null) parts.push(`Styrningspoäng: ${esg.governanceScore}/100`);
        if (parts.length > 0) {
          updates.socialCharacteristics = parts.join('. ') + '.';
        }
      }
      if (esg.meetsExclusionCriteria !== undefined) {
        updates.meetsExclusionCriteria = esg.meetsExclusionCriteria as boolean;
      }
      if (esg.paiIndicators && Array.isArray(esg.paiIndicators) && esg.paiIndicators.length > 0) {
        updates.paiConsidered = true;
      }
      if (esg.taxonomyAlignmentPercent != null && (esg.taxonomyAlignmentPercent as number) > 0) {
        updates.meetsSustainableMinimum = true;
      }
      if (prev.fundArticle === '9' || prev.article8Or9Fund) {
        if (esg.governanceScore != null && (esg.governanceScore as number) > 50) {
          updates.article9GoodGovernance = true;
        }
        if (esg.meetsExclusionCriteria === true) {
          updates.article9OECDCompliant = true;
          updates.article9UNGPCompliant = true;
        }
        if (esg.meetsExclusionCriteria === true) {
          const parts: string[] = [];
          parts.push(`Baserat på ESG-screening från ${esg.provider || 'Datia'} uppfyller värdepappret exkluderingskriterierna`);
          if (esg.totalScore != null) parts.push(`med en total ESG-poäng på ${esg.totalScore}/100`);
          if (esg.carbonIntensity != null) parts.push(`och koldioxidintensitet på ${esg.carbonIntensity} ${esg.carbonIntensityUnit || 'tonnes/M€'}`);
          parts.push('Investeringen bedöms inte orsaka betydande skada för något annat hållbarhetsmål.');
          updates.article9NoSignificantHarm = parts.join('. ');
        }
      }
      // Norm screening: based on controversyLevel (NOT meetsExclusionCriteria which is about business involvements)
      // controversyLevel null = no controversies found = OK
      // controversyLevel 0-3 = OK
      // controversyLevel 4-5 = auto-reject
      const controversy = esg.controversyLevel as number | null;
      const hasHighControversy = controversy != null && controversy >= 4;
      // If no controversy data, assume OK (Datia often returns null for clean companies)
      updates.normScreeningUNGC = hasHighControversy ? 'not_ok' : 'ok';
      updates.normScreeningOECD = hasHighControversy ? 'not_ok' : 'ok';
      updates.normScreeningHumanRights = hasHighControversy ? 'not_ok' : 'ok';
      updates.normScreeningAntiCorruption = hasHighControversy ? 'not_ok' : 'ok';
      updates.normScreeningControversy = hasHighControversy ? 'not_ok' : 'ok';
      updates.esgSummaryNormScreening = hasHighControversy ? 'rejected' : 'approved';
      if (controversy != null) {
        updates.controversyLevel = controversy;
      }
      if (esg.carbonIntensity != null) {
        updates.paiCarbonIntensity = `${esg.carbonIntensity} ${esg.carbonIntensityUnit || 'tCO₂e/M€'}`;
      }
      // Map PAI indicators from Datia to form fields
      if (esg.paiIndicators && Array.isArray(esg.paiIndicators) && esg.paiIndicators.length > 0) {
        const pais = esg.paiIndicators as Array<{ name: string; value: string | number | null; unit?: string; description?: string }>;
        const findPAI = (keywords: string[]): string => {
          const match = pais.find(p => {
            const desc = (p.description || p.name || '').toLowerCase();
            return keywords.some(kw => desc.includes(kw));
          });
          if (!match || match.value == null) return '';
          return `${match.value}${match.unit ? ` ${match.unit}` : ''}`;
        };
        const scope1 = findPAI(['scope_1', 'scope1', 'ghg_scope_1']);
        const scope2 = findPAI(['scope_2', 'scope2', 'ghg_scope_2']);
        const scope3 = findPAI(['scope_3', 'scope3', 'ghg_scope_3']);
        const fossil = findPAI(['fossil', 'fossil_fuel']);
        const biodiv = findPAI(['biodiversity', 'bio_diversity']);
        const water = findPAI(['water', 'emissions_to_water']);
        const waste = findPAI(['hazardous', 'waste']);
        const wage = findPAI(['gender_pay', 'wage_gap', 'unadjusted_gender_pay']);
        const board = findPAI(['board_gender', 'board_diversity', 'female_board']);
        const weapons = findPAI(['controversial_weapons', 'weapons']);
        if (scope1) updates.paiGhgScope1 = scope1;
        if (scope2) updates.paiGhgScope2 = scope2;
        if (scope3) updates.paiGhgScope3 = scope3;
        if (fossil) updates.paiFossilExposure = fossil;
        if (biodiv) updates.paiBiodiversity = biodiv;
        if (water) updates.paiWaterDischarge = water;
        if (waste) updates.paiHazardousWaste = waste;
        if (wage) updates.paiWageGap = wage;
        if (board) updates.paiBoardDiversity = board;
        if (weapons) {
          const isYes = weapons.toLowerCase().includes('yes') || weapons.toLowerCase().includes('true') || weapons === '1';
          updates.paiControversialWeapons = isYes;
        }
        // Also build a summary comment from all PAI indicators
        const paiParts = pais
          .filter(p => p.value != null)
          .map(p => `${p.name}: ${p.value}${p.unit ? ` ${p.unit}` : ''}`)
          .slice(0, 10);
        if (paiParts.length > 0) {
          updates.paiSummaryComment = `PAI-data från ${esg.provider || 'ESG-leverantör'}:\n${paiParts.join('\n')}`;
        }
      }
      if (esg.environmentScore != null || esg.carbonIntensity != null) {
        const parts: string[] = [];
        if (esg.carbonIntensity != null) parts.push(`GHG-intensitet: ${esg.carbonIntensity} ${esg.carbonIntensityUnit || 'tCO₂e/M€'}`);
        if (esg.environmentScore != null) parts.push(`Miljöpoäng: ${esg.environmentScore}/100`);
        if (parts.length) updates.ghgData = parts.join('. ');
      }
      if (esg.environmentScore != null) {
        updates.envRiskLevel = scoreToRisk(esg.environmentScore as number) || prev.envRiskLevel;
      }
      if (esg.socialScore != null) {
        updates.socialRiskLevel = scoreToRisk(esg.socialScore as number) || prev.socialRiskLevel;
      }
      if (esg.governanceScore != null) {
        updates.govRiskLevel = scoreToRisk(esg.governanceScore as number) || prev.govRiskLevel;
      }
      if (esg.governanceScore != null && (esg.governanceScore as number) > 50) {
        updates.governanceStructure = 'ok';
        updates.compensationSystem = 'ok';
        updates.taxCompliance = 'ok';
        updates.antiCorruption = 'ok';
        updates.transparencyReporting = 'ok';
        updates.governanceControversies = 'ok';
      }
      if (esg.taxonomyAlignmentPercent != null) {
        updates.taxonomyQualifiedPercent = esg.taxonomyAlignmentPercent as number;
        updates.taxonomyAlignedPercent = esg.taxonomyAlignmentPercent as number;
      }
      if (esg.totalScore != null) {
        updates.esgSummaryRisk = scoreToRisk(esg.totalScore as number) || prev.esgSummaryRisk;
      }
      if (esg.meetsExclusionCriteria === true) {
        updates.esgSummaryExclusion = 'approved';
      }
      if (esg.governanceScore != null && (esg.governanceScore as number) > 50) {
        updates.esgSummaryGovernance = 'meets';
      }
      if (esg.carbonIntensity != null) {
        const c = esg.carbonIntensity as number;
        updates.esgSummaryPAI = c < 150 ? 'low' : c < 400 ? 'medium' : 'high';
      }
      if (esg.taxonomyAlignmentPercent != null) {
        const t = esg.taxonomyAlignmentPercent as number;
        updates.esgSummaryPromoted = t >= 50 ? 'strong' : t > 0 ? 'moderate' : 'weak';
      }

      // --- Fill in comment/motivation fields with auto-generated text ---
      const provider = (esg.provider as string) || 'ESG-leverantör';

      // Norm screening comment
      if (controversy != null) {
        updates.normScreeningComment = controversy >= 4
          ? `Kontroversnivå ${controversy}/5 identifierad av ${provider}. Automatiskt avslag.`
          : `Kontroversnivå ${controversy ?? 0}/5 (${provider}). Inga allvarliga kontroverser identifierade.`;
      } else {
        updates.normScreeningComment = `Ingen kontroversdata tillgänglig från ${provider}. Bedöms som OK.`;
      }

      // Governance comment
      if (esg.governanceScore != null) {
        const gs = esg.governanceScore as number;
        updates.governanceComment = `Styrningspoäng: ${gs}/100 (${provider}). ${gs > 50 ? 'Uppfyller krav på god styrning.' : 'Styrningspoäng under gränsvärdet – manuell granskning rekommenderas.'}`;
      }

      // ESG risk motivations
      if (esg.environmentScore != null) {
        const es = esg.environmentScore as number;
        const ci = esg.carbonIntensity as number | null;
        const envParts = [`Miljöpoäng: ${es}/100 (${provider})`];
        if (ci != null) envParts.push(`Koldioxidintensitet: ${ci} ${esg.carbonIntensityUnit || 'tCO₂e/M€'}`);
        updates.envRiskMotivation = envParts.join('. ') + '.';
      }
      if (esg.socialScore != null) {
        updates.socialRiskMotivation = `Socialpoäng: ${esg.socialScore}/100 (${provider}).`;
      }
      if (esg.governanceScore != null) {
        updates.govRiskMotivation = `Styrningspoäng: ${esg.governanceScore}/100 (${provider}).`;
      }

      // SBTi target – Datia doesn't provide this directly, but we can infer from PAI
      // fossilExposurePercent – derive from exclusionFlags if available
      if (Array.isArray(esg.exclusionFlags)) {
        const fossilFlag = (esg.exclusionFlags as Array<{ category?: string; revenuePercent?: number }>).find(
          f => (f.category || '').toLowerCase().includes('fossil') || (f.category || '').toLowerCase().includes('oil')
        );
        if (fossilFlag?.revenuePercent != null) {
          updates.fossilExposurePercent = fossilFlag.revenuePercent;
        }
      }

      // Taxonomy data source
      if (esg.taxonomyAlignmentPercent != null) {
        updates.taxonomyDataSource = provider;
        const taxPct = esg.taxonomyAlignmentPercent as number;
        updates.taxonomyComment = taxPct > 0
          ? `${taxPct}% taxonomianpassning enligt ${provider}. Data hämtad ${esg.fetchedAt ? new Date(esg.fetchedAt as string).toLocaleDateString('sv-SE') : 'idag'}.`
          : `Ingen taxonomianpassning rapporterad av ${provider}.`;
      }

      // Exclusion summary comment
      if (Array.isArray(esg.exclusionFlags) && esg.exclusionFlags.length > 0) {
        const flags = esg.exclusionFlags as Array<{ category?: string; categoryDescription?: string; revenuePercent?: number; involvementLevel?: string }>;
        const involved = flags.filter(f => (f.revenuePercent ?? 0) > 0);
        if (involved.length === 0) {
          updates.exclusionSummaryComment = `Inga exponeringar identifierade av ${provider}. Alla sektorer godkända.`;
        } else {
          const details = involved.map(f => `${f.categoryDescription || f.category}: ${f.revenuePercent}%`).join(', ');
          updates.exclusionSummaryComment = `Exponeringar identifierade av ${provider}: ${details}.`;
        }
      }

      // Promoted characteristics comment (Art 8)
      if (esg.taxonomyAlignmentPercent != null && prev.fundArticle === '8') {
        const t = esg.taxonomyAlignmentPercent as number;
        updates.promotedCharacteristicsComment = t > 0
          ? `Värdepappret har ${t}% taxonomianpassning (${provider}). ${t >= 50 ? 'Stark koppling till främjade egenskaper.' : t > 0 ? 'Måttlig koppling till främjade egenskaper.' : ''}`
          : `Ingen taxonomianpassning rapporterad av ${provider}. Svag koppling till främjade egenskaper.`;
      }

      // Article 9 sustainable goal fields
      if (prev.fundArticle === '9') {
        if (esg.taxonomyAlignmentPercent != null && (esg.taxonomyAlignmentPercent as number) > 0) {
          updates.revenueCapExFromSustainable = String(esg.taxonomyAlignmentPercent);
          updates.contributesToClimateGoal = true;
          updates.contributesToClimateGoalComment = `Baserat på ${esg.taxonomyAlignmentPercent}% taxonomianpassning (${provider}).`;
          updates.strengthensPortfolioGoal = true;
          updates.strengthensPortfolioGoalComment = `Värdepappret bidrar med ${esg.taxonomyAlignmentPercent}% hållbar verksamhet till portföljens måluppfyllelse.`;
        }
      }

      // Data quality comment
      {
        const dqParts: string[] = [`Data hämtad från ${provider}`];
        if (esg.fetchedAt) dqParts[0] += ` (${new Date(esg.fetchedAt as string).toLocaleDateString('sv-SE')})`;
        if (esg.controversyLevel == null) dqParts.push('Kontroversdata saknas');
        if (esg.taxonomyAlignmentPercent == null) dqParts.push('Taxonomidata saknas');
        if (!esg.paiIndicators || !(esg.paiIndicators as unknown[]).length) dqParts.push('PAI-indikatorer ej tillgängliga');
        updates.dataQualityComment = dqParts.join('. ') + '.';
      }

      // Engagement: auto-determine based on ESG risk and fund config threshold
      if (esgFundConfig?.engagementProcess) {
        const threshold = esgFundConfig.engagementProcess.riskThreshold;
        const totalRisk = esg.totalScore != null ? (100 - (esg.totalScore as number)) : null; // Invert: high score = low risk
        if (totalRisk != null) {
          updates.engagementRequired = totalRisk >= threshold;
          updates.engagementComment = totalRisk >= threshold
            ? `ESG-risk (${totalRisk}) överstiger tröskelvärdet (${threshold}). Engagemang krävs.`
            : `ESG-risk (${totalRisk}) understiger tröskelvärdet (${threshold}). Inget engagemang krävs.`;
        }
      }

      if (esgFundConfig?.exclusions?.length && Array.isArray(esg.exclusionFlags) && esg.exclusionFlags.length > 0) {
        const flags = esg.exclusionFlags as { category?: string; revenuePercent?: number }[];
        const nextExclusionResults = { ...prev.exclusionResults };
        for (const ex of esgFundConfig.exclusions) {
          // Find ALL matching provider flags (e.g. fossilFuels may match thermal_coal + black_coal + coking_coal)
          const matchingFlags = flags.filter((f) => matchExclusionCategory(ex.category, f.category ?? ''));
          if (matchingFlags.length > 0) {
            // Use the highest revenue percent among all matched sub-categories
            const pct = Math.max(...matchingFlags.map(f => typeof f.revenuePercent === 'number' ? f.revenuePercent : 0));
            const aboveThreshold = pct > ex.threshold;
            nextExclusionResults[ex.category] = {
              hasExposure: pct > 0,
              aboveThreshold,
              approved: !aboveThreshold,
              comment: nextExclusionResults[ex.category]?.comment ?? '',
              percent: pct,
            };
          }
        }
        updates.exclusionResults = nextExclusionResults;
      }
      console.log('[ESG applyESGSummary] Updates to apply:', Object.keys(updates).length, 'fields:', Object.keys(updates));
      return { ...prev, ...updates };
    });
    const esgSourceInfo: FieldSourceInfo = {
      source: 'datia' as const,
      confidence: 'high' as const,
      reasoning: `ESG-data hämtad från ${esg.provider || 'Datia'} (${new Date((esg.fetchedAt as string) || Date.now()).toLocaleDateString('sv-SE')})`,
      retrievedAt: (esg.fetchedAt as string) || new Date().toISOString(),
    };
    setFieldSources(prev => ({
      ...prev,
      environmentalCharacteristics: esgSourceInfo,
      socialCharacteristics: esgSourceInfo,
    }));
  }, []);

  const [esgApiSuccess, setEsgApiSuccess] = useState<string | null>(null);

  const handleFillFromESGApi = useCallback(async () => {
    const id = formData.isin || formData.ticker;
    if (!id) {
      setEsgApiError('Ange ISIN eller symbol först (steg 1).');
      return;
    }
    if (!formData.fundId) {
      setEsgApiError('Välj fond först (steg 3).');
      return;
    }
    setEsgApiError(null);
    setEsgApiSuccess(null);
    setEsgApiLoading(true);
    try {
      console.log('[ESG] Fetching ESG data for:', id);
      const res = await fetch(`/api/securities/esg?identifier=${encodeURIComponent(id)}`);
      const data = await res.json();
      console.log('[ESG] Response status:', res.status, 'data:', data);
      if (!res.ok) throw new Error(data.error || 'Kunde inte hämta ESG-data');
      if (data.esgSummary) {
        applyESGSummaryToFormData(data.esgSummary, esgFundConfig ?? null);
        const provider = data.esgSummary.provider || 'ESG-leverantör';
        setEsgApiSuccess(`ESG-data hämtad från ${provider}. Alla ESG-steg har fyllts i automatiskt.`);
        setTimeout(() => setEsgApiSuccess(null), 8000);
      } else {
        throw new Error('API returnerade inget ESG-data (esgSummary saknas i svaret)');
      }
    } catch (e) {
      console.error('[ESG] Error:', e);
      setEsgApiError(e instanceof Error ? e.message : 'Kunde inte hämta ESG-data');
    } finally {
      setEsgApiLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.isin, formData.ticker, formData.fundId, esgFundConfig]);

  // Auto-call ESG API when user reaches first ESG step (step 8); fondens steg bestäms av vald fond (artikel 6/8/9)
  useEffect(() => {
    const identifier = formData.isin || formData.ticker;
    const onFirstESGStep = currentStep === 8;
    if (
      onFirstESGStep &&
      identifier &&
      formData.fundId &&
      !hasAutoFetchedESGRef.current &&
      !esgApiLoading
    ) {
      hasAutoFetchedESGRef.current = true;
      setEsgApiError(null);
      setEsgApiSuccess(null);
      setEsgApiLoading(true);
      fetch(`/api/securities/esg?identifier=${encodeURIComponent(identifier)}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Kunde inte hämta ESG-data');
          if (data.esgSummary) {
            applyESGSummaryToFormData(data.esgSummary, esgFundConfig ?? null);
            const provider = data.esgSummary.provider || 'ESG-leverantör';
            setEsgApiSuccess(`ESG-data hämtad automatiskt från ${provider}.`);
            setTimeout(() => setEsgApiSuccess(null), 8000);
          } else {
            throw new Error('Inget ESG-data returnerades');
          }
        })
        .catch((e) => setEsgApiError(e instanceof Error ? e.message : 'Kunde inte hämta ESG-data automatiskt'))
        .finally(() => setEsgApiLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, formData.isin, formData.ticker, formData.fundId]);

  // Track which fields were auto-filled
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);

  // Load draft if draftId is in URL
  useEffect(() => {
    const urlDraftId = searchParams.get('draftId');
    if (urlDraftId) {
      loadDraft(urlDraftId);
    }
  }, [searchParams]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (hasUnsavedChanges && formData.fundId) {
      autoSaveTimerRef.current = setTimeout(() => {
        handleAutoSave();
      }, 30000);
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, formData]);

  // ---------------------------------------------------------------------------
  // Auto-calculate liquidity fields when inputs change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fundNav = availableFunds.find(f => f.id === formData.fundId)?.nav;
    const fundIlliquid = availableFunds.find(f => f.id === formData.fundId)?.illiquidPercent;
    const adv = formData.averageDailyValueSEK;
    const planned = formData.plannedAcquisitionShare;

    if (!fundNav || !adv || !planned) return;

    const positionSEK = estimatePositionSEK(planned, fundNav);
    if (!positionSEK) return;

    const bucket = calcLiquidationBucket(positionSEK, adv);
    if (!bucket) return;

    // Update liquidation timeframe radio buttons
    setFormData(prev => {
      const updates: Partial<FormData> = {
        canLiquidate1Day: bucket.canLiquidate1Day,
        canLiquidate2Days: bucket.canLiquidate2Days,
        canLiquidate3Days: bucket.canLiquidate3Days,
        moreThan3Days: bucket.moreThan3Days,
      };

      // Calculate portfolio illiquid shares
      if (fundIlliquid !== undefined) {
        const illiq = calcPortfolioIlliquid(fundNav, fundIlliquid, positionSEK, bucket.canLiquidate1Day);
        updates.portfolioIlliquidBefore = illiq.before.toFixed(1);
        updates.portfolioIlliquidAfter = illiq.after.toFixed(1);
      }

      // Auto-generate portfolio motivation if not already filled
      if (!prev.portfolioMotivation) {
        const pctOfNav = ((positionSEK / fundNav) * 100).toFixed(2);
        const daysText = bucket.canLiquidate1Day ? '1 dag'
          : bucket.canLiquidate2Days ? '2 dagar'
          : bucket.canLiquidate3Days ? '3 dagar'
          : 'mer än 3 dagar';
        const ratioText = bucket.ratio.toFixed(1);
        updates.portfolioMotivation = `Planerad position utgör ${pctOfNav}% av fondens NAV (${(fundNav / 1e6).toFixed(0)} MSEK). ` +
          `Position/daglig volym-kvot: ${ratioText}%, vilket innebär att positionen kan likvideras inom ${daysText}. ` +
          (bucket.canLiquidate1Day
            ? 'Positionen bedöms som likvid och utgör ingen risk för fondens likviditetshantering.'
            : `Positionen kräver ${daysText} för full likvidering. Fondens samlade illikviditetsandel förblir inom godkänd nivå.`);
      }

      return { ...prev, ...updates };
    });

    // Track field sources
    setFieldSources(prev => ({
      ...prev,
      ...(prev.portfolioIlliquidBefore ? {} : {
        // Only set source if we're auto-calculating (not if user manually filled)
      }),
    }));
  }, [formData.plannedAcquisitionShare, formData.fundId, formData.averageDailyValueSEK]);

  // Load draft data
  const loadDraft = async (id: string) => {
    try {
      const res = await fetch(`/api/securities/drafts?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.draft) {
          setDraftId(id);
          // Convert draft to form data
          const d = data.draft;
          setFormData(prev => ({
            ...prev,
            isin: d.basicInfo?.isin || '',
            ticker: d.basicInfo?.ticker || '',
            mic: d.basicInfo?.mic || '',
            name: d.basicInfo?.name || '',
            category: d.basicInfo?.category || '',
            type: d.basicInfo?.type || '',
            isUCITS_ETF: d.basicInfo?.isUCITS_ETF || false,
            listingType: d.basicInfo?.listingType || 'regulated_market',
            currency: d.basicInfo?.currency || '',
            country: d.basicInfo?.country || '',
            emitter: d.basicInfo?.emitter || '',
            emitterLEI: d.basicInfo?.emitterLEI || '',
            gicsSector: d.basicInfo?.gicsSector || '',
            securityUrl: d.basicInfo?.securityUrl || '',
            conflictsOfInterest: d.basicInfo?.conflictsOfInterest || '',
            fundId: d.fundId || '',
            fundName: d.fundName || '',
            complianceMotivation: d.fundCompliance?.complianceMotivation || '',
            placementRestrictions: d.fundCompliance?.placementRestrictions || '',
            limitedPotentialLoss: d.regulatoryFFFS?.limitedPotentialLoss ?? true,
            liquidityNotEndangered: d.regulatoryFFFS?.liquidityNotEndangered ?? true,
            reliableValuationType: d.regulatoryFFFS?.reliableValuation?.type || 'market_price',
            reliableValuationChecked: d.regulatoryFFFS?.reliableValuation?.checked ?? true,
            appropriateInfoType: d.regulatoryFFFS?.appropriateInformation?.type || 'regular_market_info',
            appropriateInfoChecked: d.regulatoryFFFS?.appropriateInformation?.checked ?? true,
            isMarketable: d.regulatoryFFFS?.isMarketable ?? true,
            compatibleWithFund: d.regulatoryFFFS?.compatibleWithFund ?? true,
            riskManagementCaptures: d.regulatoryFFFS?.riskManagementCaptures ?? true,
            liquidityInstrumentType: d.liquidityAnalysis?.instrumentType || '',
            averageDailyVolume: d.liquidityAnalysis?.averageDailyVolume ?? null,
            averageDailyPrice: d.liquidityAnalysis?.averageDailyPrice ?? null,
            averageDailyValueSEK: d.liquidityAnalysis?.averageDailyValueSEK ?? null,
            stockLiquidityPresumption: d.liquidityAnalysis?.stockLiquidity?.presumption400MSEK ?? false,
            canLiquidate1Day: d.liquidityAnalysis?.stockLiquidity?.canLiquidate1Day ?? false,
            canLiquidate2Days: d.liquidityAnalysis?.stockLiquidity?.canLiquidate2Days ?? false,
            canLiquidate3Days: d.liquidityAnalysis?.stockLiquidity?.canLiquidate3Days ?? false,
            moreThan3Days: d.liquidityAnalysis?.stockLiquidity?.moreThan3Days ?? false,
            noHistoryEstimate: d.liquidityAnalysis?.noHistoryEstimate || '',
            portfolioIlliquidBefore: d.liquidityAnalysis?.portfolioIlliquidShareBefore?.toString() || '',
            portfolioIlliquidAfter: d.liquidityAnalysis?.portfolioIlliquidShareAfter?.toString() || '',
            portfolioMotivation: d.liquidityAnalysis?.portfolioMotivation || '',
            liquidityRequirementMotivation: d.liquidityAnalysis?.howLiquidityRequirementMet || '',
            marketabilityMotivation: d.liquidityAnalysis?.howMarketabilityRequirementMet || '',
            reliableDailyPrices: d.valuationInfo?.reliableDailyPrices ?? true,
            priceSourceUrl: d.valuationInfo?.priceSourceUrl || '',
            priceSourceComment: d.valuationInfo?.priceSourceComment || '',
            isEmission: d.valuationInfo?.isEmission ?? false,
            emissionValuationMethod: d.valuationInfo?.emissionValuationMethod || '',
            proposedValuationMethod: d.valuationInfo?.proposedValuationMethod || '',
            article8Or9Fund: d.esgInfo?.article8Or9Fund ?? false,
            fundArticle: (d.esgInfo?.fundArticle as FormData['fundArticle']) || '6',
            environmentalCharacteristics: d.esgInfo?.environmentalCharacteristics || '',
            socialCharacteristics: d.esgInfo?.socialCharacteristics || '',
            meetsExclusionCriteria: d.esgInfo?.meetsExclusionCriteria ?? true,
            meetsSustainableMinimum: d.esgInfo?.meetsSustainableInvestmentMinimum ?? true,
            paiConsidered: d.esgInfo?.paiConsidered ?? false,
            article9NoSignificantHarm: d.esgInfo?.article9NoSignificantHarm || '',
            article9GoodGovernance: d.esgInfo?.article9GoodGovernance ?? false,
            article9OECDCompliant: d.esgInfo?.article9OECDCompliant ?? false,
            article9UNGPCompliant: d.esgInfo?.article9UNGPCompliant ?? false,
            normScreeningUNGC: (d.esgInfo?.normScreening?.UNGC as FormData['normScreeningUNGC']) || '',
            normScreeningOECD: (d.esgInfo?.normScreening?.OECD as FormData['normScreeningOECD']) || '',
            normScreeningHumanRights: (d.esgInfo?.normScreening?.humanRights as FormData['normScreeningHumanRights']) || '',
            normScreeningAntiCorruption: (d.esgInfo?.normScreening?.antiCorruption as FormData['normScreeningAntiCorruption']) || '',
            normScreeningControversy: (d.esgInfo?.normScreening?.controversy as FormData['normScreeningControversy']) || '',
            controversyLevel: d.esgInfo?.normScreening?.controversyLevel ?? '',
            normScreeningComment: d.esgInfo?.normScreening?.comment || '',
            exclusionResults: d.esgInfo?.exclusionResults ?? {},
            governanceStructure: (d.esgInfo?.governance?.structure as FormData['governanceStructure']) || '',
            compensationSystem: (d.esgInfo?.governance?.compensation as FormData['compensationSystem']) || '',
            taxCompliance: (d.esgInfo?.governance?.taxCompliance as FormData['taxCompliance']) || '',
            antiCorruption: (d.esgInfo?.governance?.antiCorruption as FormData['antiCorruption']) || '',
            transparencyReporting: (d.esgInfo?.governance?.transparency as FormData['transparencyReporting']) || '',
            governanceControversies: (d.esgInfo?.governance?.controversies as FormData['governanceControversies']) || '',
            governanceComment: d.esgInfo?.governance?.comment || '',
            envRiskLevel: (d.esgInfo?.envRiskLevel as FormData['envRiskLevel']) || '',
            socialRiskLevel: (d.esgInfo?.socialRiskLevel as FormData['socialRiskLevel']) || '',
            govRiskLevel: (d.esgInfo?.govRiskLevel as FormData['govRiskLevel']) || '',
            ghgData: d.esgInfo?.ghgData || '',
            sbtiTarget: d.esgInfo?.sbtiTarget ?? null,
            fossilExposurePercent: d.esgInfo?.fossilExposurePercent ?? '',
            paiGhgScope1: (d.esgInfo?.pai as Record<string, unknown>)?.ghgScope1 as string ?? '',
            paiGhgScope2: (d.esgInfo?.pai as Record<string, unknown>)?.ghgScope2 as string ?? '',
            paiGhgScope3: (d.esgInfo?.pai as Record<string, unknown>)?.ghgScope3 as string ?? '',
            paiCarbonIntensity: (d.esgInfo?.pai as Record<string, unknown>)?.carbonIntensity as string ?? '',
            paiFossilExposure: (d.esgInfo?.pai as Record<string, unknown>)?.fossilExposure as string ?? '',
            paiBiodiversity: (d.esgInfo?.pai as Record<string, unknown>)?.biodiversity as string ?? '',
            paiWaterDischarge: (d.esgInfo?.pai as Record<string, unknown>)?.waterDischarge as string ?? '',
            paiHazardousWaste: (d.esgInfo?.pai as Record<string, unknown>)?.hazardousWaste as string ?? '',
            paiWageGap: (d.esgInfo?.pai as Record<string, unknown>)?.wageGap as string ?? '',
            paiBoardDiversity: (d.esgInfo?.pai as Record<string, unknown>)?.boardDiversity as string ?? '',
            paiControversialWeapons: ((d.esgInfo?.pai as Record<string, unknown>)?.controversialWeapons as boolean | null) ?? null,
            paiSummaryComment: (d.esgInfo?.pai as Record<string, unknown>)?.summaryComment as string ?? '',
            sustainableGoalCategory: d.esgInfo?.sustainableGoalCategory || '',
            revenueCapExFromSustainable: d.esgInfo?.revenueCapExFromSustainable || '',
            taxonomyQualifiedPercent: d.esgInfo?.taxonomyQualifiedPercent ?? '',
            taxonomyAlignedPercent: d.esgInfo?.taxonomyAlignedPercent ?? '',
            allocationBeforePercent: d.esgInfo?.allocationBeforePercent ?? '',
            allocationAfterPercent: d.esgInfo?.allocationAfterPercent ?? '',
            promotedCharacteristicsResult: (d.esgInfo?.promotedCharacteristicsResult as FormData['promotedCharacteristicsResult']) || '',
            esgDecision: (d.esgInfo?.esgDecision as FormData['esgDecision']) || '',
            esgDecisionMotivation: d.esgInfo?.esgDecisionMotivation || '',
            engagementRequired: d.esgInfo?.engagementRequired ?? null,
            engagementComment: d.esgInfo?.engagementComment || '',
            plannedAcquisitionShare: d.plannedAcquisitionShare || '',
          }));
          setLastSaved(d.updatedAt);
        }
      }
    } catch (error) {
      console.error('Load draft error:', error);
    }
  };

  // Auto-save function
  const handleAutoSave = async () => {
    if (!formData.fundId) return;
    
    setIsSaving(true);
    try {
      const res = await fetch('/api/securities/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          formData,
          fundId: formData.fundId,
          fundName: formData.fundName,
          createdBy: 'Current User',
          createdByEmail: 'user@aifm.se',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDraftId(data.draftId);
        setLastSaved(data.updatedAt);
        setHasUnsavedChanges(false);
        setSaveMessage('Automatiskt sparat');
        setTimeout(() => setSaveMessage(null), 2000);
      }
    } catch {
      // Silently ignore auto-save errors (e.g. DynamoDB table not provisioned)
    }
    setIsSaving(false);
  };

  // Check fund restrictions and ESG
  const checkRestrictions = async () => {
    if (!formData.fundId || !formData.securityData) return;

    setIsCheckingRestrictions(true);
    try {
      const res = await fetch('/api/securities/restrictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          security: {
            ...formData.securityData,
            name: formData.name,
            ticker: formData.ticker,
            isin: formData.isin,
            gicsSector: formData.gicsSector,
            country: formData.country,
            type: formData.type,
            category: formData.category,
            listingType: formData.listingType,
            isRegulatedMarket: formData.securityData?.isRegulatedMarket,
          },
          fundId: formData.fundId,
          checkESG: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRestrictionResults({
          passed: data.passed,
          errors: data.restrictions.errors || [],
          warnings: data.restrictions.warnings || [],
          esg: data.esg?.recommendation,
        });
      }
    } catch (error) {
      console.error('Restriction check error:', error);
    }
    setIsCheckingRestrictions(false);
  };

  // Download PDF preview
  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    setSaveMessage(null);
    
    try {
      const res = await fetch('/api/securities/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData,
          fundId: formData.fundId || 'preview',
          fundName: formData.fundName || 'Förhandsvisning',
        }),
      });

      if (res.ok) {
        const html = await res.text();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) {
          win.onload = () => win.print();
        }
      } else {
        setSaveMessage('Kunde inte generera PDF');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (error) {
      console.error('PDF error:', error);
      setSaveMessage('Kunde inte generera PDF');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Lookup security
  const handleLookup = async () => {
    if (!formData.isin && !formData.ticker) {
      setLookupError('Ange ISIN eller ticker');
      return;
    }
    if (formData.isin.trim()) {
      const res = validateISIN(formData.isin);
      if (!res.valid) {
        setLookupError(res.message ?? 'Ogiltig ISIN-kod');
        return;
      }
    }

    setIsLookingUp(true);
    setLookupError(null);
    setLookupWarnings([]);

    try {
      const response = await fetch('/api/securities/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isin: formData.isin,
          ticker: formData.ticker,
          mic: formData.mic,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setLookupError(data.error || 'Värdepappret hittades inte');
        return;
      }

      // Update form with all enriched security data
      const s = data.data;
      const regDefaults = s.regulatoryDefaults || {};
      const valDefaults = s.valuationDefaults || {};
      
      setFormData(prev => ({
        ...prev,
        // Basic info
        securityData: s,
        name: s.name || prev.name,
        ticker: s.ticker || prev.ticker,
        isin: s.isin || formData.isin,
        mic: s.mic || formData.mic || prev.mic,
        
        // Auto-filled from enriched data
        currency: s.currency || prev.currency,
        country: s.country || prev.country,
        emitter: s.emitter || s.name || prev.emitter,
        emitterLEI: (!s.emitterLEINotFound && s.emitterLEI) ? s.emitterLEI : prev.emitterLEI,
        gicsSector: (!s.gicsSectorNotFound && s.gicsSector) ? s.gicsSector : prev.gicsSector,
        category: s.category || prev.category,
        type: s.type || prev.type,
        listingType: s.listingType || prev.listingType,
        securityUrl: s.securityUrl || prev.securityUrl,
        
        // Regulatory defaults (FFFS 2013:9) - auto-checked for regulated markets
        limitedPotentialLoss: regDefaults.limitedPotentialLoss?.value ?? prev.limitedPotentialLoss,
        liquidityNotEndangered: regDefaults.liquidityNotEndangered?.value ?? prev.liquidityNotEndangered,
        reliableValuationChecked: regDefaults.reliableValuationChecked?.value ?? prev.reliableValuationChecked,
        appropriateInfoChecked: regDefaults.appropriateInfoChecked?.value ?? prev.appropriateInfoChecked,
        isMarketable: regDefaults.isMarketable?.value ?? prev.isMarketable,
        compatibleWithFund: regDefaults.compatibleWithFund?.value ?? prev.compatibleWithFund,
        riskManagementCaptures: regDefaults.riskManagementCaptures?.value ?? prev.riskManagementCaptures,
        
        // Valuation defaults
        reliableDailyPrices: valDefaults.reliableDailyPrices?.value ?? prev.reliableDailyPrices,
        reliableValuationType: valDefaults.reliableValuationType?.value || prev.reliableValuationType,
        appropriateInfoType: valDefaults.appropriateInfoType?.value || prev.appropriateInfoType,
        priceSourceUrl: valDefaults.priceSourceUrl?.value || prev.priceSourceUrl,
        
        // Liquidity defaults from Yahoo Finance
        stockLiquidityPresumption: s.meetsLiquidityPresumption ?? prev.stockLiquidityPresumption,
        canLiquidate1Day: s.meetsLiquidityPresumption ?? prev.canLiquidate1Day,
        
        // ADV data
        averageDailyVolume: s.averageDailyVolume ?? prev.averageDailyVolume,
        averageDailyPrice: s.currentPrice ?? prev.averageDailyPrice,
        averageDailyValueSEK: s.averageDailyValueSEK ?? prev.averageDailyValueSEK,
        
        // Set liquidity instrument type based on security type
        liquidityInstrumentType: (s.type || prev.liquidityInstrumentType) as FormData['liquidityInstrumentType'],
      }));
      
      // Store field sources for UI indicators
      const newSources: FieldSources = {};
      
      // Basic field sources
      if (s.nameSource) newSources.name = s.nameSource;
      if (s.tickerSource) newSources.ticker = s.tickerSource;
      if (s.isinSource) newSources.isin = s.isinSource;
      if (s.micSource) newSources.mic = s.micSource;
      if (s.exchangeNameSource) newSources.exchangeName = s.exchangeNameSource;
      if (s.categorySource) newSources.category = s.categorySource;
      if (s.typeSource) newSources.type = s.typeSource;
      if (s.currencySource) newSources.currency = s.currencySource;
      if (s.countrySource) newSources.country = s.countrySource;
      if (s.emitterSource) newSources.emitter = s.emitterSource;
      if (s.emitterLEISource) newSources.emitterLEI = { ...s.emitterLEISource, confidence: s.emitterLEINotFound ? 'not_found' : s.emitterLEISource.confidence };
      if (s.gicsSectorSource) newSources.gicsSector = { ...s.gicsSectorSource, confidence: s.gicsSectorNotFound ? 'not_found' : s.gicsSectorSource.confidence };
      if (s.industrySource) newSources.industry = s.industrySource;
      if (s.listingTypeSource) newSources.listingType = s.listingTypeSource;
      if (s.isRegulatedMarketSource) newSources.isRegulatedMarket = s.isRegulatedMarketSource;
      if (s.averageDailyVolumeSource) newSources.averageDailyVolume = s.averageDailyVolumeSource;
      if (s.meetsLiquidityPresumptionSource) newSources.meetsLiquidityPresumption = s.meetsLiquidityPresumptionSource;
      
      // Regulatory defaults sources
      if (regDefaults.limitedPotentialLoss?.source) newSources.limitedPotentialLoss = regDefaults.limitedPotentialLoss.source;
      if (regDefaults.liquidityNotEndangered?.source) newSources.liquidityNotEndangered = regDefaults.liquidityNotEndangered.source;
      if (regDefaults.reliableValuationChecked?.source) newSources.reliableValuationChecked = regDefaults.reliableValuationChecked.source;
      if (regDefaults.appropriateInfoChecked?.source) newSources.appropriateInfoChecked = regDefaults.appropriateInfoChecked.source;
      if (regDefaults.isMarketable?.source) newSources.isMarketable = regDefaults.isMarketable.source;
      if (regDefaults.compatibleWithFund?.source) newSources.compatibleWithFund = regDefaults.compatibleWithFund.source;
      if (regDefaults.riskManagementCaptures?.source) newSources.riskManagementCaptures = regDefaults.riskManagementCaptures.source;
      
      // Valuation defaults sources
      if (valDefaults.reliableDailyPrices?.source) newSources.reliableDailyPrices = valDefaults.reliableDailyPrices.source;
      if (valDefaults.priceSourceUrl?.source) newSources.priceSourceUrl = valDefaults.priceSourceUrl.source;
      
      setFieldSources(newSources);
      
      // Store sources used and warnings
      if (data.sourcesUsed) setSourcesUsed(data.sourcesUsed);
      if (data.warnings) setLookupWarnings(data.warnings);
      
      // Track auto-filled fields
      setAutoFilledFields(data.autoFilledFields || []);

      // ---- Auto-fill ESG fields from Datia / ESG provider ----
      if (data.esgSummary) {
        const fundConfig = formData.fundId && formData.fundName ? getESGFundConfig(formData.fundId, formData.fundName) : null;
        applyESGSummaryToFormData(data.esgSummary, fundConfig);
      }

      // ---- Auto-fill remaining fields ----
      const emitterName = (s.emitter || s.name || '').toLowerCase();
      const aifmRelatedEntities = ['aifm', 'nordic ventures', 'global tech fund'];
      const hasConflict = aifmRelatedEntities.some(entity => emitterName.includes(entity));

      const isRegulated = s.isRegulatedMarket ?? (s.listingType === 'regulated_market');
      const secName = s.name || '';
      const advSEK = s.averageDailyValueSEK;
      const meetsPresumption = s.meetsLiquidityPresumption;
      const secType = s.type || '';
      const secCountry = (s.country || '').toUpperCase();
      const exchangeNameStr = s.exchangeName || '';

      setFormData(prev => {
        const updates: Partial<FormData> = {};

        // ---- Step 2: Basic Info ----

        // Conflicts of interest
        if (!prev.conflictsOfInterest) {
          updates.conflictsOfInterest = hasConflict
            ? `OBS: Potentiell intressekonflikt identifierad — emittenten "${s.emitter || s.name}" har namnlikhet med fondbolaget/fonden. Närmare granskning krävs.`
            : 'Ingen identifierad intressekonflikt. Emittenten har ingen koppling till fondbolaget, dess närstående eller förvaltningsteamet.';
        }

        // UCITS-ETF auto-detection: European ETFs on regulated markets are typically UCITS
        if (secType === 'etf' && isRegulated) {
          const europeanCountries = ['SE', 'DE', 'FR', 'NL', 'IE', 'LU', 'GB', 'FI', 'DK', 'NO', 'IT', 'ES', 'AT', 'BE', 'PT', 'CH'];
          const isEuropeanETF = europeanCountries.includes(secCountry);
          if (isEuropeanETF) {
            updates.isUCITS_ETF = true;
          }
        }

        // ---- Step 5: LVF ----

        // Significant influence: if market cap is available and large, unlikely to have >10% influence
        if (s.marketCap && s.marketCap > 1_000_000_000) {
          updates.significantInfluence = false;
        }

        // ---- Step 6: Liquidity ----

        // Liquidity requirement motivation
        if (!prev.liquidityRequirementMotivation && isRegulated) {
          const advText = advSEK ? ` Genomsnittlig daglig omsättning uppgår till ${(advSEK / 1e6).toFixed(1)} MSEK.` : '';
          updates.liquidityRequirementMotivation = meetsPresumption
            ? `${secName} är noterad på en reglerad marknad och uppfyller likviditetspresumtionen (ADV > 400 MSEK).${advText} Likviditeten bedöms därmed inte äventyras av denna investering (24 kap. 1 § 2 pt.).`
            : `${secName} är noterad på en reglerad marknad.${advText} Värdepappret handlas regelbundet och likviditeten bedöms inte äventyras av denna investering (24 kap. 1 § 2 pt.).`;
        }

        // Marketability motivation
        if (!prev.marketabilityMotivation && isRegulated) {
          updates.marketabilityMotivation = `${secName} handlas på en reglerad marknad med löpande prisnotering. Värdepappret kan säljas under normala marknadsförhållanden utan väsentlig priseffekt (24 kap. 1 § 5 pt.).`;
        }

        // ---- Step 7: Valuation ----

        // Price source comment
        if (!prev.priceSourceComment && isRegulated) {
          const exName = exchangeNameStr || 'reglerad marknad';
          updates.priceSourceComment = `Stängningskurs från ${exName}. Dagliga priser publiceras löpande.`;
        }

        // Proposed valuation method based on instrument type
        if (!prev.proposedValuationMethod) {
          if (secType === 'stock' && isRegulated) {
            updates.proposedValuationMethod = `Marknadsvärdering baserat på senaste stängningskurs från ${exchangeNameStr || 'reglerad marknad'}. Värdering sker dagligen i enlighet med fondens värderingspolicy.`;
          } else if (secType === 'etf') {
            updates.proposedValuationMethod = `NAV-baserad värdering. ETF:ens andelsvärde fastställs dagligen av fondbolaget. Marknadspris på börsen används som kontrollvärde.`;
          } else if (secType === 'bond') {
            updates.proposedValuationMethod = `Marknadsvärdering baserat på noterade priser. Vid avsaknad av aktuella marknadspriser används teoretisk värdering baserat på diskontering av framtida kassaflöden.`;
          } else if (isRegulated) {
            updates.proposedValuationMethod = `Marknadsvärdering baserat på senaste tillgängliga pris från ${exchangeNameStr || 'handelsplats'}.`;
          }
        }

        // isEmission defaults to false for secondary market securities
        if (isRegulated && !prev.isEmission) {
          updates.isEmission = false;
        }

        return { ...prev, ...updates };
      });

      // Check restrictions if fund is already selected
      if (formData.fundId) {
        setTimeout(() => checkRestrictions(), 500);
        // Auto-trigger agent analysis (ESG + AI) when lookup completes and fund is selected
        setTimeout(() => handleAgentAnalyze(), 1500);
      }

    } catch (error) {
      console.error('Lookup error:', error);
      setLookupError('Kunde inte söka värdepapper. Försök igen.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // AI Analysis
  const handleAnalyze = async () => {
    if (!formData.securityData || !formData.fundId) {
      return;
    }

    setIsAnalyzing(true);

    try {
      const selectedFund = availableFunds.find(f => f.id === formData.fundId);
      
      // Build security data with sources for AI analysis
      const securityWithSources = {
        ...formData.securityData,
        nameSource: fieldSources.name,
        categorySource: fieldSources.category,
        typeSource: fieldSources.type,
        currencySource: fieldSources.currency,
        isRegulatedMarketSource: fieldSources.isRegulatedMarket,
        gicsSectorSource: fieldSources.gicsSector,
        industrySource: fieldSources.industry,
        averageDailyValueSEKSource: fieldSources.averageDailyVolume,
        meetsLiquidityPresumptionSource: fieldSources.meetsLiquidityPresumption,
      };
      
      const response = await fetch('/api/securities/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          security: {
            ...securityWithSources,
            isUCITS_ETF: formData.isUCITS_ETF,
            listingType: formData.listingType,
          },
          fund: {
            fundId: formData.fundId,
            fundName: selectedFund?.name || formData.fundName,
            article: selectedFund?.article || '6',
          },
          formContext: {
            stockLiquidityPresumption: formData.stockLiquidityPresumption,
            averageDailyVolume: formData.averageDailyVolume,
            averageDailyPrice: formData.averageDailyPrice,
            averageDailyValueSEK: formData.averageDailyValueSEK,
            reliableDailyPrices: formData.reliableDailyPrices,
            isEmission: formData.isEmission,
            limitedPotentialLoss: formData.limitedPotentialLoss,
            liquidityNotEndangered: formData.liquidityNotEndangered,
            isMarketable: formData.isMarketable,
            compatibleWithFund: formData.compatibleWithFund,
            riskManagementCaptures: formData.riskManagementCaptures,
            significantInfluence: formData.significantInfluence,
            esgSummaryNormScreening: formData.esgSummaryNormScreening,
            esgSummaryExclusion: formData.esgSummaryExclusion,
            esgSummaryGovernance: formData.esgSummaryGovernance,
            esgSummaryRisk: formData.esgSummaryRisk,
            esgSummaryPAI: formData.esgSummaryPAI,
            esgSummaryPromoted: formData.esgSummaryPromoted,
            envRiskLevel: formData.envRiskLevel,
            socialRiskLevel: formData.socialRiskLevel,
            govRiskLevel: formData.govRiskLevel,
            allocationBeforePercent: formData.allocationBeforePercent,
            allocationAfterPercent: formData.allocationAfterPercent,
          },
        }),
      });

      const data = await response.json();
      console.log('[AI Analysis] Response:', { success: data.success, error: data.error, hasSuggestions: !!data.suggestions, status: response.status });

      if (!response.ok) {
        console.error('[AI Analysis] HTTP error:', response.status, data.error);
        throw new Error(data.error || `AI-analys misslyckades (HTTP ${response.status})`);
      }

      if (!data.success) {
        console.error('[AI Analysis] API returned failure:', data.error);
        throw new Error(data.error || 'AI-analys returnerade inget resultat');
      }

      if (data.success && data.suggestions) {
        const s = data.suggestions;
        console.log('[AI Analysis] Applying suggestions:', Object.keys(s).filter(k => !k.endsWith('Source') && !k.endsWith('Confidence') && !k.endsWith('NotFound') && !k.endsWith('Error') && s[k] !== null).length, 'fields');
        
        // Update form data with AI suggestions (only if not notFound)
        setFormData(prev => {
          const updates: Partial<FormData> = {};
          
          // Helper: only apply text fields if AI returned a value
          const applyIfFound = (notFoundKey: string, valueKey: string, formField: keyof FormData) => {
            if (!s[notFoundKey] && s[valueKey]) {
              (updates as any)[formField] = s[valueKey];
            }
          };
          
          // Helper: apply boolean fields
          const applyBoolIfFound = (notFoundKey: string, valueKey: string, formField: keyof FormData) => {
            if (!s[notFoundKey] && s[valueKey] !== null && s[valueKey] !== undefined) {
              const val = s[valueKey];
              (updates as any)[formField] = val === 'true' || val === true;
            }
          };
          
          // Helper: apply select/enum fields (only if value is valid)
          const applySelectIfFound = (notFoundKey: string, valueKey: string, formField: keyof FormData, validValues: string[]) => {
            if (!s[notFoundKey] && s[valueKey] && validValues.includes(s[valueKey])) {
              (updates as any)[formField] = s[valueKey];
            }
          };
          
          // Step 3: Fund Compliance
          applyIfFound('complianceMotivationNotFound', 'complianceMotivation', 'complianceMotivation');
          applyIfFound('placementRestrictionsNotFound', 'placementRestrictions', 'placementRestrictions');
          applyIfFound('conflictsOfInterestNotFound', 'conflictsOfInterest', 'conflictsOfInterest');
          
          // Step 4: FFFS 2013:9
          applySelectIfFound('reliableValuationTypeNotFound', 'reliableValuationType', 'reliableValuationType', 
            ['regulated_market', 'mtf', 'otc_with_counterparty', 'independent_valuation', 'other']);
          // Auto-check the checkbox when type is set
          if (!s.reliableValuationTypeNotFound && s.reliableValuationType) {
            updates.reliableValuationChecked = true;
          }
          applySelectIfFound('appropriateInfoTypeNotFound', 'appropriateInfoType', 'appropriateInfoType',
            ['regulated_market_info', 'issuer_reports', 'independent_analysis', 'other']);
          if (!s.appropriateInfoTypeNotFound && s.appropriateInfoType) {
            updates.appropriateInfoChecked = true;
          }
          
          // Step 5: LVF 2004:46
          applyBoolIfFound('stateGuaranteedNotFound', 'stateGuaranteed', 'stateGuaranteed');
          // If stateGuaranteed is explicitly false, the max35 sub-question is not applicable
          if (!s.stateGuaranteedNotFound && (s.stateGuaranteed === 'false' || s.stateGuaranteed === false)) {
            updates.stateGuaranteedMax35 = false;
          }
          applyBoolIfFound('nonVotingSharesNotFound', 'nonVotingShares', 'nonVotingShares');
          if (!s.nonVotingSharesNotFound && (s.nonVotingShares === 'false' || s.nonVotingShares === false)) {
            updates.nonVotingSharesMax10 = false;
          }
          applyBoolIfFound('bondOrMoneyMarketNotFound', 'bondOrMoneyMarket', 'bondOrMoneyMarket');
          if (!s.bondOrMoneyMarketNotFound && (s.bondOrMoneyMarket === 'false' || s.bondOrMoneyMarket === false)) {
            updates.bondMax10Issued = false;
          }
          
          // Step 6: Liquidity
          applySelectIfFound('liquidityInstrumentTypeNotFound', 'liquidityInstrumentType', 'liquidityInstrumentType',
            ['stock', 'bond', 'etf', 'fund', 'derivative', 'money_market', 'other']);
          applyBoolIfFound('canLiquidate1DayNotFound', 'canLiquidate1Day', 'canLiquidate1Day');
          applyIfFound('noHistoryEstimateNotFound', 'noHistoryEstimate', 'noHistoryEstimate');
          applyIfFound('liquidityMotivationNotFound', 'liquidityMotivation', 'liquidityRequirementMotivation');
          applyIfFound('marketabilityMotivationNotFound', 'marketabilityMotivation', 'marketabilityMotivation');
          
          // Step 7: Valuation
          applyIfFound('priceSourceCommentNotFound', 'priceSourceComment', 'priceSourceComment');
          applyIfFound('valuationMethodNotFound', 'valuationMethod', 'proposedValuationMethod');
          applyIfFound('emissionValuationMethodNotFound', 'emissionValuationMethod', 'emissionValuationMethod');
          
          // Step 8+: ESG
          applyIfFound('environmentalCharacteristicsNotFound', 'environmentalCharacteristics', 'environmentalCharacteristics');
          applyIfFound('socialCharacteristicsNotFound', 'socialCharacteristics', 'socialCharacteristics');
          applyIfFound('normScreeningCommentNotFound', 'normScreeningComment', 'normScreeningComment');
          applyIfFound('exclusionSummaryCommentNotFound', 'exclusionSummaryComment', 'exclusionSummaryComment');
          applyIfFound('governanceCommentNotFound', 'governanceComment', 'governanceComment');
          applyIfFound('envRiskMotivationNotFound', 'envRiskMotivation', 'envRiskMotivation');
          applyIfFound('socialRiskMotivationNotFound', 'socialRiskMotivation', 'socialRiskMotivation');
          applyIfFound('govRiskMotivationNotFound', 'govRiskMotivation', 'govRiskMotivation');
          applyIfFound('paiSummaryCommentNotFound', 'paiSummaryComment', 'paiSummaryComment');
          applyIfFound('promotedCharacteristicsCommentNotFound', 'promotedCharacteristicsComment', 'promotedCharacteristicsComment');
          applyIfFound('contributesToClimateGoalCommentNotFound', 'contributesToClimateGoalComment', 'contributesToClimateGoalComment');
          applyIfFound('strengthensPortfolioGoalCommentNotFound', 'strengthensPortfolioGoalComment', 'strengthensPortfolioGoalComment');
          applyIfFound('taxonomyCommentNotFound', 'taxonomyComment', 'taxonomyComment');
          applyIfFound('dataQualityCommentNotFound', 'dataQualityComment', 'dataQualityComment');
          applyIfFound('engagementCommentNotFound', 'engagementComment', 'engagementComment');
          
          // Article 9: Sustainable goal category
          applySelectIfFound('sustainableGoalCategoryNotFound', 'sustainableGoalCategory', 'sustainableGoalCategory',
            ['climate_mitigation', 'climate_adaptation', 'water', 'circular_economy', 'pollution', 'biodiversity']);
          
          // Allocation comment
          applyIfFound('allocationCommentNotFound', 'allocationComment', 'allocationComment');
          
          // ESG Decision
          applyIfFound('esgDecisionMotivationNotFound', 'esgDecisionMotivation', 'esgDecisionMotivation');
          applySelectIfFound('esgDecisionNotFound', 'esgDecision', 'esgDecision', ['approved', 'rejected']);
          
          return { ...prev, ...updates };
        });
        
        // Store AI field sources
        setFieldSources(prev => ({
          ...prev,
          complianceMotivation: s.complianceMotivationSource ? {
            ...s.complianceMotivationSource,
            source: 'ai_analysis',
            confidence: s.complianceMotivationNotFound ? 'not_found' : s.complianceMotivationConfidence || 'medium',
            basedOn: s.complianceMotivationSource.basedOn,
            reasoning: s.complianceMotivationSource.reasoning,
          } : prev.complianceMotivation,
          placementRestrictions: s.placementRestrictionsSource ? {
            ...s.placementRestrictionsSource,
            source: 'ai_analysis',
            confidence: s.placementRestrictionsNotFound ? 'not_found' : s.placementRestrictionsConfidence || 'medium',
          } : prev.placementRestrictions,
          valuationMethod: s.valuationMethodSource ? {
            ...s.valuationMethodSource,
            source: 'ai_analysis',
            confidence: s.valuationMethodNotFound ? 'not_found' : s.valuationMethodConfidence || 'medium',
          } : prev.valuationMethod,
          environmentalCharacteristics: s.environmentalCharacteristicsSource ? {
            ...s.environmentalCharacteristicsSource,
            source: 'ai_analysis',
            confidence: s.environmentalCharacteristicsNotFound ? 'not_found' : s.environmentalCharacteristicsConfidence || 'medium',
          } : prev.environmentalCharacteristics,
          socialCharacteristics: s.socialCharacteristicsSource ? {
            ...s.socialCharacteristicsSource,
            source: 'ai_analysis',
            confidence: s.socialCharacteristicsNotFound ? 'not_found' : s.socialCharacteristicsConfidence || 'medium',
          } : prev.socialCharacteristics,
          liquidityMotivation: s.liquidityMotivationSource ? {
            ...s.liquidityMotivationSource,
            source: 'ai_analysis',
            confidence: s.liquidityMotivationNotFound ? 'not_found' : s.liquidityMotivationConfidence || 'medium',
          } : prev.liquidityMotivation,
          marketabilityMotivation: s.marketabilityMotivationSource ? {
            ...s.marketabilityMotivationSource,
            source: 'ai_analysis',
            confidence: s.marketabilityMotivationNotFound ? 'not_found' : s.marketabilityMotivationConfidence || 'medium',
          } : prev.marketabilityMotivation,
        }));
      }

    } catch (error) {
      console.error('[AI Analysis] Error:', error);
      throw error; // Re-throw so handleAgentAnalyze can catch it
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Combined Agent Analysis: ESG API + AI Analysis in one click
  const handleAgentAnalyze = async () => {
    const id = formData.isin || formData.ticker;
    if (!id || !formData.fundId || !formData.securityData) {
      setEsgApiError('Ange ISIN/symbol och välj fond först.');
      return;
    }

    setIsAgentAnalyzing(true);
    setAgentComplete(false);
    setAgentError(null);
    setEsgApiError(null);
    setEsgApiSuccess(null);
    setAgentStepIndex(0);
    setAgentProgress('Hämtar ESG-data från API...');

    try {
      // Step 1: Fetch ESG data from API
      console.log('[Agent] Step 1: Fetching ESG data for:', id);
      const esgRes = await fetch(`/api/securities/esg?identifier=${encodeURIComponent(id)}`);
      const esgData = await esgRes.json();
      if (esgRes.ok && esgData.esgSummary) {
        applyESGSummaryToFormData(esgData.esgSummary, esgFundConfig ?? null);
        console.log('[Agent] ESG data applied successfully');
      } else {
        console.warn('[Agent] ESG data not available, continuing with AI analysis');
      }

      // Step 2: Run AI analysis
      setAgentStepIndex(1);
      setAgentProgress('Analyserar med AI...');
      console.log('[Agent] Step 2: Running AI analysis');
      await handleAnalyze();

      // Step 3: Done
      setAgentStepIndex(2);
      setAgentComplete(true);
      setEsgApiSuccess('Agenten har fyllt i alla tillgängliga fält.');

    } catch (error) {
      console.error('[Agent] Error:', error);
      const msg = error instanceof Error ? error.message : 'Agentanalys misslyckades';
      setAgentError(msg);
      setEsgApiError(msg);
    } finally {
      setIsAgentAnalyzing(false);
      setAgentProgress('');
    }
  };

  // Handle fund selection
  const handleFundSelect = (fundId: string) => {
    const fund = availableFunds.find(f => f.id === fundId);
    if (fund) {
      setFormData(prev => ({
        ...prev,
        fundId: fund.id,
        fundName: fund.name,
        fundArticle: fund.article,
        article8Or9Fund: fund.article === '8' || fund.article === '9',
      }));
      setHasUnsavedChanges(true);
      
      // Check restrictions after fund selection
      if (formData.securityData) {
        setTimeout(() => checkRestrictions(), 500);
        // Auto-trigger agent analysis (ESG + AI) when fund is selected and security data exists
        setTimeout(() => handleAgentAnalyze(), 1500);
      }
    }
  };

  // Save draft (manual)
  const handleSaveDraft = async () => {
    if (!formData.fundId) {
      setSaveMessage('Välj fond först');
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/securities/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          formData,
          fundId: formData.fundId,
          fundName: formData.fundName,
          createdBy: 'Current User',
          createdByEmail: 'user@aifm.se',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDraftId(data.draftId);
        setLastSaved(data.updatedAt);
        setHasUnsavedChanges(false);
        setSaveMessage('Utkast sparat');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage('Kunde inte spara');
      }
    } catch (error) {
      setSaveMessage('Kunde inte spara');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit for approval
  // ESG validation before submit
  const validateESG = (): string[] => {
    const warnings: string[] = [];
    if (formData.article8Or9Fund) {
      if (!formData.meetsExclusionCriteria) {
        warnings.push('Värdepappret uppfyller inte fondens exkluderingskriterier. Artikel 8/9-fonder kräver att investeringar klarar exkluderingsscreening.');
      }
      if (!formData.paiConsidered) {
        warnings.push('PAI (Principal Adverse Impacts) har inte beaktats. Detta krävs normalt för Artikel 8/9-fonder.');
      }
      if (!formData.environmentalCharacteristics?.trim()) {
        warnings.push('Inga miljörelaterade egenskaper har angivits.');
      }
      if (!formData.socialCharacteristics?.trim()) {
        warnings.push('Inga sociala egenskaper har angivits.');
      }
    }
    return warnings;
  };

  const handleSubmit = async () => {
    // Check ESG warnings before submitting
    const warnings = validateESG();
    if (warnings.length > 0 && !showEsgWarning) {
      setEsgWarnings(warnings);
      setShowEsgWarning(true);
      return; // Show warning first, user must confirm
    }
    setShowEsgWarning(false);
    setEsgWarnings([]);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/securities/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fundId: formData.fundId,
          fundName: formData.fundName,
          createdBy: 'Current User', // Would come from session
          createdByEmail: 'user@aifm.se',
          basicInfo: {
            name: formData.name,
            category: formData.category,
            type: formData.type,
            isUCITS_ETF: formData.isUCITS_ETF,
            ticker: formData.ticker,
            isin: formData.isin,
            marketPlace: formData.securityData?.exchangeCode || '',
            listingType: formData.listingType,
            mic: formData.mic,
            securityUrl: formData.securityUrl,
            currency: formData.currency,
            country: formData.country,
            emitter: formData.emitter,
            emitterLEI: formData.emitterLEI,
            gicsSector: formData.gicsSector,
            conflictsOfInterest: formData.conflictsOfInterest,
          },
          fundCompliance: {
            fundId: formData.fundId,
            fundName: formData.fundName,
            complianceMotivation: formData.complianceMotivation,
            placementRestrictions: formData.placementRestrictions,
          },
          regulatoryFFFS: {
            limitedPotentialLoss: formData.limitedPotentialLoss,
            liquidityNotEndangered: formData.liquidityNotEndangered,
            reliableValuation: {
              type: formData.reliableValuationType,
              checked: formData.reliableValuationChecked,
            },
            appropriateInformation: {
              type: formData.appropriateInfoType,
              checked: formData.appropriateInfoChecked,
            },
            isMarketable: formData.isMarketable,
            compatibleWithFund: formData.compatibleWithFund,
            riskManagementCaptures: formData.riskManagementCaptures,
          },
          regulatoryLVF: {
            stateGuaranteed: formData.stateGuaranteed ? {
              applicable: true,
              maxExposure35Percent: formData.stateGuaranteedMax35,
            } : undefined,
            nonVotingShares: formData.nonVotingShares ? {
              applicable: true,
              maxIssuedShares10Percent: formData.nonVotingSharesMax10,
            } : undefined,
            bondOrMoneyMarket: formData.bondOrMoneyMarket ? {
              applicable: true,
              maxIssuedInstruments10Percent: formData.bondMax10Issued,
            } : undefined,
            significantInfluence: {
              willHaveInfluence: formData.significantInfluence,
            },
          },
          liquidityAnalysis: {
            instrumentType: formData.liquidityInstrumentType || undefined,
            averageDailyVolume: formData.averageDailyVolume || undefined,
            averageDailyPrice: formData.averageDailyPrice || undefined,
            averageDailyValueSEK: formData.averageDailyValueSEK || undefined,
            stockLiquidity: {
              presumption400MSEK: formData.stockLiquidityPresumption,
              canLiquidate1Day: formData.canLiquidate1Day,
              canLiquidate2Days: formData.canLiquidate2Days,
              canLiquidate3Days: formData.canLiquidate3Days,
              moreThan3Days: formData.moreThan3Days,
            },
            noHistoryEstimate: formData.noHistoryEstimate,
            portfolioIlliquidShareBefore: parseFloat(formData.portfolioIlliquidBefore) || undefined,
            portfolioIlliquidShareAfter: parseFloat(formData.portfolioIlliquidAfter) || undefined,
            portfolioMotivation: formData.portfolioMotivation,
            fffsLiquidityNotEndangered: formData.liquidityNotEndangered,
            fffsIsMarketable: formData.isMarketable,
            howLiquidityRequirementMet: formData.liquidityRequirementMotivation,
            howMarketabilityRequirementMet: formData.marketabilityMotivation,
          },
          valuationInfo: {
            reliableDailyPrices: formData.reliableDailyPrices,
            priceSourceUrl: formData.priceSourceUrl,
            priceSourceComment: formData.priceSourceComment,
            isEmission: formData.isEmission,
            emissionValuationMethod: formData.emissionValuationMethod,
            proposedValuationMethod: formData.proposedValuationMethod,
          },
          esgInfo: {
            article8Or9Fund: formData.article8Or9Fund,
            environmentalCharacteristics: formData.environmentalCharacteristics,
            socialCharacteristics: formData.socialCharacteristics,
            meetsExclusionCriteria: formData.meetsExclusionCriteria,
            meetsSustainableInvestmentMinimum: formData.meetsSustainableMinimum,
            paiConsidered: formData.paiConsidered,
            article9NoSignificantHarm: formData.article9NoSignificantHarm,
            article9GoodGovernance: formData.article9GoodGovernance,
            article9OECDCompliant: formData.article9OECDCompliant,
            article9UNGPCompliant: formData.article9UNGPCompliant,
            fundArticle: formData.fundArticle,
            normScreening: {
              UNGC: formData.normScreeningUNGC,
              OECD: formData.normScreeningOECD,
              humanRights: formData.normScreeningHumanRights,
              antiCorruption: formData.normScreeningAntiCorruption,
              controversy: formData.normScreeningControversy,
              controversyLevel: formData.controversyLevel,
              comment: formData.normScreeningComment,
            },
            exclusionResults: formData.exclusionResults,
            governance: {
              structure: formData.governanceStructure,
              compensation: formData.compensationSystem,
              taxCompliance: formData.taxCompliance,
              antiCorruption: formData.antiCorruption,
              transparency: formData.transparencyReporting,
              controversies: formData.governanceControversies,
              comment: formData.governanceComment,
            },
            envRiskLevel: formData.envRiskLevel,
            socialRiskLevel: formData.socialRiskLevel,
            govRiskLevel: formData.govRiskLevel,
            ghgData: formData.ghgData,
            sbtiTarget: formData.sbtiTarget,
            fossilExposurePercent: formData.fossilExposurePercent,
            pai: {
              ghgScope1: formData.paiGhgScope1,
              ghgScope2: formData.paiGhgScope2,
              ghgScope3: formData.paiGhgScope3,
              carbonIntensity: formData.paiCarbonIntensity,
              fossilExposure: formData.paiFossilExposure,
              biodiversity: formData.paiBiodiversity,
              waterDischarge: formData.paiWaterDischarge,
              hazardousWaste: formData.paiHazardousWaste,
              wageGap: formData.paiWageGap,
              boardDiversity: formData.paiBoardDiversity,
              controversialWeapons: formData.paiControversialWeapons,
              summaryComment: formData.paiSummaryComment,
            },
            sustainableGoalCategory: formData.sustainableGoalCategory,
            revenueCapExFromSustainable: formData.revenueCapExFromSustainable,
            taxonomyQualifiedPercent: formData.taxonomyQualifiedPercent,
            taxonomyAlignedPercent: formData.taxonomyAlignedPercent,
            allocationBeforePercent: formData.allocationBeforePercent,
            allocationAfterPercent: formData.allocationAfterPercent,
            promotedCharacteristicsResult: formData.promotedCharacteristicsResult,
            esgDecision: formData.esgDecision,
            esgDecisionMotivation: formData.esgDecisionMotivation,
            engagementRequired: formData.engagementRequired,
            engagementComment: formData.engagementComment,
          },
          plannedAcquisitionShare: formData.plannedAcquisitionShare,
        }),
      });

      if (response.ok) {
        const approval = await response.json();
        
        // Submit for review
        await fetch('/api/securities/approvals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: approval.id,
            action: 'submit',
          }),
        });

        router.push('/securities?submitted=true');
      }
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step navigation
  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.securityData !== null;
      case 2:
        return formData.name && formData.category && formData.type && formData.isin && !isinError;
      case 3:
        return formData.fundId && formData.complianceMotivation;
      default:
        return true;
    }
  };

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderLookupStep();
      case 2:
        return renderBasicInfoStep();
      case 3:
        return renderFundComplianceStep();
      case 4:
        return renderFFFS_Step();
      case 5:
        return renderLVF_Step();
      case 6:
        return renderLiquidityStep();
      case 7:
        return renderValuationStep();
      case 8:
        return formData.fundArticle === '6' ? renderESG_Step() : renderNormScreeningStep();
      case 9:
        return renderExclusionStep();
      case 10:
        return renderGovernanceStep();
      case 11:
        return formData.fundArticle === '9' ? renderSustainableGoalStep() : renderESGRiskStep();
      case 12:
        return formData.fundArticle === '9' ? renderDNSHPAIStep() : renderPAIStep();
      case 13:
        return formData.fundArticle === '9' ? renderESGRiskStep() : renderESGSummaryStep();
      case 14:
        return renderTaxonomyStep();
      case 15:
        return renderAllocationStep();
      case 16:
        return renderESGSummaryStep();
      default:
        return null;
    }
  };

  // Step 1: Lookup
  const renderLookupStep = () => (
    <div className="space-y-6">
      <div className="bg-aifm-gold/5 border border-aifm-gold/20 rounded-xl p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-aifm-gold flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-aifm-charcoal">Sök efter värdepapper</p>
            <p className="text-sm text-aifm-charcoal/70 mt-1">
              Ange ISIN-kod och valfritt MIC-kod för att automatiskt hämta information om värdepappret.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">
            ISIN-kod *
          </label>
          <input
            type="text"
            value={formData.isin}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
              updateField('isin', v);
              const res = validateISIN(v);
              setIsinError(res.valid ? null : res.message ?? null);
            }}
            onBlur={() => {
              if (formData.isin.trim()) {
                const res = validateISIN(formData.isin);
                setIsinError(res.valid ? null : res.message ?? null);
              } else {
                setIsinError(null);
              }
            }}
            placeholder="SE0000115446"
            maxLength={12}
            className={`w-full px-4 py-3 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors ${isinError ? 'border-red-500' : 'border-gray-200'}`}
          />
          {isinError && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {isinError}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">
            MIC (valfritt)
          </label>
          <input
            type="text"
            value={formData.mic}
            onChange={(e) => updateField('mic', e.target.value.toUpperCase())}
            placeholder="XSTO"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">
            Ticker (alternativ)
          </label>
          <input
            type="text"
            value={formData.ticker}
            onChange={(e) => updateField('ticker', e.target.value.toUpperCase())}
            placeholder="VOLV-B"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
      </div>

      <button
        onClick={handleLookup}
        disabled={isLookingUp || (!formData.isin && !formData.ticker) || !!isinError}
        className="flex items-center gap-2 px-4 py-2 bg-aifm-charcoal text-white rounded-lg hover:bg-aifm-charcoal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLookingUp ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Search className="w-4 h-4" />
        )}
        Sök värdepapper
      </button>

      {lookupError && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          {lookupError}
        </div>
      )}

      {formData.securityData && (
        <div className="space-y-4">
          {/* Success header */}
          <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-aifm-gold flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-aifm-charcoal text-lg">{formData.securityData.name}</p>
                  {formData.securityData.isRegulatedMarket && (
                    <span className="px-2.5 py-0.5 text-xs font-medium bg-aifm-gold/15 text-aifm-charcoal rounded-full">
                      Reglerad marknad
                    </span>
                  )}
                </div>
                <p className="text-sm text-aifm-charcoal/60 mt-1">
                  {autoFilledFields.length} fält fylldes i automatiskt från {sourcesUsed.length} källor
                </p>
                {sourcesUsed.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {sourcesUsed.map(source => (
                      <span key={source.id} className="px-2.5 py-0.5 text-xs bg-aifm-gold/10 text-aifm-charcoal/70 rounded-full">
                        {source.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Warnings from lookup */}
          {lookupWarnings.length > 0 && (
            <div className="bg-aifm-gold/8 border border-aifm-gold/25 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-aifm-gold flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-aifm-charcoal">Viss information kunde inte hämtas</p>
                  <ul className="text-sm text-aifm-charcoal/60 mt-1 space-y-1">
                    {lookupWarnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Auto-filled data grid with source indicators */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <p className="text-sm font-medium text-aifm-charcoal">Automatiskt ifylld information</p>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Klicka på ? för att se källa</span>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Ticker</p>
                  {fieldSources.ticker && <SourceIndicator source={fieldSources.ticker} />}
                </div>
                <p className="font-medium text-gray-900">{formData.ticker || '-'}</p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">ISIN</p>
                  {fieldSources.isin && <SourceIndicator source={fieldSources.isin} />}
                </div>
                <p className="font-medium text-gray-900">{formData.isin || '-'}</p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Börs (MIC)</p>
                  {fieldSources.exchangeName && <SourceIndicator source={fieldSources.exchangeName} />}
                </div>
                <p className="font-medium text-gray-900">
                  {formData.securityData.micInfo?.name || formData.mic || '-'}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Värdepapperstyp</p>
                  {fieldSources.type && <SourceIndicator source={fieldSources.type} />}
                </div>
                <p className="font-medium text-gray-900">{formData.securityData.securityType || '-'}</p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Kategori</p>
                  {fieldSources.category && <SourceIndicator source={fieldSources.category} />}
                </div>
                <p className="font-medium text-gray-900">
                  {formData.category === 'transferable_security' ? 'Överlåtbart värdepapper' : 
                   formData.category === 'fund_unit' ? 'Fondandel' :
                   formData.category === 'derivative' ? 'Derivat' : formData.category || '-'}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Typ</p>
                  {fieldSources.type && <SourceIndicator source={fieldSources.type} />}
                </div>
                <p className="font-medium text-gray-900">
                  {formData.type === 'stock' ? 'Aktie' :
                   formData.type === 'etf' ? 'ETF' :
                   formData.type === 'bond' ? 'Obligation' :
                   formData.type === 'fund' ? 'Fond' : formData.type || '-'}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Valuta</p>
                  {fieldSources.currency && <SourceIndicator source={fieldSources.currency} />}
                </div>
                <p className="font-medium text-gray-900">{formData.currency || '-'}</p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Land</p>
                  {fieldSources.country && <SourceIndicator source={fieldSources.country} />}
                </div>
                <p className="font-medium text-gray-900">
                  {formData.securityData.countryName || formData.country || '-'}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Emittent</p>
                  {fieldSources.emitter && <SourceIndicator source={fieldSources.emitter} />}
                </div>
                <p className="font-medium text-gray-900">{formData.emitter || '-'}</p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">LEI</p>
                  {fieldSources.emitterLEI && <SourceIndicator source={fieldSources.emitterLEI} />}
                </div>
                <p className="font-medium text-gray-900">
                  {formData.emitterLEI || (fieldSources.emitterLEI?.confidence === 'not_found' ? 
                    <span className="text-aifm-gold text-xs">Ej funnet</span> : '-')}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Sektor</p>
                  {fieldSources.gicsSector && <SourceIndicator source={fieldSources.gicsSector} />}
                </div>
                <p className="font-medium text-gray-900">
                  {formData.gicsSector || (fieldSources.gicsSector?.confidence === 'not_found' ? 
                    <span className="text-aifm-gold text-xs">Ej funnet</span> : '-')}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Noteringstyp</p>
                  {fieldSources.listingType && <SourceIndicator source={fieldSources.listingType} />}
                </div>
                <p className="font-medium text-gray-900">
                  {formData.listingType === 'regulated_market' ? 'Reglerad marknad' :
                   formData.listingType === 'other_regulated' ? 'Annan reglerad marknad' : 
                   formData.listingType || '-'}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Likviditetspresumtion</p>
                  {fieldSources.meetsLiquidityPresumption && <SourceIndicator source={fieldSources.meetsLiquidityPresumption} />}
                </div>
                <p className="font-medium text-gray-900">
                  {formData.stockLiquidityPresumption ? '✓ Uppfylld (>400 MSEK)' : 'Ej uppfylld'}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Dagliga priser</p>
                  {fieldSources.reliableDailyPrices && <SourceIndicator source={fieldSources.reliableDailyPrices} />}
                </div>
                <p className="font-medium text-gray-900">
                  {formData.reliableDailyPrices ? '✓ Ja' : 'Nej'}
                </p>
              </div>
            </div>
          </div>

          {/* Regulatory defaults info */}
          {formData.securityData.isRegulatedMarket && (
            <div className="bg-aifm-gold/5 border border-aifm-gold/20 rounded-xl p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-aifm-gold flex-shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-aifm-charcoal">Regulatoriska krav förifyllda</p>
                    {fieldSources.limitedPotentialLoss && (
                      <SourceIndicator source={fieldSources.limitedPotentialLoss} />
                    )}
                  </div>
                  <p className="text-sm text-aifm-charcoal/70 mt-1">
                    Eftersom värdepappret är noterat på en reglerad marknad har de flesta regulatoriska krav (FFFS 2013:9) 
                    automatiskt markerats som uppfyllda enligt presumtionsregeln. Du kan granska och justera dessa i steg 4.
                  </p>
                  <p className="text-xs text-aifm-gold mt-2">
                    Källa: FFFS 2013:9, 24 kap. 1 § - presumtion för värdepapper på reglerad marknad
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Step 2: Basic Info
  const renderBasicInfoStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SourcedInput
          label="Namn"
          value={formData.name}
          onChange={(v) => updateField('name', v)}
          source={fieldSources.name}
          required
        />
        <SourcedInput
          label="Emittent"
          value={formData.emitter}
          onChange={(v) => updateField('emitter', v)}
          source={fieldSources.emitter}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SourcedInput
          label="Emittent LEI"
          value={formData.emitterLEI}
          onChange={(v) => updateField('emitterLEI', v)}
          source={fieldSources.emitterLEI}
          placeholder="549300..."
        />
        <SourcedInput
          label="GICS-sektor"
          value={formData.gicsSector}
          onChange={(v) => updateField('gicsSector', v)}
          source={fieldSources.gicsSector}
          placeholder="Industrials"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">Kategori *</label>
          <select
            value={formData.category}
            onChange={(e) => updateField('category', e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          >
            <option value="">Välj...</option>
            <option value="transferable_security">Överlåtbart värdepapper</option>
            <option value="money_market">Penningmarknadsinstrument</option>
            <option value="fund_unit">Fondandel</option>
            <option value="derivative">Derivat</option>
            <option value="other">Annat</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">Typ *</label>
          <select
            value={formData.type}
            onChange={(e) => updateField('type', e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          >
            <option value="">Välj...</option>
            <option value="stock">Aktie</option>
            <option value="bond">Obligation</option>
            <option value="etf">ETF</option>
            <option value="fund">Fond</option>
            <option value="certificate">Certifikat</option>
            <option value="warrant">Teckningsoption</option>
            <option value="option">Option</option>
            <option value="future">Termin</option>
            <option value="other">Annat</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">Typ av notering</label>
          <select
            value={formData.listingType}
            onChange={(e) => updateField('listingType', e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          >
            <option value="regulated_market">Reglerad marknad</option>
            <option value="other_regulated">Annan reglerad marknad</option>
            <option value="planned_regulated">Planerad notering (reglerad)</option>
            <option value="planned_other">Planerad notering (annan)</option>
            <option value="unlisted">Onoterat</option>
          </select>
        </div>
      </div>

      {formData.type === 'etf' && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ucitsEtf"
            checked={formData.isUCITS_ETF}
            onChange={(e) => updateField('isUCITS_ETF', e.target.checked)}
            className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
          />
          <label htmlFor="ucitsEtf" className="text-sm text-aifm-charcoal/80">UCITS-ETF</label>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">Valuta</label>
          <input
            type="text"
            value={formData.currency}
            onChange={(e) => updateField('currency', e.target.value.toUpperCase())}
            placeholder="SEK"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">Land</label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) => updateField('country', e.target.value.toUpperCase())}
            placeholder="SE"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">Emittent LEI</label>
          <input
            type="text"
            value={formData.emitterLEI}
            onChange={(e) => updateField('emitterLEI', e.target.value)}
            placeholder="549300..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">GICS-sektor</label>
          <input
            type="text"
            value={formData.gicsSector}
            onChange={(e) => updateField('gicsSector', e.target.value)}
            placeholder="Industrials"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Länk till värdepapper</label>
        <input
          type="url"
          value={formData.securityUrl}
          onChange={(e) => updateField('securityUrl', e.target.value)}
          placeholder="https://..."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Eventuella intressekonflikter</label>
        <textarea
          value={formData.conflictsOfInterest}
          onChange={(e) => updateField('conflictsOfInterest', e.target.value)}
          rows={2}
          placeholder="Beskriv eventuella intressekonflikter..."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors resize-none"
        />
      </div>
    </div>
  );

  // Step 3: Fund Compliance
  const renderFundComplianceStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Välj fond *</label>
        {fundsLoading ? (
          <div className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors bg-gray-50 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Laddar fonder...
          </div>
        ) : fundsError ? (
          <div className="px-4 py-3 border border-red-200/60 rounded-xl bg-red-50/50 text-red-700 text-sm">
            Kunde inte ladda fonder: {fundsError.message}
          </div>
        ) : availableFunds.length === 0 ? (
          <div className="px-4 py-3 border border-aifm-gold/25 rounded-xl bg-aifm-gold/5 text-aifm-charcoal/70 text-sm">
            Inga fonder hittades. Kontrollera att API:et returnerar fonddata.
          </div>
        ) : (
          <select
            value={formData.fundId}
            onChange={(e) => handleFundSelect(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          >
            <option value="">Välj fond...</option>
            {availableFunds.map(fund => (
              <option key={fund.id} value={fund.id}>
                {fund.name} (Artikel {fund.article})
              </option>
            ))}
          </select>
        )}
      </div>

      {formData.fundId && formData.securityData && (
        <div className="space-y-3">
          {!isAgentAnalyzing && !agentComplete && !agentError && (
            <button
              onClick={handleAgentAnalyze}
              disabled={isAgentAnalyzing || isAnalyzing || esgApiLoading}
              className="flex items-center gap-2.5 px-6 py-3 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 disabled:opacity-50 transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Analysera med Agenten
            </button>
          )}
          <AgentProgressBanner
            isActive={isAgentAnalyzing}
            steps={agentSteps}
            currentStepIndex={agentStepIndex}
            estimatedDuration={140}
            isComplete={agentComplete}
            error={agentError}
            successMessage="Agenten har fyllt i alla tillgängliga fält baserat på ESG-data och AI-analys."
            onDismiss={() => { setAgentComplete(false); setAgentError(null); }}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">
          Förenlighet med fondens placeringsbestämmelser *
        </label>
        <textarea
          value={formData.complianceMotivation}
          onChange={(e) => updateField('complianceMotivation', e.target.value)}
          rows={4}
          placeholder="Motivering varför värdepappret är en tillåten tillgång..."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors resize-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          Inkludera kategorisering, hänvisning till §§ i fondbestämmelserna, geografiska/branschmässiga begränsningar etc.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">
          Hänvisning till placeringsbestämmelser
        </label>
        <input
          type="text"
          value={formData.placementRestrictions}
          onChange={(e) => updateField('placementRestrictions', e.target.value)}
          placeholder="T.ex. §4, §5 och §7 i fondbestämmelserna"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">
          Planerad positionsstorlek (% av fond-NAV eller belopp i SEK)
        </label>
        <input
          type="text"
          value={formData.plannedAcquisitionShare}
          onChange={(e) => updateField('plannedAcquisitionShare', e.target.value)}
          placeholder="T.ex. 2.5 (= 2.5% av NAV) eller 5000000 (= 5 MSEK)"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
        />
        <p className="text-xs text-gray-500 mt-1">
          Värden ≤100 tolkas som % av fondens NAV
          {formData.fundId && (() => {
            const fund = availableFunds.find(f => f.id === formData.fundId);
            return fund ? ` (${(fund.nav / 1e6).toFixed(0)} MSEK)` : '';
          })()}
          . Värden &gt;100 tolkas som belopp i SEK. Används för automatisk likviditetsberäkning i steg 6.
        </p>
      </div>
    </div>
  );

  // Step 4: FFFS 2013:9
  const renderFFFS_Step = () => (
    <div className="space-y-6">
      <div className="bg-aifm-gold/8 border border-aifm-gold/25 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>FFFS 2013:9, 24 kap. 1 §</strong> - Krav på överlåtbara värdepapper
        </p>
      </div>

      <div className="space-y-4">
        {[
          { field: 'limitedPotentialLoss', label: '1 pt. Den potentiella förlusten är begränsad till det betalda beloppet' },
          { field: 'liquidityNotEndangered', label: '2 pt. Likviditeten äventyrar inte fondbolagets förmåga att uppfylla kraven i 4 kap. 13 § LVF' },
        ].map(item => (
          <label key={item.field} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={formData[item.field as keyof FormData] as boolean}
              onChange={(e) => updateField(item.field as keyof FormData, e.target.checked)}
              className="mt-0.5 w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
            />
            <span className="text-sm text-aifm-charcoal/80">{item.label}</span>
          </label>
        ))}

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-aifm-charcoal mb-2">3 pt. Tillförlitlig värdering</p>
          <select
            value={formData.reliableValuationType}
            onChange={(e) => updateField('reliableValuationType', e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors mb-2"
          >
            <option value="market_price">a) Marknadspriser</option>
            <option value="independent_system">a) Oberoende värderingssystem</option>
            <option value="emitter_info">b) Information från emittent (5 kap. 5 § LVF)</option>
            <option value="investment_analysis">b) Kvalificerad investeringsanalys (5 kap. 5 § LVF)</option>
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.reliableValuationChecked}
              onChange={(e) => updateField('reliableValuationChecked', e.target.checked)}
              className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
            />
            <span className="text-sm text-aifm-charcoal/80">Kravet uppfylls</span>
          </label>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-aifm-charcoal mb-2">4 pt. Lämplig information tillgänglig</p>
          <select
            value={formData.appropriateInfoType}
            onChange={(e) => updateField('appropriateInfoType', e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors mb-2"
          >
            <option value="regular_market_info">a) Regelbunden information till marknaden</option>
            <option value="regular_fund_info">b) Regelbunden information till fondbolaget</option>
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.appropriateInfoChecked}
              onChange={(e) => updateField('appropriateInfoChecked', e.target.checked)}
              className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
            />
            <span className="text-sm text-aifm-charcoal/80">Kravet uppfylls</span>
          </label>
        </div>

        {[
          { field: 'isMarketable', label: '5 pt. Värdepappret är försäljningsbart' },
          { field: 'compatibleWithFund', label: '6 pt. Förvärvet är förenligt med fondens placeringsinriktning' },
          { field: 'riskManagementCaptures', label: '7 pt. Riskhanteringssystemet fångar upp riskerna' },
        ].map(item => (
          <label key={item.field} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={formData[item.field as keyof FormData] as boolean}
              onChange={(e) => updateField(item.field as keyof FormData, e.target.checked)}
              className="mt-0.5 w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
            />
            <span className="text-sm text-aifm-charcoal/80">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  // Step 5: LVF
  const renderLVF_Step = () => (
    <div className="space-y-6">
      <div className="bg-aifm-gold/8 border border-aifm-gold/25 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>LVF 2004:46</strong> - Lagen om värdepappersfonder
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.stateGuaranteed}
              onChange={(e) => updateField('stateGuaranteed', e.target.checked)}
              className="mt-0.5 w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
            />
            <span className="text-sm text-aifm-charcoal/80">5 kap. 6 § 1 pt. Garanterad av stat eller kommun?</span>
          </label>
          {formData.stateGuaranteed && (
            <label className="flex items-center gap-2 ml-7">
              <input
                type="checkbox"
                checked={formData.stateGuaranteedMax35}
                onChange={(e) => updateField('stateGuaranteedMax35', e.target.checked)}
                className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
              />
              <span className="text-sm text-gray-600">Max 35% emittentexponering uppfylls</span>
            </label>
          )}
        </div>

        <div className="p-4 bg-gray-50 rounded-lg space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.nonVotingShares}
              onChange={(e) => updateField('nonVotingShares', e.target.checked)}
              className="mt-0.5 w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
            />
            <span className="text-sm text-aifm-charcoal/80">5 kap. 19 § 1 pt. Aktier utan rösträtt?</span>
          </label>
          {formData.nonVotingShares && (
            <label className="flex items-center gap-2 ml-7">
              <input
                type="checkbox"
                checked={formData.nonVotingSharesMax10}
                onChange={(e) => updateField('nonVotingSharesMax10', e.target.checked)}
                className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
              />
              <span className="text-sm text-gray-600">Max 10% av utgivna aktier uppfylls</span>
            </label>
          )}
        </div>

        <div className="p-4 bg-gray-50 rounded-lg space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.bondOrMoneyMarket}
              onChange={(e) => updateField('bondOrMoneyMarket', e.target.checked)}
              className="mt-0.5 w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
            />
            <span className="text-sm text-aifm-charcoal/80">5 kap. 19 § 2-3 pt. Obligation eller penningmarknadsinstrument?</span>
          </label>
          {formData.bondOrMoneyMarket && (
            <label className="flex items-center gap-2 ml-7">
              <input
                type="checkbox"
                checked={formData.bondMax10Issued}
                onChange={(e) => updateField('bondMax10Issued', e.target.checked)}
                className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
              />
              <span className="text-sm text-gray-600">Max 10% av utgivna instrument uppfylls</span>
            </label>
          )}
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.significantInfluence}
              onChange={(e) => updateField('significantInfluence', e.target.checked)}
              className="mt-0.5 w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
            />
            <span className="text-sm text-aifm-charcoal/80">
              5 kap. 20 § Förvärvet innebär möjlighet att utöva väsentligt inflytande över ledningen
            </span>
          </label>
        </div>
      </div>
    </div>
  );

  // Step 6: Liquidity
  const renderLiquidityStep = () => {
    // Helper function to format large numbers
    const formatNumber = (num: number | null | undefined): string => {
      if (num === null || num === undefined) return '-';
      if (num >= 1e9) return `${(num / 1e9).toFixed(1)} mdr`;
      if (num >= 1e6) return `${(num / 1e6).toFixed(1)} MSEK`;
      if (num >= 1e3) return `${(num / 1e3).toFixed(1)} KSEK`;
      return num.toFixed(0);
    };

    // Check if this is a US ETF (not allowed)
    const isUSETF = formData.type === 'etf' && formData.country === 'US';
    const isNonUCITSETF = formData.type === 'etf' && !formData.isUCITS_ETF;

    return (
    <div className="space-y-6">
      <div className="bg-aifm-gold/5 border border-aifm-gold/20 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>Likviditetsanalys</strong> - Bedöm hur snabbt positionen kan likvideras
        </p>
      </div>

      {/* Instrument Type Selection */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">
            Typ av instrument *
          </label>
          <select
            value={formData.liquidityInstrumentType}
            onChange={(e) => updateField('liquidityInstrumentType', e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          >
            <option value="">Välj instrumenttyp...</option>
            <option value="stock">Aktie</option>
            <option value="bond">Ränteinstrument / Obligation</option>
            <option value="etf">ETF</option>
            <option value="fund">Fondandel</option>
            <option value="derivative">Derivat</option>
            <option value="money_market">Penningmarknadsinstrument</option>
            <option value="other">Annat</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Välj den typ av instrument som bäst beskriver värdepappret för likviditetsanalysen.
          </p>
        </div>

        {/* ETF Warnings */}
        {formData.liquidityInstrumentType === 'etf' && (
          <div className="space-y-3">
            {isUSETF && (
              <div className="bg-red-50/50 border border-red-200/50 rounded-xl p-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Amerikanska ETF:er är ej tillåtna</p>
                    <p className="text-sm text-red-700 mt-1">
                      ETF:er noterade i USA är inte tillåtna för europeiska UCITS-fonder. Endast UCITS-ETF:er är tillåtna.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {isNonUCITSETF && !isUSETF && (
              <div className="bg-aifm-gold/8 border border-aifm-gold/25 rounded-xl p-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-aifm-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-aifm-charcoal">UCITS-ETF krävs</p>
                    <p className="text-sm text-aifm-charcoal/60 mt-1">
                      Endast UCITS-ETF:er är tillåtna. Kontrollera att ETF:en är klassificerad som UCITS i steg 2.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="bg-aifm-gold/5 border border-aifm-gold/20 rounded-xl p-4">
              <p className="text-sm text-aifm-charcoal">
                <strong>OBS:</strong> För ETF:er gäller att endast UCITS-ETF:er är tillåtna enligt fondbestämmelserna.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ADV (Average Daily Volume) Display */}
      {(formData.averageDailyValueSEK || formData.averageDailyVolume) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-medium text-aifm-charcoal mb-3">Genomsnittlig daglig omsättning (ADV)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Genomsnittlig daglig volym</p>
              <p className="text-lg font-semibold text-aifm-charcoal">
                {formData.averageDailyVolume ? formData.averageDailyVolume.toLocaleString('sv-SE') : '-'} st
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pris ({formData.currency || 'SEK'})</p>
              <p className="text-lg font-semibold text-aifm-charcoal">
                {formData.averageDailyPrice ? formData.averageDailyPrice.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
              </p>
            </div>
            <div className="bg-aifm-charcoal/5 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Daglig omsättning (SEK)</p>
              <p className="text-lg font-semibold text-aifm-charcoal">
                {formatNumber(formData.averageDailyValueSEK)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            <strong>Beräkning:</strong> Genomsnittlig daglig volym × Pris × Valutakurs = Daglig omsättning i SEK
          </p>
          {formData.averageDailyValueSEK && formData.averageDailyValueSEK >= 400000000 && (
            <div className="mt-3 flex items-center gap-2 text-aifm-charcoal text-sm">
              <CheckCircle2 className="w-4 h-4 text-aifm-gold" />
              <span>Uppfyller likviditetspresumtionen (&gt;400 MSEK)</span>
            </div>
          )}
          {formData.averageDailyValueSEK && formData.averageDailyValueSEK < 400000000 && (
            <div className="mt-3 flex items-center gap-2 text-aifm-gold text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Uppfyller ej likviditetspresumtionen - detaljerad likviditetsanalys krävs</span>
            </div>
          )}
        </div>
      )}

      {/* Auto-calculated liquidity summary */}
      {formData.plannedAcquisitionShare && formData.averageDailyValueSEK && formData.fundId && (() => {
        const fund = availableFunds.find(f => f.id === formData.fundId);
        if (!fund) return null;
        const positionSEK = estimatePositionSEK(formData.plannedAcquisitionShare, fund.nav);
        if (!positionSEK) return null;
        const bucket = calcLiquidationBucket(positionSEK, formData.averageDailyValueSEK!);
        if (!bucket) return null;
        const pctOfNav = ((positionSEK / fund.nav) * 100).toFixed(2);
        const daysText = bucket.canLiquidate1Day ? '1 dag'
          : bucket.canLiquidate2Days ? '2 dagar'
          : bucket.canLiquidate3Days ? '3 dagar'
          : '>3 dagar';
        const isOk = bucket.canLiquidate1Day || bucket.canLiquidate2Days;
        const illiq = calcPortfolioIlliquid(fund.nav, fund.illiquidPercent, positionSEK, bucket.canLiquidate1Day);

        return (
          <div className={`border-2 rounded-xl p-4 ${isOk ? 'bg-aifm-charcoal/5 border-aifm-charcoal/10' : 'bg-aifm-gold/8 border-aifm-gold/25'}`}>
            <div className="flex items-center gap-2 mb-3">
              {isOk ? <CheckCircle2 className="w-5 h-5 text-aifm-charcoal" /> : <AlertCircle className="w-5 h-5 text-aifm-gold" />}
              <h3 className="text-sm font-semibold text-aifm-charcoal">
                Automatisk likviditetsberäkning
              </h3>
              <span className="ml-auto text-xs px-2.5 py-1 bg-aifm-gold/10 text-aifm-charcoal rounded-full font-medium">Auto-beräknad</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs mb-0.5">Positionsvärde (SEK)</p>
                <p className="font-semibold text-gray-900">{(positionSEK / 1e6).toFixed(1)} MSEK</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-0.5">Andel av fond-NAV</p>
                <p className="font-semibold text-gray-900">{pctOfNav}%</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-0.5">Position / Daglig volym</p>
                <p className={`font-semibold ${bucket.ratio < 85 ? 'text-aifm-charcoal' : bucket.ratio < 170 ? 'text-aifm-charcoal/70' : 'text-aifm-charcoal/60'}`}>
                  {bucket.ratio.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-0.5">Likvidationstid</p>
                <p className={`font-semibold ${isOk ? 'text-aifm-charcoal' : 'text-aifm-charcoal/60'}`}>{daysText}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200/50 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs mb-0.5">Portfölj illikvid andel före</p>
                <p className="font-semibold text-gray-900">{illiq.before.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-0.5">Portfölj illikvid andel efter</p>
                <p className={`font-semibold ${illiq.after < 10 ? 'text-aifm-charcoal' : 'text-aifm-charcoal/60'}`}>{illiq.after.toFixed(1)}%</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Beräkning: {(positionSEK / 1e6).toFixed(1)} MSEK / {(formData.averageDailyValueSEK! / 1e6).toFixed(1)} MSEK daglig omsättning = {bucket.ratio.toFixed(1)}% → {daysText}
            </p>
          </div>
        );
      })()}

      {/* Stock-specific liquidity analysis */}
      {(formData.liquidityInstrumentType === 'stock' || (!formData.liquidityInstrumentType && formData.type === 'stock')) && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-aifm-charcoal">Likviditetsanalys för aktier:</p>
          
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              checked={formData.stockLiquidityPresumption}
              onChange={(e) => updateField('stockLiquidityPresumption', e.target.checked)}
              className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
            />
            <span className="text-sm text-aifm-charcoal/80">Likviditetspresumtion (Genomsnittlig daglig volym &gt; 400 MSEK)</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { field: 'canLiquidate1Day', label: '1 dag', sub: 'Position/Daglig volym <85%' },
              { field: 'canLiquidate2Days', label: '2 dagar', sub: 'Position/Daglig volym <170%' },
              { field: 'canLiquidate3Days', label: '3 dagar', sub: 'Position/Daglig volym <250%' },
              { field: 'moreThan3Days', label: '>3 dagar', sub: 'Position/Daglig volym >250%' },
            ].map(item => (
              <button
                key={item.field}
                type="button"
                onClick={() => {
                  updateField('canLiquidate1Day', item.field === 'canLiquidate1Day');
                  updateField('canLiquidate2Days', item.field === 'canLiquidate2Days');
                  updateField('canLiquidate3Days', item.field === 'canLiquidate3Days');
                  updateField('moreThan3Days', item.field === 'moreThan3Days');
                }}
                className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  formData[item.field as keyof FormData]
                    ? 'border-aifm-charcoal bg-aifm-charcoal/5 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <span className={`block text-sm font-medium ${formData[item.field as keyof FormData] ? 'text-aifm-charcoal' : 'text-gray-600'}`}>{item.label}</span>
                <span className="block text-xs text-gray-400 mt-0.5">{item.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bond/Fixed Income specific */}
      {formData.liquidityInstrumentType === 'bond' && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-aifm-charcoal">Likviditetsanalys för ränteinstrument:</p>
          <div className="bg-aifm-gold/5 border border-aifm-gold/20 rounded-xl p-4">
            <p className="text-sm text-aifm-charcoal">
              För ränteinstrument baseras likviditetsanalysen på marknadslikviditet, bid-ask spread och genomsnittlig handelsvolym.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { field: 'canLiquidate1Day', label: '1 dag' },
              { field: 'canLiquidate2Days', label: '2 dagar' },
              { field: 'canLiquidate3Days', label: '3 dagar' },
              { field: 'moreThan3Days', label: '>3 dagar' },
            ].map(item => (
              <button key={item.field} type="button" onClick={() => { updateField('canLiquidate1Day', item.field === 'canLiquidate1Day'); updateField('canLiquidate2Days', item.field === 'canLiquidate2Days'); updateField('canLiquidate3Days', item.field === 'canLiquidate3Days'); updateField('moreThan3Days', item.field === 'moreThan3Days'); }} className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${formData[item.field as keyof FormData] ? 'border-aifm-charcoal bg-aifm-charcoal/5 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}>
                <span className={`block text-sm font-medium ${formData[item.field as keyof FormData] ? 'text-aifm-charcoal' : 'text-gray-600'}`}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ETF specific */}
      {formData.liquidityInstrumentType === 'etf' && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-aifm-charcoal">Likviditetsanalys för ETF:er:</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { field: 'canLiquidate1Day', label: '1 dag' },
              { field: 'canLiquidate2Days', label: '2 dagar' },
              { field: 'canLiquidate3Days', label: '3 dagar' },
              { field: 'moreThan3Days', label: '>3 dagar' },
            ].map(item => (
              <button key={item.field} type="button" onClick={() => { updateField('canLiquidate1Day', item.field === 'canLiquidate1Day'); updateField('canLiquidate2Days', item.field === 'canLiquidate2Days'); updateField('canLiquidate3Days', item.field === 'canLiquidate3Days'); updateField('moreThan3Days', item.field === 'moreThan3Days'); }} className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${formData[item.field as keyof FormData] ? 'border-aifm-charcoal bg-aifm-charcoal/5 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}>
                <span className={`block text-sm font-medium ${formData[item.field as keyof FormData] ? 'text-aifm-charcoal' : 'text-gray-600'}`}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Derivative specific */}
      {formData.liquidityInstrumentType === 'derivative' && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-aifm-charcoal">Likviditetsanalys för derivat:</p>
          <div className="p-4 bg-aifm-gold/5 border border-aifm-gold/20 rounded-xl">
            <p className="text-sm text-aifm-charcoal">
              För derivat analyseras likviditeten baserat på underliggande tillgång, löptid och marknadens djup.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { field: 'canLiquidate1Day', label: '1 dag' },
              { field: 'canLiquidate2Days', label: '2 dagar' },
              { field: 'canLiquidate3Days', label: '3 dagar' },
              { field: 'moreThan3Days', label: '>3 dagar' },
            ].map(item => (
              <button key={item.field} type="button" onClick={() => { updateField('canLiquidate1Day', item.field === 'canLiquidate1Day'); updateField('canLiquidate2Days', item.field === 'canLiquidate2Days'); updateField('canLiquidate3Days', item.field === 'canLiquidate3Days'); updateField('moreThan3Days', item.field === 'moreThan3Days'); }} className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${formData[item.field as keyof FormData] ? 'border-aifm-charcoal bg-aifm-charcoal/5 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}>
                <span className={`block text-sm font-medium ${formData[item.field as keyof FormData] ? 'text-aifm-charcoal' : 'text-gray-600'}`}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">
          IPO/Spin-off/Nyemission - uppskattad likviditet
        </label>
        <textarea
          value={formData.noHistoryEstimate}
          onChange={(e) => updateField('noHistoryEstimate', e.target.value)}
          rows={2}
          placeholder="Uppskattad likviditet om ingen historik finns..."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors resize-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">
            Andel illikvida tillgångar före transaktion (%)
            {formData.plannedAcquisitionShare && formData.fundId && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-aifm-gold/10 text-aifm-charcoal/70">Auto</span>
            )}
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.portfolioIlliquidBefore}
            onChange={(e) => updateField('portfolioIlliquidBefore', e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">
            Andel illikvida tillgångar efter transaktion (%)
            {formData.plannedAcquisitionShare && formData.fundId && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-aifm-gold/10 text-aifm-charcoal/70">Auto</span>
            )}
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.portfolioIlliquidAfter}
            onChange={(e) => updateField('portfolioIlliquidAfter', e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">
          Motivering till positionens storlek utifrån likviditetsperspektiv
        </label>
        <textarea
          value={formData.portfolioMotivation}
          onChange={(e) => updateField('portfolioMotivation', e.target.value)}
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">
          Hur uppfylls kravet att likviditeten inte äventyras? (24 kap. 1 § 2 pt.)
        </label>
        <textarea
          value={formData.liquidityRequirementMotivation}
          onChange={(e) => updateField('liquidityRequirementMotivation', e.target.value)}
          rows={2}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">
          Hur uppfylls kravet på försäljningsbarhet? (24 kap. 1 § 5 pt.)
        </label>
        <textarea
          value={formData.marketabilityMotivation}
          onChange={(e) => updateField('marketabilityMotivation', e.target.value)}
          rows={2}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors resize-none"
        />
      </div>
    </div>
  );
  };

  // Step 7: Valuation
  const renderValuationStep = () => (
    <div className="space-y-6">
      <div className="bg-aifm-gold/5 border border-aifm-gold/20 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>Värderingsinformation</strong> - Beskriv hur värdepappret värderas
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={formData.reliableDailyPrices}
            onChange={(e) => updateField('reliableDailyPrices', e.target.checked)}
            className="mt-0.5 w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
          />
          <span className="text-sm text-aifm-charcoal/80">Pålitliga priser finns tillgängliga dagligen</span>
        </label>

        {formData.reliableDailyPrices && (
          <div className="ml-7 space-y-3">
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-2">Länk till priskälla</label>
              <input
                type="url"
                value={formData.priceSourceUrl}
                onChange={(e) => updateField('priceSourceUrl', e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-2">Kommentar om priskälla</label>
              <input
                type="text"
                value={formData.priceSourceComment}
                onChange={(e) => updateField('priceSourceComment', e.target.value)}
                placeholder="T.ex. stängningskurs från Nasdaq OMX"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              />
            </div>
          </div>
        )}

        <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isEmission}
            onChange={(e) => updateField('isEmission', e.target.checked)}
            className="mt-0.5 w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
          />
          <span className="text-sm text-aifm-charcoal/80">Investering sker i samband med emission</span>
        </label>

        {formData.isEmission && (
          <div className="ml-7">
            <label className="block text-sm font-medium text-aifm-charcoal mb-2">Värderingsmetod för emissionspris</label>
            <textarea
              value={formData.emissionValuationMethod}
              onChange={(e) => updateField('emissionValuationMethod', e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors resize-none"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">
            Förvaltarens förslag till värderingsmetod
          </label>
          <textarea
            value={formData.proposedValuationMethod}
            onChange={(e) => updateField('proposedValuationMethod', e.target.value)}
            rows={3}
            placeholder="Inkludera metodbeskrivning, var data finns, frekvens, tillförlitlighet..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors resize-none"
          />
        </div>
      </div>
    </div>
  );

  // Step 8: ESG
  const renderESG_Step = () => (
    <div className="space-y-6">
      <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>ESG-relaterad information</strong> - {formData.article8Or9Fund ? `Artikel ${formData.fundArticle}-fond` : 'Artikel 6-fond'}
        </p>
      </div>

      {fieldSources.environmentalCharacteristics && (
        <div className="bg-aifm-gold/5 border border-aifm-gold/20 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-aifm-gold mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-aifm-charcoal">ESG-data hämtad automatiskt från {fieldSources.environmentalCharacteristics.source === 'datia' ? 'Datia' : fieldSources.environmentalCharacteristics.source}</p>
            <p className="text-xs text-aifm-gold mt-0.5">{fieldSources.environmentalCharacteristics.reasoning || 'Fälten nedan är förfyllda baserat på leverantörsdata. Du kan redigera dem vid behov.'}</p>
          </div>
        </div>
      )}

      {formData.article8Or9Fund && (
        <>
          <div>
            <label className="block text-sm font-medium text-aifm-charcoal mb-2">
              Vilka miljörelaterade egenskaper främjas av investeringen?
              {fieldSources.environmentalCharacteristics && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-aifm-gold/10 text-aifm-charcoal/70">
                  {fieldSources.environmentalCharacteristics.source}
                </span>
              )}
            </label>
            <textarea
              value={formData.environmentalCharacteristics}
              onChange={(e) => updateField('environmentalCharacteristics', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-aifm-charcoal mb-2">
              Vilka sociala egenskaper främjas av investeringen?
              {fieldSources.socialCharacteristics && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-aifm-gold/10 text-aifm-charcoal/70">
                  {fieldSources.socialCharacteristics.source}
                </span>
              )}
            </label>
            <textarea
              value={formData.socialCharacteristics}
              onChange={(e) => updateField('socialCharacteristics', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors resize-none"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={formData.meetsExclusionCriteria}
                onChange={(e) => updateField('meetsExclusionCriteria', e.target.checked)}
                className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
              />
              <span className="text-sm text-aifm-charcoal/80">Uppfyller fondens exkluderingskriterier</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={formData.meetsSustainableMinimum}
                onChange={(e) => updateField('meetsSustainableMinimum', e.target.checked)}
                className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
              />
              <span className="text-sm text-aifm-charcoal/80">Uppfyller minimum av hållbara investeringar enligt förhandsinformation</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={formData.paiConsidered}
                onChange={(e) => updateField('paiConsidered', e.target.checked)}
                className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
              />
              <span className="text-sm text-aifm-charcoal/80">Påverkan på huvudsakliga negativa konsekvenser (PAI) har beaktats</span>
            </label>
          </div>

          {formData.fundArticle === '9' && (
            <>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-aifm-charcoal mb-3">Tillägg för Artikel 9-fonder:</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-aifm-charcoal mb-2">
                  På vilket sätt orsakar innehavet inte betydande skada för något annat mål?
                </label>
                <textarea
                  value={formData.article9NoSignificantHarm}
                  onChange={(e) => updateField('article9NoSignificantHarm', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors resize-none"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.article9GoodGovernance}
                    onChange={(e) => updateField('article9GoodGovernance', e.target.checked)}
                    className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
                  />
                  <span className="text-sm text-aifm-charcoal/80">Investeringsobjektet följer praxis för god styrning</span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.article9OECDCompliant}
                    onChange={(e) => updateField('article9OECDCompliant', e.target.checked)}
                    className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
                  />
                  <span className="text-sm text-aifm-charcoal/80">Anpassad till OECD:s riktlinjer för multinationella företag</span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.article9UNGPCompliant}
                    onChange={(e) => updateField('article9UNGPCompliant', e.target.checked)}
                    className="w-4 h-4 text-aifm-charcoal border-gray-300 rounded-md focus:ring-aifm-gold/30 focus:ring-2"
                  />
                  <span className="text-sm text-aifm-charcoal/80">Anpassad till FN:s vägledande principer för företag och mänskliga rättigheter</span>
                </label>
              </div>
            </>
          )}
        </>
      )}

      {!formData.article8Or9Fund && (
        <p className="text-sm text-gray-600">
          Denna fond är en Artikel 6-fond. Inga specifika ESG-krav gäller, men hållbarhetsrisker ska beaktas.
        </p>
      )}
    </div>
  );

  // Step 8 (Art 8/9): Normbaserad screening
  const renderNormScreeningStep = () => (
    <div className="space-y-6">
      <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>Normbaserad screening</strong> – Bolaget får inte ha allvarliga brott mot UNGC, OECD, mänskliga rättigheter eller antikorruption. Kontroversnivå 4–5 = automatiskt avslag.
        </p>
      </div>
      <div className="space-y-3">
        {[
          { key: 'normScreeningUNGC', label: 'FN Global Compact' },
          { key: 'normScreeningOECD', label: 'OECD Guidelines' },
          { key: 'normScreeningHumanRights', label: 'Mänskliga rättigheter' },
          { key: 'normScreeningAntiCorruption', label: 'Antikorruption' },
          { key: 'normScreeningControversy', label: 'Allvarliga kontroverser (nivå 4–5 = avslag)' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
            <span className="text-sm font-medium text-aifm-charcoal">{label}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateField(key as keyof FormData, 'ok')}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                  formData[key as keyof FormData] === 'ok'
                    ? 'bg-aifm-charcoal text-white shadow-sm'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >OK</button>
              <button
                type="button"
                onClick={() => updateField(key as keyof FormData, 'not_ok')}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                  formData[key as keyof FormData] === 'not_ok'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >EJ OK</button>
            </div>
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">Kontroversnivå (0–5)</label>
          <input type="number" min={0} max={5} value={formData.controversyLevel === '' ? '' : formData.controversyLevel} onChange={(e) => updateField('controversyLevel', e.target.value === '' ? '' : Number(e.target.value))} className="w-28 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">Kommentar</label>
          <textarea value={formData.normScreeningComment} onChange={(e) => updateField('normScreeningComment', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
        </div>
      </div>
    </div>
  );

  // Step 9: Exkluderingskontroll
  const renderExclusionStep = () => {
    const exclusions = esgFundConfig?.exclusions ?? [];
    return (
      <div className="space-y-6">
        <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-xl p-4">
          <p className="text-sm text-aifm-charcoal">
            <strong>Exkluderingspolicy</strong> – Max {exclusions[0]?.threshold ?? 5} % omsättning från nedanstående sektorer. Kontrollera exponering och godkänn per rad.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full">
            <thead>
              <tr className="bg-aifm-charcoal/[0.03]">
                <th className="text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider p-4">Sektor</th>
                <th className="text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider p-4">Exponering</th>
                <th className="text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider p-4">Godkänd</th>
                <th className="text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider p-4">Kommentar</th>
              </tr>
            </thead>
            <tbody>
              {exclusions.map((ex, idx) => {
                const res = formData.exclusionResults[ex.category] ?? { hasExposure: false, aboveThreshold: false, approved: true, comment: '' };
                return (
                  <tr key={ex.category} className={`${idx > 0 ? 'border-t border-gray-50' : ''} hover:bg-gray-50/50 transition-colors`}>
                    <td className="p-4 text-sm text-aifm-charcoal font-medium">{ex.label}</td>
                    <td className="p-4">
                      <button type="button" onClick={() => updateField('exclusionResults', { ...formData.exclusionResults, [ex.category]: { ...res, hasExposure: !res.hasExposure } })} className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${res.hasExposure ? 'bg-aifm-gold text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{res.hasExposure ? 'Ja' : 'Nej'}</button>
                    </td>
                    <td className="p-4">
                      <button type="button" onClick={() => updateField('exclusionResults', { ...formData.exclusionResults, [ex.category]: { ...res, approved: !res.approved } })} className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${res.approved ? 'bg-aifm-charcoal text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{res.approved ? 'Godkänd' : 'Ej godkänd'}</button>
                    </td>
                    <td className="p-4">
                      <input type="text" value={res.comment} onChange={(e) => updateField('exclusionResults', { ...formData.exclusionResults, [ex.category]: { ...res, comment: e.target.value } })} placeholder="Kommentar" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">Samlad motivering</label>
          <textarea value={formData.exclusionSummaryComment} onChange={(e) => updateField('exclusionSummaryComment', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
        </div>
      </div>
    );
  };

  // Step 10: Good Governance
  const renderGovernanceStep = () => (
    <div className="space-y-6">
      <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>Good Governance</strong> – Sunda ledningsstrukturer, ersättningssystem, skatteefterlevnad, antikorruption, transparens.
        </p>
      </div>
      {[
        { key: 'governanceStructure', label: 'Styrelsestruktur' },
        { key: 'compensationSystem', label: 'Ersättningssystem' },
        { key: 'taxCompliance', label: 'Skatteefterlevnad' },
        { key: 'antiCorruption', label: 'Antikorruption' },
        { key: 'transparencyReporting', label: 'Transparens & rapportering' },
        { key: 'governanceControversies', label: 'Styrningskontroverser' },
      ].map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
          <span className="text-sm font-medium text-aifm-charcoal">{label}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateField(key as keyof FormData, 'ok')}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                formData[key as keyof FormData] === 'ok'
                  ? 'bg-aifm-charcoal text-white shadow-sm'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >OK</button>
            <button
              type="button"
              onClick={() => updateField(key as keyof FormData, 'not_ok')}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                formData[key as keyof FormData] === 'not_ok'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >EJ OK</button>
          </div>
        </div>
      ))}
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Kommentar</label>
        <textarea value={formData.governanceComment} onChange={(e) => updateField('governanceComment', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
    </div>
  );

  // Step 11 (Art 8) / 13 (Art 9): ESG-riskanalys
  const renderESGRiskStep = () => (
    <div className="space-y-6">
      <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>ESG-riskanalys</strong> – Miljö-, sociala och styrningsrisker. Risknivå: Låg / Medel / Hög.
        </p>
      </div>
      {[
        { key: 'envRiskLevel', label: 'Miljörisker (E)' },
        { key: 'socialRiskLevel', label: 'Sociala risker (S)' },
        { key: 'govRiskLevel', label: 'Styrningsrisker (G)' },
      ].map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
          <span className="text-sm font-medium text-aifm-charcoal">{label}</span>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map((lev) => (
              <button
                key={lev}
                type="button"
                onClick={() => updateField(key as keyof FormData, lev)}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                  formData[key as keyof FormData] === lev
                    ? lev === 'high' ? 'bg-red-600 text-white shadow-sm' : lev === 'medium' ? 'bg-aifm-gold text-white shadow-sm' : 'bg-aifm-charcoal text-white shadow-sm'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >{lev === 'low' ? 'Låg' : lev === 'medium' ? 'Medel' : 'Hög'}</button>
            ))}
          </div>
        </div>
      ))}
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Motivering miljö</label>
        <textarea value={formData.envRiskMotivation} onChange={(e) => updateField('envRiskMotivation', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Motivering socialt</label>
        <textarea value={formData.socialRiskMotivation} onChange={(e) => updateField('socialRiskMotivation', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Motivering styrning</label>
        <textarea value={formData.govRiskMotivation} onChange={(e) => updateField('govRiskMotivation', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">GHG-data (Scope 1/2/3, intensitet)</label>
        <input type="text" value={formData.ghgData} onChange={(e) => updateField('ghgData', e.target.value)} placeholder="t.ex. GHG 80 tCO₂e/M€" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
      <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
        <span className="text-sm font-medium text-aifm-charcoal">SBTi-mål</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => updateField('sbtiTarget', true)} className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${formData.sbtiTarget === true ? 'bg-aifm-charcoal text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Ja</button>
          <button type="button" onClick={() => updateField('sbtiTarget', false)} className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${formData.sbtiTarget === false ? 'bg-aifm-charcoal text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Nej</button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Fossilexponering (%)</label>
        <input type="number" min={0} max={100} value={formData.fossilExposurePercent === '' ? '' : formData.fossilExposurePercent} onChange={(e) => updateField('fossilExposurePercent', e.target.value === '' ? '' : Number(e.target.value))} className="w-28 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
    </div>
  );

  // Step 12 (Art 8): PAI-indikatorer
  const renderPAIStep = () => (
    <div className="space-y-6">
      <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>PAI-indikatorer</strong> – Principal Adverse Impact. Fyll i mätvärden och bedömning.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">GHG Scope 1</label><input type="text" value={formData.paiGhgScope1} onChange={(e) => updateField('paiGhgScope1', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">GHG Scope 2</label><input type="text" value={formData.paiGhgScope2} onChange={(e) => updateField('paiGhgScope2', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">GHG Scope 3</label><input type="text" value={formData.paiGhgScope3} onChange={(e) => updateField('paiGhgScope3', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">Koldioxidintensitet</label><input type="text" value={formData.paiCarbonIntensity} onChange={(e) => updateField('paiCarbonIntensity', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">Fossilexponering</label><input type="text" value={formData.paiFossilExposure} onChange={(e) => updateField('paiFossilExposure', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">Biodiversitet</label><input type="text" value={formData.paiBiodiversity} onChange={(e) => updateField('paiBiodiversity', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">Vattenutsläpp</label><input type="text" value={formData.paiWaterDischarge} onChange={(e) => updateField('paiWaterDischarge', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">Farligt avfall</label><input type="text" value={formData.paiHazardousWaste} onChange={(e) => updateField('paiHazardousWaste', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">Lönegap</label><input type="text" value={formData.paiWageGap} onChange={(e) => updateField('paiWageGap', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">Styrelsediversitet</label><input type="text" value={formData.paiBoardDiversity} onChange={(e) => updateField('paiBoardDiversity', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
      </div>
      <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
        <span className="text-sm font-medium text-aifm-charcoal">Kontroversiella vapen</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => updateField('paiControversialWeapons', true)} className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${formData.paiControversialWeapons === true ? 'bg-red-600 text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Ja</button>
          <button type="button" onClick={() => updateField('paiControversialWeapons', false)} className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${formData.paiControversialWeapons === false ? 'bg-aifm-charcoal text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Nej</button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Sammanfattning PAI</label>
        <textarea value={formData.paiSummaryComment} onChange={(e) => updateField('paiSummaryComment', e.target.value)} rows={3} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
      {formData.fundArticle === '8' && (
        <div>
          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl mb-3">
            <span className="text-sm font-medium text-aifm-charcoal">Främjade egenskaper</span>
            <div className="flex gap-2">
              {(['weak', 'moderate', 'strong'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => updateField('promotedCharacteristicsResult', v)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                    formData.promotedCharacteristicsResult === v
                      ? v === 'weak' ? 'bg-red-600 text-white shadow-sm' : v === 'moderate' ? 'bg-aifm-gold text-white shadow-sm' : 'bg-aifm-charcoal text-white shadow-sm'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >{v === 'weak' ? 'Svag' : v === 'moderate' ? 'Måttlig' : 'Stark'}</button>
              ))}
            </div>
          </div>
          <textarea value={formData.promotedCharacteristicsComment} onChange={(e) => updateField('promotedCharacteristicsComment', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" placeholder="Motivering" />
        </div>
      )}
    </div>
  );

  // Step 11 (Art 9): Bidrag till hållbarhetsmål
  const renderSustainableGoalStep = () => (
    <div className="space-y-6">
      <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>Bidrag till hållbarhetsmål (Art. 2(17))</strong> – Positivt bidrag till miljö- eller socialt mål, DNSH och god styrning.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Kategori hållbar verksamhet</label>
        <select value={formData.sustainableGoalCategory} onChange={(e) => updateField('sustainableGoalCategory', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors">
          <option value="">Välj...</option>
          {(esgFundConfig?.sustainableGoalCategories ?? ['Förnybar energi', 'Energieffektivisering', 'Hållbara transporter', 'Hållbar livsstil']).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Omsättning/CAPEX från hållbar verksamhet (%)</label>
        <input type="text" value={formData.revenueCapExFromSustainable} onChange={(e) => updateField('revenueCapExFromSustainable', e.target.value)} placeholder="t.ex. 60" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
          <span className="text-sm font-medium text-aifm-charcoal">Bidrar verksamheten till klimatmålet?</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => updateField('contributesToClimateGoal', true)} className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${formData.contributesToClimateGoal === true ? 'bg-aifm-charcoal text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Ja</button>
            <button type="button" onClick={() => updateField('contributesToClimateGoal', false)} className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${formData.contributesToClimateGoal === false ? 'bg-aifm-charcoal text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Nej</button>
          </div>
        </div>
        <textarea value={formData.contributesToClimateGoalComment} onChange={(e) => updateField('contributesToClimateGoalComment', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" placeholder="Beskriv" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
          <span className="text-sm font-medium text-aifm-charcoal">Stärker investeringen portföljens måluppfyllelse?</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => updateField('strengthensPortfolioGoal', true)} className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${formData.strengthensPortfolioGoal === true ? 'bg-aifm-charcoal text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Ja</button>
            <button type="button" onClick={() => updateField('strengthensPortfolioGoal', false)} className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${formData.strengthensPortfolioGoal === false ? 'bg-aifm-charcoal text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Nej</button>
          </div>
        </div>
        <textarea value={formData.strengthensPortfolioGoalComment} onChange={(e) => updateField('strengthensPortfolioGoalComment', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
    </div>
  );

  // Step 12 (Art 9): DNSH-PAI (combines DNSH text + PAI inputs)
  const renderDNSHPAIStep = () => (
    <div className="space-y-6">
      <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>Do No Significant Harm (DNSH)</strong> – Investeringen får inte orsaka betydande skada för andra hållbarhetsmål. PAI-kontroll.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">På vilket sätt orsakar innehavet inte betydande skada?</label>
        <textarea value={formData.article9NoSignificantHarm} onChange={(e) => updateField('article9NoSignificantHarm', e.target.value)} rows={4} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">GHG Scope 1/2/3</label><input type="text" value={formData.paiGhgScope1} onChange={(e) => updateField('paiGhgScope1', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" placeholder="Scope 1" /></div>
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">Koldioxidintensitet</label><input type="text" value={formData.paiCarbonIntensity} onChange={(e) => updateField('paiCarbonIntensity', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">Fossilexponering</label><input type="text" value={formData.paiFossilExposure} onChange={(e) => updateField('paiFossilExposure', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
        <div><label className="block text-sm font-medium text-aifm-charcoal mb-2">Biodiversitet / vatten / avfall</label><input type="text" value={formData.paiBiodiversity} onChange={(e) => updateField('paiBiodiversity', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" /></div>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" checked={formData.article9GoodGovernance} onChange={(e) => updateField('article9GoodGovernance', e.target.checked)} className="w-4 h-4 text-aifm-gold" />
          <span className="text-sm">Investeringsobjektet följer praxis för god styrning</span>
        </label>
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" checked={formData.article9OECDCompliant} onChange={(e) => updateField('article9OECDCompliant', e.target.checked)} className="w-4 h-4 text-aifm-gold" />
          <span className="text-sm">Anpassad till OECD:s riktlinjer</span>
        </label>
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" checked={formData.article9UNGPCompliant} onChange={(e) => updateField('article9UNGPCompliant', e.target.checked)} className="w-4 h-4 text-aifm-gold" />
          <span className="text-sm">Anpassad till FN:s vägledande principer (UNGP)</span>
        </label>
      </div>
    </div>
  );

  // Step 14 (Art 9): EU Taxonomi
  const renderTaxonomyStep = () => (
    <div className="space-y-6">
      <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>EU Taxonomi-bedömning</strong> – Andel som är taxonomi-kvalificerad respektive -anpassad.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Taxonomi-kvalificerad andel (%)</label>
        <input type="number" min={0} max={100} value={formData.taxonomyQualifiedPercent === '' ? '' : formData.taxonomyQualifiedPercent} onChange={(e) => updateField('taxonomyQualifiedPercent', e.target.value === '' ? '' : Number(e.target.value))} className="w-28 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Taxonomi-anpassad andel (%)</label>
        <input type="number" min={0} max={100} value={formData.taxonomyAlignedPercent === '' ? '' : formData.taxonomyAlignedPercent} onChange={(e) => updateField('taxonomyAlignedPercent', e.target.value === '' ? '' : Number(e.target.value))} className="w-28 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Datakälla</label>
        <input type="text" value={formData.taxonomyDataSource} onChange={(e) => updateField('taxonomyDataSource', e.target.value)} placeholder="t.ex. Datia, årsrapport" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Kommentar</label>
        <textarea value={formData.taxonomyComment} onChange={(e) => updateField('taxonomyComment', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
    </div>
  );

  // Step 15 (Art 9): Allokeringskontroll
  const renderAllocationStep = () => (
    <div className="space-y-6">
      <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>Allokeringskontroll</strong> – Portföljandel hållbara investeringar före och efter affären.
        </p>
      </div>
      <div className="flex gap-6">
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">Före affär (%)</label>
          <input type="number" min={0} max={100} value={formData.allocationBeforePercent === '' ? '' : formData.allocationBeforePercent} onChange={(e) => updateField('allocationBeforePercent', e.target.value === '' ? '' : Number(e.target.value))} className="w-28 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">Efter affär (%)</label>
          <input type="number" min={0} max={100} value={formData.allocationAfterPercent === '' ? '' : formData.allocationAfterPercent} onChange={(e) => updateField('allocationAfterPercent', e.target.value === '' ? '' : Number(e.target.value))} className="w-28 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Kommentar</label>
        <textarea value={formData.allocationComment} onChange={(e) => updateField('allocationComment', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
    </div>
  );

  // Step 13 (Art 8) / 16 (Art 9): Sammanfattning ESG
  const renderESGSummaryStep = () => (
    <div className="space-y-6">
      <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-xl p-4">
        <p className="text-sm text-aifm-charcoal">
          <strong>Samlad ESG-bedömning och investeringsbeslut</strong> – Sammanfatta deldomar och ange slutgiltigt beslut.
        </p>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-aifm-charcoal flex-1">Normbaserad screening</span>
          <select value={formData.esgSummaryNormScreening} onChange={(e) => updateField('esgSummaryNormScreening', e.target.value as FormData['esgSummaryNormScreening'])} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors">
            <option value="">–</option>
            <option value="approved">Godkänd</option>
            <option value="rejected">Ej godkänd</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-aifm-charcoal flex-1">Exkluderingspolicy</span>
          <select value={formData.esgSummaryExclusion} onChange={(e) => updateField('esgSummaryExclusion', e.target.value as FormData['esgSummaryExclusion'])} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors">
            <option value="">–</option>
            <option value="approved">Godkänd</option>
            <option value="rejected">Ej godkänd</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-aifm-charcoal flex-1">Good Governance</span>
          <select value={formData.esgSummaryGovernance} onChange={(e) => updateField('esgSummaryGovernance', e.target.value as FormData['esgSummaryGovernance'])} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors">
            <option value="">–</option>
            <option value="meets">Uppfyller</option>
            <option value="does_not_meet">Uppfyller inte</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-aifm-charcoal flex-1">ESG-risk</span>
          <select value={formData.esgSummaryRisk} onChange={(e) => updateField('esgSummaryRisk', e.target.value as FormData['esgSummaryRisk'])} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors">
            <option value="">–</option>
            <option value="low">Låg</option>
            <option value="medium">Medel</option>
            <option value="high">Hög</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-aifm-charcoal flex-1">PAI-påverkan</span>
          <select value={formData.esgSummaryPAI} onChange={(e) => updateField('esgSummaryPAI', e.target.value as FormData['esgSummaryPAI'])} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors">
            <option value="">–</option>
            <option value="low">Låg</option>
            <option value="medium">Medel</option>
            <option value="high">Hög</option>
          </select>
        </div>
        {formData.fundArticle === '8' && (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-aifm-charcoal flex-1">Främjade egenskaper</span>
            <select value={formData.esgSummaryPromoted} onChange={(e) => updateField('esgSummaryPromoted', e.target.value as FormData['esgSummaryPromoted'])} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors">
              <option value="">–</option>
              <option value="weak">Svag</option>
              <option value="moderate">Måttlig</option>
              <option value="strong">Stark</option>
            </select>
          </div>
        )}
      </div>
      {esgFundConfig?.engagementProcess && (
        <div>
          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
            <span className="text-sm font-medium text-aifm-charcoal">Engagemang krävs (ESG-risk &lt; {esgFundConfig.engagementProcess.riskThreshold})?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => updateField('engagementRequired', true)} className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${formData.engagementRequired === true ? 'bg-aifm-charcoal text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Ja</button>
              <button type="button" onClick={() => updateField('engagementRequired', false)} className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${formData.engagementRequired === false ? 'bg-aifm-charcoal text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Nej</button>
            </div>
          </div>
          <textarea value={formData.engagementComment} onChange={(e) => updateField('engagementComment', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors mt-3" />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Datakvalitet &amp; begränsningar</label>
        <textarea value={formData.dataQualityComment} onChange={(e) => updateField('dataQualityComment', e.target.value)} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" />
      </div>
      <div className="border-t border-gray-100 pt-6">
        <label className="block text-sm font-semibold text-aifm-charcoal mb-3">Slutgiltigt investeringsbeslut *</label>
        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={() => updateField('esgDecision', 'approved')}
            className={`flex-1 py-3 text-sm font-medium rounded-xl border-2 transition-all duration-200 ${
              formData.esgDecision === 'approved'
                ? 'border-aifm-charcoal bg-aifm-charcoal text-white shadow-sm'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >Godkänns</button>
          <button
            type="button"
            onClick={() => updateField('esgDecision', 'rejected')}
            className={`flex-1 py-3 text-sm font-medium rounded-xl border-2 transition-all duration-200 ${
              formData.esgDecision === 'rejected'
                ? 'border-red-600 bg-red-600 text-white shadow-sm'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >Avslås</button>
        </div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">Motivering (obligatorisk) *</label>
        <textarea value={formData.esgDecisionMotivation} onChange={(e) => updateField('esgDecisionMotivation', e.target.value)} rows={4} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors" required />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Godkännande av nytt värdepapper</h1>
              <p className="text-xs text-aifm-charcoal/40 mt-0.5 tracking-wide">MALL VERSION 2025-07-09 v2.1</p>
            </div>
            <button
              onClick={() => router.back()}
              className="p-2 text-aifm-charcoal/30 hover:text-aifm-charcoal hover:bg-gray-50 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Progress Steps — minimal pill stepper */}
        <div className="mb-8 overflow-x-auto pb-1">
          <div className="flex items-center gap-1 min-w-max">
            {STEPS.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                    className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all duration-200 ${
                      isActive
                        ? 'bg-aifm-charcoal text-white shadow-aifm'
                        : isCompleted
                        ? 'bg-aifm-gold/10 text-aifm-charcoal hover:bg-aifm-gold/20 cursor-pointer'
                        : 'text-gray-400 cursor-default'
                    }`}
                  >
                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-aifm-gold text-white'
                        : isCompleted
                        ? 'bg-aifm-gold/80 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {isCompleted ? '✓' : step.id}
                    </span>
                    <span className={`text-xs font-medium tracking-wide hidden lg:inline ${
                      isActive ? 'text-white' : ''
                    }`}>{step.name}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div className={`w-6 h-px mx-0.5 ${isCompleted ? 'bg-aifm-gold/40' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-aifm p-8">
          {renderStep()}
        </div>

        {/* Restriction/ESG Warnings */}
        {restrictionResults && (!restrictionResults.passed || restrictionResults.warnings.length > 0) && (
          <div className="mt-6 space-y-3">
            {!restrictionResults.passed && (
              <div className="p-5 bg-red-50/50 border border-red-200/50 rounded-2xl">
                <div className="flex gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800 text-sm">Fondrestriktioner överträdda</p>
                    <ul className="text-sm text-red-600 mt-1.5 space-y-0.5">
                      {restrictionResults.errors.map((e, i) => (
                        <li key={i}>• {e}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            {restrictionResults.warnings.length > 0 && (
              <div className="p-5 bg-aifm-gold/5 border border-aifm-gold/15 rounded-2xl">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-aifm-gold flex-shrink-0" />
                  <div>
                    <p className="font-medium text-aifm-charcoal text-sm">Varningar</p>
                    <ul className="text-sm text-aifm-charcoal/60 mt-1.5 space-y-0.5">
                      {restrictionResults.warnings.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            {restrictionResults.esg && (
              <div className={`p-5 border rounded-2xl ${
                restrictionResults.esg.status === 'passed' 
                  ? 'bg-aifm-charcoal/5 border-aifm-charcoal/10' 
                  : restrictionResults.esg.status === 'warning'
                  ? 'bg-aifm-gold/5 border-aifm-gold/15'
                  : 'bg-red-50/50 border-red-200/50'
              }`}>
                <div className="flex gap-3">
                  {restrictionResults.esg.status === 'passed' ? (
                    <ShieldCheck className="w-5 h-5 text-aifm-gold flex-shrink-0" />
                  ) : (
                    <ShieldAlert className={`w-5 h-5 flex-shrink-0 ${
                      restrictionResults.esg.status === 'warning' ? 'text-aifm-gold' : 'text-red-500'
                    }`} />
                  )}
                  <div>
                    <p className={`font-medium text-sm ${
                      restrictionResults.esg.status === 'passed' 
                        ? 'text-aifm-charcoal' 
                        : restrictionResults.esg.status === 'warning'
                        ? 'text-aifm-charcoal'
                        : 'text-red-800'
                    }`}>{restrictionResults.esg.message}</p>
                    <ul className={`text-sm mt-1.5 space-y-0.5 ${
                      restrictionResults.esg.status === 'passed' 
                        ? 'text-aifm-charcoal/60' 
                        : restrictionResults.esg.status === 'warning'
                        ? 'text-aifm-charcoal/60'
                        : 'text-red-600'
                    }`}>
                      {restrictionResults.esg.details.map((d, i) => (
                        <li key={i}>• {d}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-aifm p-4">
          <button
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-5 py-2.5 text-aifm-charcoal/60 hover:text-aifm-charcoal hover:bg-gray-50 rounded-full text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Föregående
          </button>

          <div className="flex items-center gap-3">
            {/* Auto-save status */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {hasUnsavedChanges && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Osparade
                </span>
              )}
              {lastSaved && !hasUnsavedChanges && (
                <span className="flex items-center gap-1 text-aifm-gold">
                  <CheckCircle2 className="w-3 h-3" />
                  {new Date(lastSaved).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {saveMessage && (
                <span className={`${saveMessage.includes('inte') ? 'text-red-500' : 'text-aifm-gold'}`}>
                  {saveMessage}
                </span>
              )}
            </div>

            {/* PDF Preview */}
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal hover:bg-gray-50 rounded-full text-sm transition-all disabled:opacity-30"
              title="Förhandsgranska PDF (öppnas i nytt fönster)"
            >
              {isGeneratingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              onClick={handleSaveDraft}
              disabled={isSaving || !formData.fundId}
              className="flex items-center gap-1.5 px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title={!formData.fundId ? 'Välj fond i steg 3 för att kunna spara' : 'Spara utkast'}
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Spara
            </button>

            {currentStep < STEPS.length ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                Nästa
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || (restrictionResults && !restrictionResults.passed)}
                className="flex items-center gap-2 px-6 py-2.5 bg-aifm-gold text-white rounded-full text-sm font-medium hover:bg-[#a8895c] disabled:opacity-30 transition-all shadow-sm"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Skicka för godkännande
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ESG Warning Modal */}
      {showEsgWarning && esgWarnings.length > 0 && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-aifm-xl max-w-lg w-full p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-aifm-gold/10 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-aifm-gold" />
              </div>
              <div>
                <h3 className="font-semibold text-aifm-charcoal">ESG-varningar</h3>
                <p className="text-sm text-aifm-charcoal/50">Vänligen granska innan du skickar</p>
              </div>
            </div>
            <div className="space-y-2 mb-8">
              {esgWarnings.map((warning, i) => (
                <div key={i} className="flex items-start gap-2.5 p-4 bg-aifm-gold/5 border border-aifm-gold/15 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-aifm-gold mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-aifm-charcoal">{warning}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowEsgWarning(false); setEsgWarnings([]); }}
                className="px-5 py-2.5 text-aifm-charcoal/60 hover:text-aifm-charcoal hover:bg-gray-50 rounded-full text-sm font-medium transition-all"
              >
                Gå tillbaka och åtgärda
              </button>
              <button
                onClick={handleSubmit}
                className="px-5 py-2.5 bg-aifm-gold text-white rounded-full text-sm font-medium hover:bg-[#a8895c] transition-all shadow-sm"
              >
                Skicka ändå
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
