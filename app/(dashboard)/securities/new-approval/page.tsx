'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  
  // Step 8: ESG
  article8Or9Fund: boolean;
  fundArticle: '6' | '8' | '9';
  environmentalCharacteristics: string;
  socialCharacteristics: string;
  meetsExclusionCriteria: boolean;
  meetsSustainableMinimum: boolean;
  paiConsidered: boolean;
  article9NoSignificantHarm: string;
  article9GoodGovernance: boolean;
  article9OECDCompliant: boolean;
  article9UNGPCompliant: boolean;
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

// Available funds (mock data - would come from API)
const AVAILABLE_FUNDS = [
  { id: 'fund-1', name: 'Nordic Ventures I', article: '8' as const },
  { id: 'fund-2', name: 'Nordic Ventures II', article: '9' as const },
  { id: 'fund-3', name: 'AIFM Räntebärande', article: '6' as const },
  { id: 'fund-4', name: 'Global Tech Fund', article: '8' as const },
];

// Steps configuration
const STEPS = [
  { id: 1, name: 'Sök värdepapper', icon: Search },
  { id: 2, name: 'Grundläggande info', icon: Building2 },
  { id: 3, name: 'Fondöverensstämmelse', icon: FileText },
  { id: 4, name: 'FFFS 2013:9', icon: Scale },
  { id: 5, name: 'LVF 2004:46', icon: FileText },
  { id: 6, name: 'Likviditetsanalys', icon: Droplets },
  { id: 7, name: 'Värdering', icon: BarChart3 },
  { id: 8, name: 'ESG', icon: Leaf },
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
};

export default function NewSecurityApprovalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
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

  // Update field helper - marks as having unsaved changes
  const updateField = (field: keyof FormData, value: FormData[keyof FormData]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

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
            fundArticle: '6',
            environmentalCharacteristics: d.esgInfo?.environmentalCharacteristics || '',
            socialCharacteristics: d.esgInfo?.socialCharacteristics || '',
            meetsExclusionCriteria: d.esgInfo?.meetsExclusionCriteria ?? true,
            meetsSustainableMinimum: d.esgInfo?.meetsSustainableInvestmentMinimum ?? true,
            paiConsidered: d.esgInfo?.paiConsidered ?? false,
            article9NoSignificantHarm: d.esgInfo?.article9NoSignificantHarm || '',
            article9GoodGovernance: d.esgInfo?.article9GoodGovernance ?? false,
            article9OECDCompliant: d.esgInfo?.article9OECDCompliant ?? false,
            article9UNGPCompliant: d.esgInfo?.article9UNGPCompliant ?? false,
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
    } catch (error) {
      console.error('Auto-save error:', error);
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

      // Check restrictions if fund is already selected
      if (formData.fundId) {
        setTimeout(() => checkRestrictions(), 500);
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
      const selectedFund = AVAILABLE_FUNDS.find(f => f.id === formData.fundId);
      
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
          security: securityWithSources,
          fund: {
            fundId: formData.fundId,
            fundName: selectedFund?.name || formData.fundName,
            article: selectedFund?.article || '6',
          },
        }),
      });

      const data = await response.json();

      if (data.success && data.suggestions) {
        const s = data.suggestions;
        
        // Update form data with AI suggestions (only if not notFound)
        setFormData(prev => ({
          ...prev,
          complianceMotivation: (!s.complianceMotivationNotFound && s.complianceMotivation) ? s.complianceMotivation : prev.complianceMotivation,
          placementRestrictions: (!s.placementRestrictionsNotFound && s.placementRestrictions) ? s.placementRestrictions : prev.placementRestrictions,
          proposedValuationMethod: (!s.valuationMethodNotFound && s.valuationMethod) ? s.valuationMethod : prev.proposedValuationMethod,
          environmentalCharacteristics: (!s.environmentalCharacteristicsNotFound && s.environmentalCharacteristics) ? s.environmentalCharacteristics : prev.environmentalCharacteristics,
          socialCharacteristics: (!s.socialCharacteristicsNotFound && s.socialCharacteristics) ? s.socialCharacteristics : prev.socialCharacteristics,
          liquidityRequirementMotivation: (!s.liquidityMotivationNotFound && s.liquidityMotivation) ? s.liquidityMotivation : prev.liquidityRequirementMotivation,
          marketabilityMotivation: (!s.marketabilityMotivationNotFound && s.marketabilityMotivation) ? s.marketabilityMotivation : prev.marketabilityMotivation,
        }));
        
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
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle fund selection
  const handleFundSelect = (fundId: string) => {
    const fund = AVAILABLE_FUNDS.find(f => f.id === fundId);
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
  const handleSubmit = async () => {
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
        return formData.name && formData.category && formData.type && formData.isin;
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
        return renderESG_Step();
      default:
        return null;
    }
  };

  // Step 1: Lookup
  const renderLookupStep = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Sök efter värdepapper</p>
            <p className="text-sm text-blue-700 mt-1">
              Ange ISIN-kod och valfritt MIC-kod för att automatiskt hämta information om värdepappret.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            ISIN-kod *
          </label>
          <input
            type="text"
            value={formData.isin}
            onChange={(e) => updateField('isin', e.target.value.toUpperCase())}
            placeholder="SE0000115446"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            MIC (valfritt)
          </label>
          <input
            type="text"
            value={formData.mic}
            onChange={(e) => updateField('mic', e.target.value.toUpperCase())}
            placeholder="XSTO"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Ticker (alternativ)
          </label>
          <input
            type="text"
            value={formData.ticker}
            onChange={(e) => updateField('ticker', e.target.value.toUpperCase())}
            placeholder="VOLV-B"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
          />
        </div>
      </div>

      <button
        onClick={handleLookup}
        disabled={isLookingUp || (!formData.isin && !formData.ticker)}
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
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-green-900 text-lg">{formData.securityData.name}</p>
                  {formData.securityData.isRegulatedMarket && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-200 text-green-800 rounded-full">
                      Reglerad marknad
                    </span>
                  )}
                </div>
                <p className="text-sm text-green-700 mt-1">
                  {autoFilledFields.length} fält fylldes i automatiskt från {sourcesUsed.length} källor
                </p>
                {sourcesUsed.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {sourcesUsed.map(source => (
                      <span key={source.id} className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
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
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Viss information kunde inte hämtas</p>
                  <ul className="text-sm text-amber-700 mt-1 space-y-1">
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
              <p className="text-sm font-medium text-gray-700">Automatiskt ifylld information</p>
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
                    <span className="text-amber-600 text-xs">Ej funnet</span> : '-')}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Sektor</p>
                  {fieldSources.gicsSector && <SourceIndicator source={fieldSources.gicsSector} />}
                </div>
                <p className="font-medium text-gray-900">
                  {formData.gicsSector || (fieldSources.gicsSector?.confidence === 'not_found' ? 
                    <span className="text-amber-600 text-xs">Ej funnet</span> : '-')}
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
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-blue-900">Regulatoriska krav förifyllda</p>
                    {fieldSources.limitedPotentialLoss && (
                      <SourceIndicator source={fieldSources.limitedPotentialLoss} />
                    )}
                  </div>
                  <p className="text-sm text-blue-700 mt-1">
                    Eftersom värdepappret är noterat på en reglerad marknad har de flesta regulatoriska krav (FFFS 2013:9) 
                    automatiskt markerats som uppfyllda enligt presumtionsregeln. Du kan granska och justera dessa i steg 4.
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Kategori *</label>
          <select
            value={formData.category}
            onChange={(e) => updateField('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Typ *</label>
          <select
            value={formData.type}
            onChange={(e) => updateField('type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Typ av notering</label>
          <select
            value={formData.listingType}
            onChange={(e) => updateField('listingType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
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
            className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
          />
          <label htmlFor="ucitsEtf" className="text-sm text-gray-700">UCITS-ETF</label>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Valuta</label>
          <input
            type="text"
            value={formData.currency}
            onChange={(e) => updateField('currency', e.target.value.toUpperCase())}
            placeholder="SEK"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Land</label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) => updateField('country', e.target.value.toUpperCase())}
            placeholder="SE"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Emittent LEI</label>
          <input
            type="text"
            value={formData.emitterLEI}
            onChange={(e) => updateField('emitterLEI', e.target.value)}
            placeholder="549300..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">GICS-sektor</label>
          <input
            type="text"
            value={formData.gicsSector}
            onChange={(e) => updateField('gicsSector', e.target.value)}
            placeholder="Industrials"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Länk till värdepapper</label>
        <input
          type="url"
          value={formData.securityUrl}
          onChange={(e) => updateField('securityUrl', e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Eventuella intressekonflikter</label>
        <textarea
          value={formData.conflictsOfInterest}
          onChange={(e) => updateField('conflictsOfInterest', e.target.value)}
          rows={2}
          placeholder="Beskriv eventuella intressekonflikter..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold resize-none"
        />
      </div>
    </div>
  );

  // Step 3: Fund Compliance
  const renderFundComplianceStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Välj fond *</label>
        <select
          value={formData.fundId}
          onChange={(e) => handleFundSelect(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
        >
          <option value="">Välj fond...</option>
          {AVAILABLE_FUNDS.map(fund => (
            <option key={fund.id} value={fund.id}>
              {fund.name} (Artikel {fund.article})
            </option>
          ))}
        </select>
      </div>

      {formData.fundId && formData.securityData && (
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 transition-all"
        >
          {isAnalyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Analysera med AI
        </button>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Förenlighet med fondens placeringsbestämmelser *
        </label>
        <textarea
          value={formData.complianceMotivation}
          onChange={(e) => updateField('complianceMotivation', e.target.value)}
          rows={4}
          placeholder="Motivering varför värdepappret är en tillåten tillgång..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold resize-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          Inkludera kategorisering, hänvisning till §§ i fondbestämmelserna, geografiska/branschmässiga begränsningar etc.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Hänvisning till placeringsbestämmelser
        </label>
        <input
          type="text"
          value={formData.placementRestrictions}
          onChange={(e) => updateField('placementRestrictions', e.target.value)}
          placeholder="T.ex. §4, §5 och §7 i fondbestämmelserna"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Planerad andel av bolaget/emissionen
        </label>
        <input
          type="text"
          value={formData.plannedAcquisitionShare}
          onChange={(e) => updateField('plannedAcquisitionShare', e.target.value)}
          placeholder="T.ex. 2% av utestående aktier"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
        />
      </div>
    </div>
  );

  // Step 4: FFFS 2013:9
  const renderFFFS_Step = () => (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800">
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
              className="mt-0.5 w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
            />
            <span className="text-sm text-gray-700">{item.label}</span>
          </label>
        ))}

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">3 pt. Tillförlitlig värdering</p>
          <select
            value={formData.reliableValuationType}
            onChange={(e) => updateField('reliableValuationType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
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
              className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
            />
            <span className="text-sm text-gray-700">Kravet uppfylls</span>
          </label>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">4 pt. Lämplig information tillgänglig</p>
          <select
            value={formData.appropriateInfoType}
            onChange={(e) => updateField('appropriateInfoType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
          >
            <option value="regular_market_info">a) Regelbunden information till marknaden</option>
            <option value="regular_fund_info">b) Regelbunden information till fondbolaget</option>
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.appropriateInfoChecked}
              onChange={(e) => updateField('appropriateInfoChecked', e.target.checked)}
              className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
            />
            <span className="text-sm text-gray-700">Kravet uppfylls</span>
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
              className="mt-0.5 w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
            />
            <span className="text-sm text-gray-700">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  // Step 5: LVF
  const renderLVF_Step = () => (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800">
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
              className="mt-0.5 w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
            />
            <span className="text-sm text-gray-700">5 kap. 6 § 1 pt. Garanterad av stat eller kommun?</span>
          </label>
          {formData.stateGuaranteed && (
            <label className="flex items-center gap-2 ml-7">
              <input
                type="checkbox"
                checked={formData.stateGuaranteedMax35}
                onChange={(e) => updateField('stateGuaranteedMax35', e.target.checked)}
                className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
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
              className="mt-0.5 w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
            />
            <span className="text-sm text-gray-700">5 kap. 19 § 1 pt. Aktier utan rösträtt?</span>
          </label>
          {formData.nonVotingShares && (
            <label className="flex items-center gap-2 ml-7">
              <input
                type="checkbox"
                checked={formData.nonVotingSharesMax10}
                onChange={(e) => updateField('nonVotingSharesMax10', e.target.checked)}
                className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
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
              className="mt-0.5 w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
            />
            <span className="text-sm text-gray-700">5 kap. 19 § 2-3 pt. Obligation eller penningmarknadsinstrument?</span>
          </label>
          {formData.bondOrMoneyMarket && (
            <label className="flex items-center gap-2 ml-7">
              <input
                type="checkbox"
                checked={formData.bondMax10Issued}
                onChange={(e) => updateField('bondMax10Issued', e.target.checked)}
                className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
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
              className="mt-0.5 w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
            />
            <span className="text-sm text-gray-700">
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
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>Likviditetsanalys</strong> - Bedöm hur snabbt positionen kan likvideras
        </p>
      </div>

      {/* Instrument Type Selection */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Typ av instrument *
          </label>
          <select
            value={formData.liquidityInstrumentType}
            onChange={(e) => updateField('liquidityInstrumentType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
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
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900">Amerikanska ETF:er är ej tillåtna</p>
                    <p className="text-sm text-red-700 mt-1">
                      ETF:er noterade i USA är inte tillåtna för europeiska UCITS-fonder. Endast UCITS-ETF:er är tillåtna.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {isNonUCITSETF && !isUSETF && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">UCITS-ETF krävs</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Endast UCITS-ETF:er är tillåtna. Kontrollera att ETF:en är klassificerad som UCITS i steg 2.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>OBS:</strong> För ETF:er gäller att endast UCITS-ETF:er är tillåtna enligt fondbestämmelserna.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ADV (Average Daily Volume) Display */}
      {(formData.averageDailyValueSEK || formData.averageDailyVolume) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Genomsnittlig daglig omsättning (ADV)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Genomsnittlig daglig volym</p>
              <p className="text-lg font-semibold text-gray-900">
                {formData.averageDailyVolume ? formData.averageDailyVolume.toLocaleString('sv-SE') : '-'} st
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pris ({formData.currency || 'SEK'})</p>
              <p className="text-lg font-semibold text-gray-900">
                {formData.averageDailyPrice ? formData.averageDailyPrice.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Daglig omsättning (SEK)</p>
              <p className="text-lg font-semibold text-green-700">
                {formatNumber(formData.averageDailyValueSEK)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            <strong>Beräkning:</strong> Genomsnittlig daglig volym × Pris × Valutakurs = Daglig omsättning i SEK
          </p>
          {formData.averageDailyValueSEK && formData.averageDailyValueSEK >= 400000000 && (
            <div className="mt-3 flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Uppfyller likviditetspresumtionen (&gt;400 MSEK)</span>
            </div>
          )}
          {formData.averageDailyValueSEK && formData.averageDailyValueSEK < 400000000 && (
            <div className="mt-3 flex items-center gap-2 text-amber-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Uppfyller ej likviditetspresumtionen - detaljerad likviditetsanalys krävs</span>
            </div>
          )}
        </div>
      )}

      {/* Stock-specific liquidity analysis */}
      {(formData.liquidityInstrumentType === 'stock' || (!formData.liquidityInstrumentType && formData.type === 'stock')) && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">Likviditetsanalys för aktier:</p>
          
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              checked={formData.stockLiquidityPresumption}
              onChange={(e) => updateField('stockLiquidityPresumption', e.target.checked)}
              className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
            />
            <span className="text-sm text-gray-700">Likviditetspresumtion (Genomsnittlig daglig volym &gt; 400 MSEK)</span>
          </label>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { field: 'canLiquidate1Day', label: 'Kan likvideras inom 1 dag (Position/Daglig volym <85%)' },
              { field: 'canLiquidate2Days', label: 'Kan likvideras inom 2 dagar (Position/Daglig volym <170%)' },
              { field: 'canLiquidate3Days', label: 'Kan likvideras inom 3 dagar (Position/Daglig volym <250%)' },
              { field: 'moreThan3Days', label: 'Mer än 3 dagar (Position/Daglig volym >250%)' },
            ].map(item => (
              <label key={item.field} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="radio"
                  name="liquidityTime"
                  checked={formData[item.field as keyof FormData] as boolean}
                  onChange={() => {
                    updateField('canLiquidate1Day', item.field === 'canLiquidate1Day');
                    updateField('canLiquidate2Days', item.field === 'canLiquidate2Days');
                    updateField('canLiquidate3Days', item.field === 'canLiquidate3Days');
                    updateField('moreThan3Days', item.field === 'moreThan3Days');
                  }}
                  className="w-4 h-4 text-aifm-gold border-gray-300 focus:ring-aifm-gold"
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Bond/Fixed Income specific */}
      {formData.liquidityInstrumentType === 'bond' && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">Likviditetsanalys för ränteinstrument:</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              För ränteinstrument baseras likviditetsanalysen på marknadslikviditet, bid-ask spread och genomsnittlig handelsvolym.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { field: 'canLiquidate1Day', label: 'Kan likvideras inom 1 dag' },
              { field: 'canLiquidate2Days', label: 'Kan likvideras inom 2 dagar' },
              { field: 'canLiquidate3Days', label: 'Kan likvideras inom 3 dagar' },
              { field: 'moreThan3Days', label: 'Mer än 3 dagar' },
            ].map(item => (
              <label key={item.field} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="radio"
                  name="liquidityTime"
                  checked={formData[item.field as keyof FormData] as boolean}
                  onChange={() => {
                    updateField('canLiquidate1Day', item.field === 'canLiquidate1Day');
                    updateField('canLiquidate2Days', item.field === 'canLiquidate2Days');
                    updateField('canLiquidate3Days', item.field === 'canLiquidate3Days');
                    updateField('moreThan3Days', item.field === 'moreThan3Days');
                  }}
                  className="w-4 h-4 text-aifm-gold border-gray-300 focus:ring-aifm-gold"
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ETF specific */}
      {formData.liquidityInstrumentType === 'etf' && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">Likviditetsanalys för ETF:er:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { field: 'canLiquidate1Day', label: 'Kan likvideras inom 1 dag' },
              { field: 'canLiquidate2Days', label: 'Kan likvideras inom 2 dagar' },
              { field: 'canLiquidate3Days', label: 'Kan likvideras inom 3 dagar' },
              { field: 'moreThan3Days', label: 'Mer än 3 dagar' },
            ].map(item => (
              <label key={item.field} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="radio"
                  name="liquidityTime"
                  checked={formData[item.field as keyof FormData] as boolean}
                  onChange={() => {
                    updateField('canLiquidate1Day', item.field === 'canLiquidate1Day');
                    updateField('canLiquidate2Days', item.field === 'canLiquidate2Days');
                    updateField('canLiquidate3Days', item.field === 'canLiquidate3Days');
                    updateField('moreThan3Days', item.field === 'moreThan3Days');
                  }}
                  className="w-4 h-4 text-aifm-gold border-gray-300 focus:ring-aifm-gold"
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Derivative specific */}
      {formData.liquidityInstrumentType === 'derivative' && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">Likviditetsanalys för derivat:</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              För derivat analyseras likviditeten baserat på underliggande tillgång, löptid och marknadens djup.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { field: 'canLiquidate1Day', label: 'Kan likvideras inom 1 dag' },
              { field: 'canLiquidate2Days', label: 'Kan likvideras inom 2 dagar' },
              { field: 'canLiquidate3Days', label: 'Kan likvideras inom 3 dagar' },
              { field: 'moreThan3Days', label: 'Mer än 3 dagar' },
            ].map(item => (
              <label key={item.field} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="radio"
                  name="liquidityTime"
                  checked={formData[item.field as keyof FormData] as boolean}
                  onChange={() => {
                    updateField('canLiquidate1Day', item.field === 'canLiquidate1Day');
                    updateField('canLiquidate2Days', item.field === 'canLiquidate2Days');
                    updateField('canLiquidate3Days', item.field === 'canLiquidate3Days');
                    updateField('moreThan3Days', item.field === 'moreThan3Days');
                  }}
                  className="w-4 h-4 text-aifm-gold border-gray-300 focus:ring-aifm-gold"
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          IPO/Spin-off/Nyemission - uppskattad likviditet
        </label>
        <textarea
          value={formData.noHistoryEstimate}
          onChange={(e) => updateField('noHistoryEstimate', e.target.value)}
          rows={2}
          placeholder="Uppskattad likviditet om ingen historik finns..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold resize-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Andel illikvida tillgångar före transaktion (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.portfolioIlliquidBefore}
            onChange={(e) => updateField('portfolioIlliquidBefore', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Andel illikvida tillgångar efter transaktion (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.portfolioIlliquidAfter}
            onChange={(e) => updateField('portfolioIlliquidAfter', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Motivering till positionens storlek utifrån likviditetsperspektiv
        </label>
        <textarea
          value={formData.portfolioMotivation}
          onChange={(e) => updateField('portfolioMotivation', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Hur uppfylls kravet att likviditeten inte äventyras? (24 kap. 1 § 2 pt.)
        </label>
        <textarea
          value={formData.liquidityRequirementMotivation}
          onChange={(e) => updateField('liquidityRequirementMotivation', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Hur uppfylls kravet på försäljningsbarhet? (24 kap. 1 § 5 pt.)
        </label>
        <textarea
          value={formData.marketabilityMotivation}
          onChange={(e) => updateField('marketabilityMotivation', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold resize-none"
        />
      </div>
    </div>
  );
  };

  // Step 7: Valuation
  const renderValuationStep = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>Värderingsinformation</strong> - Beskriv hur värdepappret värderas
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={formData.reliableDailyPrices}
            onChange={(e) => updateField('reliableDailyPrices', e.target.checked)}
            className="mt-0.5 w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
          />
          <span className="text-sm text-gray-700">Pålitliga priser finns tillgängliga dagligen</span>
        </label>

        {formData.reliableDailyPrices && (
          <div className="ml-7 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Länk till priskälla</label>
              <input
                type="url"
                value={formData.priceSourceUrl}
                onChange={(e) => updateField('priceSourceUrl', e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kommentar om priskälla</label>
              <input
                type="text"
                value={formData.priceSourceComment}
                onChange={(e) => updateField('priceSourceComment', e.target.value)}
                placeholder="T.ex. stängningskurs från Nasdaq OMX"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
              />
            </div>
          </div>
        )}

        <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isEmission}
            onChange={(e) => updateField('isEmission', e.target.checked)}
            className="mt-0.5 w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
          />
          <span className="text-sm text-gray-700">Investering sker i samband med emission</span>
        </label>

        {formData.isEmission && (
          <div className="ml-7">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Värderingsmetod för emissionspris</label>
            <textarea
              value={formData.emissionValuationMethod}
              onChange={(e) => updateField('emissionValuationMethod', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold resize-none"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Förvaltarens förslag till värderingsmetod
          </label>
          <textarea
            value={formData.proposedValuationMethod}
            onChange={(e) => updateField('proposedValuationMethod', e.target.value)}
            rows={3}
            placeholder="Inkludera metodbeskrivning, var data finns, frekvens, tillförlitlighet..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold resize-none"
          />
        </div>
      </div>
    </div>
  );

  // Step 8: ESG
  const renderESG_Step = () => (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-sm text-green-800">
          <strong>ESG-relaterad information</strong> - {formData.article8Or9Fund ? `Artikel ${formData.fundArticle}-fond` : 'Artikel 6-fond'}
        </p>
      </div>

      {formData.article8Or9Fund && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Vilka miljörelaterade egenskaper främjas av investeringen?
            </label>
            <textarea
              value={formData.environmentalCharacteristics}
              onChange={(e) => updateField('environmentalCharacteristics', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Vilka sociala egenskaper främjas av investeringen?
            </label>
            <textarea
              value={formData.socialCharacteristics}
              onChange={(e) => updateField('socialCharacteristics', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold resize-none"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={formData.meetsExclusionCriteria}
                onChange={(e) => updateField('meetsExclusionCriteria', e.target.checked)}
                className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
              />
              <span className="text-sm text-gray-700">Uppfyller fondens exkluderingskriterier</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={formData.meetsSustainableMinimum}
                onChange={(e) => updateField('meetsSustainableMinimum', e.target.checked)}
                className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
              />
              <span className="text-sm text-gray-700">Uppfyller minimum av hållbara investeringar enligt förhandsinformation</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={formData.paiConsidered}
                onChange={(e) => updateField('paiConsidered', e.target.checked)}
                className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
              />
              <span className="text-sm text-gray-700">Påverkan på huvudsakliga negativa konsekvenser (PAI) har beaktats</span>
            </label>
          </div>

          {formData.fundArticle === '9' && (
            <>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Tillägg för Artikel 9-fonder:</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  På vilket sätt orsakar innehavet inte betydande skada för något annat mål?
                </label>
                <textarea
                  value={formData.article9NoSignificantHarm}
                  onChange={(e) => updateField('article9NoSignificantHarm', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold resize-none"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.article9GoodGovernance}
                    onChange={(e) => updateField('article9GoodGovernance', e.target.checked)}
                    className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
                  />
                  <span className="text-sm text-gray-700">Investeringsobjektet följer praxis för god styrning</span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.article9OECDCompliant}
                    onChange={(e) => updateField('article9OECDCompliant', e.target.checked)}
                    className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
                  />
                  <span className="text-sm text-gray-700">Anpassad till OECD:s riktlinjer för multinationella företag</span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.article9UNGPCompliant}
                    onChange={(e) => updateField('article9UNGPCompliant', e.target.checked)}
                    className="w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
                  />
                  <span className="text-sm text-gray-700">Anpassad till FN:s vägledande principer för företag och mänskliga rättigheter</span>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-aifm-charcoal">Godkännande av nytt värdepapper</h1>
              <p className="text-sm text-gray-500 mt-0.5">Mall version 2025-07-09 v2.1</p>
            </div>
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Progress Steps */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex items-center min-w-max">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-aifm-gold/10 text-aifm-gold'
                        : isCompleted
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive
                        ? 'bg-aifm-gold text-white'
                        : isCompleted
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-sm font-medium hidden md:inline">{step.name}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {renderStep()}
        </div>

        {/* Restriction/ESG Warnings */}
        {restrictionResults && (!restrictionResults.passed || restrictionResults.warnings.length > 0) && (
          <div className="mt-6">
            {!restrictionResults.passed && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-3">
                <div className="flex gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-900">Fondrestriktioner överträdda</p>
                    <ul className="text-sm text-red-700 mt-1">
                      {restrictionResults.errors.map((e, i) => (
                        <li key={i}>• {e}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            {restrictionResults.warnings.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-3">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-900">Varningar</p>
                    <ul className="text-sm text-amber-700 mt-1">
                      {restrictionResults.warnings.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            {restrictionResults.esg && (
              <div className={`p-4 border rounded-xl mb-3 ${
                restrictionResults.esg.status === 'passed' 
                  ? 'bg-green-50 border-green-200' 
                  : restrictionResults.esg.status === 'warning'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex gap-3">
                  {restrictionResults.esg.status === 'passed' ? (
                    <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <ShieldAlert className={`w-5 h-5 flex-shrink-0 ${
                      restrictionResults.esg.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                    }`} />
                  )}
                  <div>
                    <p className={`font-medium ${
                      restrictionResults.esg.status === 'passed' 
                        ? 'text-green-900' 
                        : restrictionResults.esg.status === 'warning'
                        ? 'text-amber-900'
                        : 'text-red-900'
                    }`}>{restrictionResults.esg.message}</p>
                    <ul className={`text-sm mt-1 ${
                      restrictionResults.esg.status === 'passed' 
                        ? 'text-green-700' 
                        : restrictionResults.esg.status === 'warning'
                        ? 'text-amber-700'
                        : 'text-red-700'
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
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Föregående
          </button>

          <div className="flex items-center gap-3">
            {/* Auto-save status */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {hasUnsavedChanges && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Osparade ändringar
                </span>
              )}
              {lastSaved && !hasUnsavedChanges && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sparat {new Date(lastSaved).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {saveMessage && (
                <span className={`${saveMessage.includes('inte') ? 'text-red-600' : 'text-green-600'}`}>
                  {saveMessage}
                </span>
              )}
            </div>

            {/* PDF Preview */}
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
              title="Förhandsgranska PDF (öppnas i nytt fönster)"
            >
              {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              onClick={handleSaveDraft}
              disabled={isSaving || !formData.fundId}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={!formData.fundId ? 'Välj fond i steg 3 för att kunna spara' : 'Spara utkast'}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Spara
            </button>

            {currentStep < STEPS.length ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-4 py-2 bg-aifm-charcoal text-white rounded-lg hover:bg-aifm-charcoal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Nästa
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || (restrictionResults && !restrictionResults.passed)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Skicka för godkännande
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
