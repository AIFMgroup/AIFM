'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Upload,
  FileText,
  Loader2,
  Sparkles,
  CheckCircle2,
  Download,
  Building2,
  Leaf,
  Search,
  Database,
  Compass,
  ExternalLink,
  Globe,
  Zap,
  Info,
  Plus,
  ArrowRight,
  Briefcase,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Target,
  BarChart3,
  Award,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import AnalysisProgressBar from '@/components/ui/AnalysisProgressBar';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx';
const MAX_FILE_SIZE_MB = 50;

type SfdrArticle = '6' | '8' | '9';
const SFDR_OPTIONS: { value: SfdrArticle; label: string; short: string }[] = [
  { value: '6', label: 'Inga särskilda hållbarhetskrav', short: 'Art. 6' },
  { value: '8', label: 'Främjar miljö-/sociala egenskaper', short: 'Art. 8' },
  { value: '9', label: 'Hållbart investeringsmål', short: 'Art. 9' },
];

interface FundInfo {
  fundId: string;
  fundName: string;
  isin: string;
  currency: string;
  shareClassName?: string;
  navPerShare?: number;
  netAssetValue?: number;
}

interface ScoutRecommendation {
  name: string;
  ticker: string;
  isin: string;
  sector: string;
  country: string;
  rationale: string;
  sfdrAlignment: string;
  estimatedESG: string;
  keyMetrics: string;
  investmentThesis?: string;
  catalysts?: string[];
  risks?: string[];
  targetAllocation?: string;
  timeHorizon?: string;
  convictionLevel?: string;
  peerComparison?: string;
  valuationView?: string;
  marketCap?: number;
  currentPrice?: number;
  currency?: string;
  exchange?: string;
  industry?: string;
  esgScore?: number;
  esgEnvironment?: number;
  esgSocial?: number;
  esgGovernance?: number;
  esgProvider?: string;
  carbonIntensity?: number;
  carbonIntensityUnit?: string;
  controversyLevel?: number;
  taxonomyAlignment?: number;
  yahooPrice?: number;
  yahooMarketCap?: number;
  yahoo52wHigh?: number;
  yahoo52wLow?: number;
  rangePosition52w?: string;
  priceVs52wHigh?: string;
  lookupSuccess?: boolean;
  esgSuccess?: boolean;
  exclusionFlags?: Record<string, boolean>;
  paiIndicators?: Array<Record<string, unknown>>;
}

interface ComparativeAnalysis {
  ranking?: Array<{ name: string; rank: number; score: string; reasoning: string }>;
  portfolioSynthesis?: string;
  warnings?: string[];
  overallRecommendation?: string;
  macroContext?: string;
  diversificationScore?: string;
}

interface AIAnalysis {
  summary?: string;
  strengths?: string[];
  concerns?: string[];
  esgVerdict?: string;
  valuationSignal?: string;
  liquidityAssessment?: string;
  keyQuestion?: string;
  dataQuality?: string;
}

interface ResearchResult {
  name: string;
  ticker: string;
  isin: string;
  lookupData?: Record<string, unknown>;
  esgData?: Record<string, unknown>;
  yahooData?: Record<string, unknown>;
  paiIndicators?: Array<Record<string, unknown>>;
  website?: string;
  documents: Array<{ url: string; title: string; category: string }>;
  downloadableDocuments: Array<{ url: string; title: string; category: string; sizeKB: number }>;
  dataSources: string[];
  aiAnalysis?: AIAnalysis;
}

type ScoutStatus = 'idle' | 'loading' | 'done' | 'error';
type ResearchStatus = 'idle' | 'loading' | 'done' | 'error';

export default function InvesteringsscoutPage() {
  const router = useRouter();

  // Fund selection
  const [funds, setFunds] = useState<FundInfo[]>([]);
  const [fundsLoading, setFundsLoading] = useState(true);
  const [selectedFundId, setSelectedFundId] = useState('');
  const [sfdrArticle, setSfdrArticle] = useState<SfdrArticle>('8');

  // Fund documents
  const [fundDocs, setFundDocs] = useState<File[]>([]);

  // Strategy
  const [investmentGoal, setInvestmentGoal] = useState('');
  const [preferences, setPreferences] = useState('');

  // Scout results
  const [scoutStatus, setScoutStatus] = useState<ScoutStatus>('idle');
  const [scoutError, setScoutError] = useState<string | null>(null);
  const [scoutProgressMsg, setScoutProgressMsg] = useState('');
  const [scoutProgress, setScoutProgress] = useState(0);
  const [scoutRecommendations, setScoutRecommendations] = useState<ScoutRecommendation[]>([]);
  const [scoutFramework, setScoutFramework] = useState<Record<string, unknown> | null>(null);
  const [comparativeAnalysis, setComparativeAnalysis] = useState<ComparativeAnalysis | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  const [researchStatus, setResearchStatus] = useState<Record<number, ResearchStatus>>({});
  const [researchResults, setResearchResults] = useState<Record<number, ResearchResult>>({});
  const [downloadingDocs, setDownloadingDocs] = useState<Record<string, boolean>>({});
  const [collectedFiles, setCollectedFiles] = useState<Array<{ file: File; category: string; companyName: string }>>([]);

  // Fetch all funds in the system (Fund Registry or fallback list)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/funds/list');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.funds)) {
            setFunds(
              data.funds.map((f: { fundId: string; fundName: string; isin?: string; currency?: string; shareClassName?: string; navPerShare?: number; netAssetValue?: number }) => ({
                fundId: f.fundId,
                fundName: f.fundName,
                isin: f.isin ?? '',
                currency: f.currency ?? 'SEK',
                shareClassName: f.shareClassName,
                navPerShare: f.navPerShare,
                netAssetValue: f.netAssetValue,
              }))
            );
          }
        }
      } catch {
        // Funds loading is optional
      } finally {
        setFundsLoading(false);
      }
    })();
  }, []);

  const selectedFund = funds.find((f) => f.fundId === selectedFundId);

  const handleFundDocUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const items = Array.from(e.target.files || []).filter((f) =>
      /\.(pdf|docx?|xlsx?)$/i.test(f.name)
    );
    setFundDocs((prev) => [...prev, ...items].slice(0, 10));
    e.target.value = '';
  }, []);

  const handleGenerateGoal = useCallback(async () => {
    if (!selectedFundId) return;
    setGeneratingGoal(true);
    try {
      const res = await fetch('/api/investment-analysis/scout/generate-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId: selectedFundId, sfdrArticle }),
      });
      if (!res.ok) throw new Error('Kunde inte generera investeringsmål');
      const data = await res.json();
      if (data.success && data.goal) {
        setInvestmentGoal(data.goal);
      } else {
        throw new Error(data.error || 'Ingen text genererades');
      }
    } catch (err) {
      console.error('Generate goal failed:', err);
    } finally {
      setGeneratingGoal(false);
    }
  }, [selectedFundId, sfdrArticle]);

  const toggleCard = useCallback((idx: number) => {
    setExpandedCards((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const [enriching, setEnriching] = useState(false);
  const [generatingGoal, setGeneratingGoal] = useState(false);

  const handleScoutSearch = useCallback(async () => {
    if (!investmentGoal.trim() && !selectedFund) return;
    setScoutStatus('loading');
    setScoutError(null);
    setScoutRecommendations([]);
    setScoutFramework(null);
    setComparativeAnalysis(null);
    setExpandedCards({});
    setResearchStatus({});
    setResearchResults({});
    setScoutProgress(5);
    setScoutProgressMsg('Bygger analysramverk...');

    let fundTermsText = '';
    if (fundDocs.length > 0) {
      fundTermsText = `\n\nUppladdade fondvillkor/dokument: ${fundDocs.map((f) => f.name).join(', ')}`;
    }

    const strategy = [
      selectedFund ? `Fond: ${selectedFund.fundName} (${selectedFund.isin}, ${selectedFund.currency})` : '',
      investmentGoal.trim(),
      fundTermsText,
    ].filter(Boolean).join('\n');

    try {
      const res = await fetch('/api/investment-analysis/scout/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          investmentStrategy: strategy,
          sfdrArticle,
          fundId: selectedFundId || undefined,
          preferences: preferences.trim() || undefined,
          fundTerms: fundTermsText || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || res.statusText || 'Analysen kunde inte startas');
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream') || !res.body) {
        throw new Error('Servern returnerade inte en ström. Försök igen.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (value) fullText += decoder.decode(value, { stream: !done });

        let idx: number;
        while ((idx = fullText.indexOf('\n\n')) !== -1) {
          const block = fullText.slice(0, idx).trim();
          fullText = fullText.slice(idx + 2);
          if (!block) continue;

          let eventName = '';
          let dataStr = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) eventName = line.slice(7).trim();
            else if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr) as Record<string, unknown>;

            if (eventName === 'progress') {
              const msg = (data.message as string) || '';
              if (msg) setScoutProgressMsg(msg);
              const step = data.step as string | undefined;
              if (step === 'framework') setScoutProgress(10);
              else if (step === 'screening') setScoutProgress(25);
              else if (step === 'enrichment') setScoutProgress(50);
              else if (step === 'thesis') setScoutProgress(70);
              else if (step === 'comparison') setScoutProgress(90);
            } else if (eventName === 'step') {
              const step = data.step as string;
              if (step === 'framework' && data.data) {
                setScoutFramework(data.data as Record<string, unknown>);
                setScoutProgress(20);
                setScoutProgressMsg('Väljer 5 bolag...');
              } else if (step === 'screening' && data.data) {
                const d = data.data as { selections?: ScoutRecommendation[] };
                if (d.selections?.length) {
                  setScoutRecommendations(d.selections);
                  setScoutProgress(40);
                  setScoutProgressMsg('Hämtar marknadsdata och ESG...');
                }
              } else if (step === 'enrichment' && data.data) {
                const d = data.data as { enrichedRecommendations?: ScoutRecommendation[] };
                if (d.enrichedRecommendations?.length) {
                  setScoutRecommendations(d.enrichedRecommendations);
                  setScoutProgress(60);
                  setScoutProgressMsg('Bygger investeringsteser...');
                }
              } else if (step === 'thesis' && data.data) {
                const d = data.data as { recommendations?: ScoutRecommendation[] };
                if (d.recommendations?.length) {
                  setScoutRecommendations(d.recommendations);
                  setScoutStatus('done');
                  setScoutProgress(80);
                  setScoutProgressMsg('Komparativ portföljanalys...');
                }
              } else if (step === 'comparison' && data.data) {
                const d = data.data as { comparativeAnalysis?: ComparativeAnalysis };
                if (d.comparativeAnalysis) {
                  setComparativeAnalysis(d.comparativeAnalysis);
                }
                setScoutProgress(100);
                setScoutProgressMsg('Klart!');
              } else if (step === 'done') {
                setScoutProgress(100);
                setScoutProgressMsg('Klart!');
              }
            } else if (eventName === 'error') {
              throw new Error((data.error as string) || 'Analysen misslyckades');
            }
          } catch (parseErr) {
            if (eventName === 'error' && parseErr instanceof Error) throw parseErr;
          }
        }

        if (done) break;
      }
    } catch (err) {
      setScoutStatus('error');
      setScoutError(err instanceof Error ? err.message : 'Något gick fel');
      setScoutProgress(0);
      setScoutProgressMsg('');
    }
  }, [investmentGoal, selectedFund, sfdrArticle, preferences, fundDocs]);

  const handleResearch = useCallback(async (index: number) => {
    const rec = scoutRecommendations[index];
    if (!rec) return;
    setResearchStatus((prev) => ({ ...prev, [index]: 'loading' }));

    try {
      const res = await fetch('/api/investment-analysis/scout/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rec.name,
          ticker: rec.ticker,
          isin: rec.isin || undefined,
          country: rec.country || undefined,
        }),
      });

      if (!res.ok) throw new Error('Research misslyckades');
      const data = await res.json();
      if (data.success && data.research) {
        setResearchResults((prev) => ({ ...prev, [index]: data.research }));
        setResearchStatus((prev) => ({ ...prev, [index]: 'done' }));
      } else {
        throw new Error('Ingen data returnerades');
      }
    } catch {
      setResearchStatus((prev) => ({ ...prev, [index]: 'error' }));
    }
  }, [scoutRecommendations]);

  const handleDownloadAndCollect = useCallback(async (doc: { url: string; title: string; category: string }, companyName: string) => {
    const key = doc.url;
    setDownloadingDocs((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(doc.url);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const fileName = doc.title.endsWith('.pdf') ? doc.title : `${doc.title}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) throw new Error('Filen är för stor');
      setCollectedFiles((prev) => [...prev, { file, category: doc.category, companyName }].slice(0, 20));
    } catch {
      // silent fail
    } finally {
      setDownloadingDocs((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const handleUseInAnalysis = useCallback((rec: ScoutRecommendation) => {
    const filesForCompany = collectedFiles.filter((f) => f.companyName === rec.name);
    const fundDocsForTransfer = fundDocs.map((f) => ({ name: f.name, size: f.size }));

    const scoutData = {
      companyName: rec.name,
      isin: rec.isin || '',
      ticker: rec.ticker || '',
      sfdrArticle,
      investmentStrategy: investmentGoal,
      fundName: selectedFund?.fundName || '',
      files: filesForCompany.map((f) => ({ name: f.file.name, category: f.category })),
      fundDocs: fundDocsForTransfer,
    };

    sessionStorage.setItem('scout-transfer', JSON.stringify(scoutData));
    router.push('/forvaltning/investeringsanalys');
  }, [collectedFiles, fundDocs, sfdrArticle, investmentGoal, selectedFund, router]);

  const formatMarketCap = (value: number | undefined): string => {
    if (!value) return '';
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
    return String(value);
  };

  const canSearch = investmentGoal.trim().length > 0 || selectedFund;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-aifm-gold/20 to-amber-200/30 flex items-center justify-center">
                <Compass className="w-5 h-5 text-aifm-gold" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Investeringsscout</h1>
                <p className="text-xs text-aifm-charcoal/40 mt-0.5 tracking-wide">
                  Hitta optimala innehav baserat på fondvillkor och strategi
                </p>
              </div>
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

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Step 1: Fund Selection */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-aifm p-8">
          <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-aifm-gold" />
            Välj fond
          </h2>
          <p className="text-sm text-aifm-charcoal/60 mb-6">
            Välj vilken fond du söker innehav för. Fondens data hämtas automatiskt.
          </p>

          {fundsLoading ? (
            <div className="flex items-center gap-2 text-sm text-aifm-charcoal/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              Hämtar fonder...
            </div>
          ) : funds.length > 0 ? (
            <div className="mb-6">
              <label className="block text-sm font-medium text-aifm-charcoal mb-2">Fond</label>
              <select
                value={selectedFundId}
                onChange={(e) => setSelectedFundId(e.target.value)}
                className="w-full max-w-md px-4 py-3 pr-10 border border-gray-200 rounded-xl text-sm text-aifm-charcoal bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
              >
                <option value="">— Välj fond —</option>
                {funds.map((fund) => (
                  <option key={fund.fundId} value={fund.fundId}>
                    {fund.fundName} {fund.isin ? `(${fund.isin})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-aifm-charcoal/40 mb-6">Inga fonder hittades. Du kan ändå använda scouten genom att beskriva din strategi nedan.</p>
          )}

          {selectedFund && (
            <>
              <div className="p-4 bg-gradient-to-br from-aifm-gold/5 to-transparent border border-aifm-gold/15 rounded-2xl mb-4">
                <p className="text-xs font-semibold text-aifm-charcoal mb-2 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-aifm-gold" />
                  Fonddata
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
                  <div><span className="text-aifm-charcoal/40">Fond:</span> <span className="font-medium">{selectedFund.fundName}</span></div>
                  <div><span className="text-aifm-charcoal/40">ISIN:</span> <span className="font-mono font-medium">{selectedFund.isin}</span></div>
                  <div><span className="text-aifm-charcoal/40">Valuta:</span> <span className="font-medium">{selectedFund.currency}</span></div>
                  {selectedFund.netAssetValue && (
                    <div><span className="text-aifm-charcoal/40">AUM:</span> <span className="font-medium">{formatMarketCap(selectedFund.netAssetValue)} {selectedFund.currency}</span></div>
                  )}
                </div>
              </div>
              <p className="text-xs text-aifm-charcoal/50 mb-6 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-aifm-gold" />
                Sparade fondvillkor för denna fond används automatiskt i analysen så att rekommendationerna följer fondens regler.
              </p>
            </>
          )}

          {/* SFDR */}
          <p className="text-sm font-medium text-aifm-charcoal mb-3">SFDR-klassificering</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {SFDR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSfdrArticle(opt.value)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  sfdrArticle === opt.value
                    ? 'border-aifm-gold bg-aifm-gold/10 text-aifm-charcoal'
                    : 'border-gray-200 bg-white text-aifm-charcoal/70 hover:border-aifm-gold/40 hover:bg-gray-50'
                }`}
              >
                <span className="font-semibold text-aifm-charcoal block mb-0.5">{opt.short}</span>
                <span className="text-xs">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Fund documents upload */}
          <div className="mb-6">
            <p className="text-sm font-medium text-aifm-charcoal mb-2">Fondvillkor & fondbestämmelser (valfritt)</p>
            <p className="text-xs text-aifm-charcoal/50 mb-3">
              Ladda upp fondvillkor, fondbestämmelser, investeringsmandat eller andra styrdokument. AI:n tar hänsyn till dessa vid rekommendationerna.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                onChange={handleFundDocUpload}
                className="hidden"
                id="fund-doc-input"
              />
              <label
                htmlFor="fund-doc-input"
                className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-dashed border-gray-200 text-sm text-aifm-charcoal/60 hover:border-aifm-gold/30 hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Välj filer
              </label>
              {fundDocs.length > 0 && (
                <span className="text-xs text-aifm-charcoal/50">{fundDocs.length} dokument</span>
              )}
            </div>
            {fundDocs.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {fundDocs.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-gray-400">({(f.size / 1024).toFixed(0)} KB)</span>
                    </span>
                    <button type="button" onClick={() => setFundDocs((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Step 2: Investment Goal */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-aifm p-8">
          <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-aifm-gold" />
            Beskriv investeringsmål
          </h2>

          <div className="flex items-start gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl mb-6">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Beskriv vad du vill uppnå med innehavet. AI:n agerar som världens bästa förvaltare och utgår från fondens fondvillkor. Den söker igenom alla tillgängliga datakällor (Yahoo Finance, ESG-data, OpenFIGI, GLEIF) för att hitta 5 bolag som matchar din profil.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-aifm-charcoal">
                  Mål med innehavet
                </label>
                {selectedFundId && (
                  <button
                    type="button"
                    onClick={handleGenerateGoal}
                    disabled={generatingGoal}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-aifm-gold/10 to-amber-100/30 text-aifm-charcoal hover:from-aifm-gold/20 hover:to-amber-100/50 disabled:opacity-50 transition-all border border-aifm-gold/20"
                  >
                    {generatingGoal ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyserar fond...</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5 text-aifm-gold" /> Generera investeringsmål med AI</>
                    )}
                  </button>
                )}
              </div>
              {generatingGoal && (
                <div className="mb-3 p-3 bg-aifm-gold/5 border border-aifm-gold/15 rounded-xl">
                  <p className="text-xs text-aifm-charcoal/60 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-aifm-gold" />
                    Analyserar fondens innehav, fondvillkor och exkluderingspolicy för att generera en skräddarsydd investeringsstrategi...
                  </p>
                </div>
              )}
              <textarea
                value={investmentGoal}
                onChange={(e) => setInvestmentGoal(e.target.value)}
                placeholder={selectedFundId ? 'Klicka "Generera investeringsmål med AI" ovan för att automatiskt analysera fondens behov, eller skriv manuellt...' : 'T.ex. Vi söker exponering mot nordiska tillväxtbolag inom tech och hälsovård med stark ESG-profil. Bolaget ska ha börsvärde över 5 miljarder SEK och stabil utdelningshistorik. Fokus på klimatomställning och cirkulär ekonomi...'}
                rows={investmentGoal.length > 500 ? 10 : 4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">
                Ytterligare preferenser (valfritt)
              </label>
              <input
                type="text"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder="T.ex. Undvik fossila bränslen, max 20% i en sektor, fokusera på utdelningsbolag..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleScoutSearch}
              disabled={scoutStatus === 'loading' || !canSearch}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#c0a280] text-white text-sm font-medium hover:bg-[#b09470] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {scoutStatus === 'loading' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Söker rekommendationer...</>
              ) : (
                <><Zap className="w-4 h-4" /> Hitta 5 rekommenderade innehav</>
              )}
            </button>
          </div>

          {scoutStatus === 'loading' && (
            <div className="mt-4">
              <AnalysisProgressBar
                progress={scoutProgress}
                message={scoutProgressMsg}
                isActive={true}
              />
            </div>
          )}

          {scoutStatus === 'error' && scoutError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs text-red-700">{scoutError}</p>
            </div>
          )}
        </div>

        {/* Analysramverk (visas progressivt efter steg 1) */}
        {scoutFramework && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-aifm p-8">
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-aifm-gold" />
              Analysramverk
            </h2>
            {scoutFramework.macroAnalysis && (
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl mb-4">
                <p className="text-xs font-semibold text-blue-800 mb-1">Makroanalys</p>
                <p className="text-sm text-blue-700 leading-relaxed">{String(scoutFramework.macroAnalysis)}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.isArray(scoutFramework.themes) && (scoutFramework.themes as string[]).length > 0 && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-1.5">Teman</p>
                  <ul className="text-xs text-aifm-charcoal/70 space-y-0.5">
                    {(scoutFramework.themes as string[]).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(scoutFramework.targetSectors) && (scoutFramework.targetSectors as string[]).length > 0 && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-1.5">Målsektorer</p>
                  <ul className="text-xs text-aifm-charcoal/70 space-y-0.5">
                    {(scoutFramework.targetSectors as string[]).slice(0, 5).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(scoutFramework.targetRegions) && (scoutFramework.targetRegions as string[]).length > 0 && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-1.5">Regioner</p>
                  <p className="text-xs text-aifm-charcoal/70">{(scoutFramework.targetRegions as string[]).join(', ')}</p>
                </div>
              )}
              {scoutFramework.riskBudget && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-1.5">Riskbudget</p>
                  <p className="text-xs text-aifm-charcoal/70">{String(scoutFramework.riskBudget)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Comparative Analysis */}
        {comparativeAnalysis && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-aifm p-8">
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-aifm-gold" />
              AI Portföljanalys
            </h2>

            {comparativeAnalysis.macroContext && (
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl mb-4">
                <p className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Makrokontext
                </p>
                <p className="text-xs text-blue-700 leading-relaxed">{comparativeAnalysis.macroContext}</p>
              </div>
            )}

            {comparativeAnalysis.overallRecommendation && (
              <div className="p-4 bg-gradient-to-br from-aifm-gold/5 to-amber-50/50 border border-aifm-gold/15 rounded-xl mb-4">
                <p className="text-xs font-semibold text-aifm-charcoal mb-1 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-aifm-gold" /> Sammanfattande rekommendation
                </p>
                <p className="text-sm text-aifm-charcoal/80 leading-relaxed">{comparativeAnalysis.overallRecommendation}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {comparativeAnalysis.portfolioSynthesis && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-1">Portföljsyntes</p>
                  <p className="text-xs text-aifm-charcoal/70 leading-relaxed">{comparativeAnalysis.portfolioSynthesis}</p>
                </div>
              )}
              {comparativeAnalysis.diversificationScore && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-1">Diversifiering</p>
                  <p className="text-xs text-aifm-charcoal/70 leading-relaxed">{comparativeAnalysis.diversificationScore}</p>
                </div>
              )}
            </div>

            {comparativeAnalysis.ranking && comparativeAnalysis.ranking.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-aifm-charcoal mb-2">Ranking (risk/reward)</p>
                <div className="space-y-1.5">
                  {comparativeAnalysis.ranking.sort((a, b) => a.rank - b.rank).map((r) => (
                    <div key={r.rank} className="flex items-center gap-3 text-xs p-2.5 bg-gray-50 rounded-lg">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        r.rank === 1 ? 'bg-aifm-gold text-white' : r.rank === 2 ? 'bg-aifm-gold/60 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>{r.rank}</span>
                      <span className="font-semibold text-aifm-charcoal min-w-[120px]">{r.name}</span>
                      <span className="font-mono font-bold text-aifm-gold">{r.score}</span>
                      <span className="text-aifm-charcoal/60 flex-1">{r.reasoning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {comparativeAnalysis.warnings && comparativeAnalysis.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Varningsflaggor
                </p>
                <ul className="space-y-1">
                  {comparativeAnalysis.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Recommendations */}
        {scoutRecommendations.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-aifm p-8">
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-aifm-gold" />
              Rekommenderade innehav ({scoutRecommendations.length})
            </h2>
            <p className="text-sm text-aifm-charcoal/60 mb-6">
              Varje rekommendation innehåller AI:ns investeringstes, katalysatorer och risker. Klicka &quot;Djupanalys&quot; för att samla in verifierad data och AI-genererad insikt.
            </p>

            <div className="space-y-4">
              {scoutRecommendations.map((rec, idx) => {
                const rStatus = researchStatus[idx];
                const rResult = researchResults[idx];
                const isExpanded = expandedCards[idx];
                const ranking = comparativeAnalysis?.ranking?.find((r) => r.name === rec.name);

                const convictionColor = rec.convictionLevel === 'Hög'
                  ? 'bg-emerald-100 text-emerald-800'
                  : rec.convictionLevel === 'Spekulativ'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800';

                return (
                  <div
                    key={`${rec.ticker}-${idx}`}
                    className="border border-gray-100 rounded-2xl overflow-hidden hover:border-aifm-gold/20 transition-colors"
                  >
                    {/* Recommendation header */}
                    <div className="p-5 bg-gradient-to-br from-gray-50/50 to-white">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {ranking && (
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                ranking.rank === 1 ? 'bg-aifm-gold text-white' : ranking.rank === 2 ? 'bg-aifm-gold/60 text-white' : 'bg-gray-200 text-gray-600'
                              }`}>{ranking.rank}</span>
                            )}
                            <h4 className="text-sm font-semibold text-aifm-charcoal">{rec.name}</h4>
                            <span className="text-xs font-mono text-aifm-charcoal/40">{rec.ticker}</span>
                            {rec.isin && <span className="text-[10px] font-mono text-aifm-charcoal/30">{rec.isin}</span>}
                          </div>

                          {/* Tags row */}
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {rec.sector && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{rec.sector}</span>}
                            {rec.country && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{rec.country}</span>}
                            {rec.convictionLevel && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${convictionColor}`}>
                                {rec.convictionLevel} övertygelse
                              </span>
                            )}
                            {rec.timeHorizon && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">{rec.timeHorizon}</span>
                            )}
                            {rec.targetAllocation && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{rec.targetAllocation}</span>
                            )}
                            {rec.valuationView && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                rec.valuationView.toLowerCase().includes('undervärderad') ? 'bg-emerald-50 text-emerald-700' :
                                rec.valuationView.toLowerCase().includes('högt') ? 'bg-red-50 text-red-700' :
                                'bg-gray-50 text-gray-600'
                              }`}>
                                {rec.valuationView.split(',')[0].split('—')[0].trim()}
                              </span>
                            )}
                          </div>

                          {/* Key metrics row */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-aifm-charcoal/60 mb-2">
                            {(rec.currentPrice || rec.yahooPrice) && (
                              <span className="font-medium text-aifm-charcoal">
                                {(rec.currentPrice || rec.yahooPrice)?.toFixed(2)} {rec.currency || ''}
                              </span>
                            )}
                            {(rec.marketCap || rec.yahooMarketCap) && (
                              <span>Börsvärde: {formatMarketCap(rec.marketCap || rec.yahooMarketCap)}</span>
                            )}
                            {rec.esgScore != null && (
                              <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                                <Leaf className="w-3 h-3" /> ESG: {rec.esgScore}/100
                              </span>
                            )}
                            {rec.rangePosition52w && (
                              <span className="text-aifm-charcoal/50">52v range: {rec.rangePosition52w}</span>
                            )}
                            {ranking?.score && (
                              <span className="font-mono font-bold text-aifm-gold">Score: {ranking.score}</span>
                            )}
                          </div>

                          {/* Investment thesis */}
                          {rec.investmentThesis && (
                            <p className="text-xs text-aifm-charcoal/80 leading-relaxed mb-2 font-medium italic">
                              &ldquo;{rec.investmentThesis}&rdquo;
                            </p>
                          )}

                          <p className="text-xs text-aifm-charcoal/70 leading-relaxed">{rec.rationale}</p>

                          {/* Expand/collapse */}
                          <button
                            type="button"
                            onClick={() => toggleCard(idx)}
                            className="mt-2 flex items-center gap-1 text-[10px] text-aifm-charcoal/40 hover:text-aifm-charcoal/70 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {isExpanded ? 'Visa mindre' : 'Visa katalysatorer, risker & detaljer'}
                          </button>
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleResearch(idx)}
                            disabled={rStatus === 'loading'}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium bg-aifm-gold/10 text-aifm-charcoal hover:bg-aifm-gold/20 disabled:opacity-50 transition-colors"
                          >
                            {rStatus === 'loading' ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyserar...</>
                            ) : rStatus === 'done' ? (
                              <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Djupanalys klar</>
                            ) : (
                              <><Search className="w-3.5 h-3.5" /> Djupanalys</>
                            )}
                          </button>
                          {rStatus === 'done' && (
                            <button
                              type="button"
                              onClick={() => handleUseInAnalysis(rec)}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium bg-aifm-charcoal text-white hover:opacity-90 transition-all"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              Investeringsanalys
                            </button>
                          )}
                        </div>
                      </div>

                      {rec.lookupSuccess && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span className="text-[10px] text-emerald-600 font-medium">Verifierad via API</span>
                        </div>
                      )}
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-5 py-4 bg-gray-50/50 border-t border-gray-100 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Catalysts */}
                          {rec.catalysts && rec.catalysts.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> Katalysatorer
                              </p>
                              <ul className="space-y-1">
                                {rec.catalysts.map((c, ci) => (
                                  <li key={ci} className="text-xs text-aifm-charcoal/70 flex items-start gap-1.5">
                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-500 flex-shrink-0" />
                                    {c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Risks */}
                          {rec.risks && rec.risks.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Risker
                              </p>
                              <ul className="space-y-1">
                                {rec.risks.map((r, ri) => (
                                  <li key={ri} className="text-xs text-aifm-charcoal/70 flex items-start gap-1.5">
                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                                    {r}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* ESG detail */}
                        {rec.esgSuccess && (
                          <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                            <p className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                              <Shield className="w-3 h-3" /> ESG-profil (verifierad)
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                              {rec.esgScore != null && <div><span className="text-emerald-600/60">Total:</span> <span className="font-bold text-emerald-800">{rec.esgScore}/100</span></div>}
                              {rec.esgEnvironment != null && <div><span className="text-emerald-600/60">Miljö:</span> <span className="font-medium">{rec.esgEnvironment}</span></div>}
                              {rec.esgSocial != null && <div><span className="text-emerald-600/60">Socialt:</span> <span className="font-medium">{rec.esgSocial}</span></div>}
                              {rec.esgGovernance != null && <div><span className="text-emerald-600/60">Styrning:</span> <span className="font-medium">{rec.esgGovernance}</span></div>}
                              {rec.carbonIntensity != null && <div><span className="text-emerald-600/60">CO2:</span> <span className="font-medium">{rec.carbonIntensity} {rec.carbonIntensityUnit || ''}</span></div>}
                              {rec.controversyLevel != null && <div><span className="text-emerald-600/60">Kontroverser:</span> <span className={`font-medium ${Number(rec.controversyLevel) >= 4 ? 'text-red-600' : ''}`}>{rec.controversyLevel}/5</span></div>}
                              {rec.taxonomyAlignment != null && <div><span className="text-emerald-600/60">Taxonomi:</span> <span className="font-medium">{rec.taxonomyAlignment}%</span></div>}
                            </div>
                            {rec.exclusionFlags && Object.values(rec.exclusionFlags).some(v => v) && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-[10px] font-semibold text-red-700">Exkluderingsflaggor: {Object.entries(rec.exclusionFlags).filter(([, v]) => v).map(([k]) => k).join(', ')}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Additional details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {rec.sfdrAlignment && (
                            <div className="p-2 bg-white rounded-lg border border-gray-100">
                              <span className="text-aifm-charcoal/40 font-medium">SFDR:</span>{' '}
                              <span className="text-aifm-charcoal/70">{rec.sfdrAlignment}</span>
                            </div>
                          )}
                          {rec.peerComparison && (
                            <div className="p-2 bg-white rounded-lg border border-gray-100">
                              <span className="text-aifm-charcoal/40 font-medium">Peers:</span>{' '}
                              <span className="text-aifm-charcoal/70">{rec.peerComparison}</span>
                            </div>
                          )}
                          {rec.valuationView && (
                            <div className="p-2 bg-white rounded-lg border border-gray-100 sm:col-span-2">
                              <span className="text-aifm-charcoal/40 font-medium">Värdering:</span>{' '}
                              <span className="text-aifm-charcoal/70">{rec.valuationView}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {rStatus === 'error' && (
                      <div className="px-5 py-2 bg-red-50 border-t border-red-100">
                        <p className="text-xs text-red-600">Kunde inte hämta information. Försök igen.</p>
                      </div>
                    )}

                    {/* Research results with AI analysis */}
                    {rResult && rStatus === 'done' && (
                      <div className="px-5 py-4 bg-aifm-gold/5 border-t border-aifm-gold/10 space-y-4">
                        {/* AI Analysis (the new star feature) */}
                        {rResult.aiAnalysis && (
                          <div className="p-4 bg-white border border-aifm-gold/20 rounded-xl space-y-3">
                            <p className="text-xs font-semibold text-aifm-charcoal flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-aifm-gold" />
                              AI Investeringsinsikt
                              {rResult.aiAnalysis.dataQuality && (
                                <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  rResult.aiAnalysis.dataQuality === 'Hög' ? 'bg-emerald-50 text-emerald-700' :
                                  rResult.aiAnalysis.dataQuality === 'Medel' ? 'bg-amber-50 text-amber-700' :
                                  'bg-red-50 text-red-700'
                                }`}>
                                  Datakvalitet: {rResult.aiAnalysis.dataQuality}
                                </span>
                              )}
                            </p>

                            {rResult.aiAnalysis.summary && (
                              <p className="text-sm text-aifm-charcoal/80 leading-relaxed">{rResult.aiAnalysis.summary}</p>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {rResult.aiAnalysis.strengths && rResult.aiAnalysis.strengths.length > 0 && (
                                <div className="p-3 bg-emerald-50/50 rounded-lg">
                                  <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">Styrkor</p>
                                  <ul className="space-y-1">
                                    {rResult.aiAnalysis.strengths.map((s, si) => (
                                      <li key={si} className="text-xs text-aifm-charcoal/70 flex items-start gap-1.5">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                                        {s}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {rResult.aiAnalysis.concerns && rResult.aiAnalysis.concerns.length > 0 && (
                                <div className="p-3 bg-red-50/50 rounded-lg">
                                  <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider mb-1.5">Orosmoment</p>
                                  <ul className="space-y-1">
                                    {rResult.aiAnalysis.concerns.map((c, ci) => (
                                      <li key={ci} className="text-xs text-aifm-charcoal/70 flex items-start gap-1.5">
                                        <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                                        {c}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {rResult.aiAnalysis.valuationSignal && (
                                <div className="p-2.5 bg-gray-50 rounded-lg">
                                  <p className="text-[10px] font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-0.5">Värdering</p>
                                  <p className="text-xs text-aifm-charcoal/80 font-medium">{rResult.aiAnalysis.valuationSignal}</p>
                                </div>
                              )}
                              {rResult.aiAnalysis.esgVerdict && (
                                <div className="p-2.5 bg-gray-50 rounded-lg">
                                  <p className="text-[10px] font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-0.5">ESG-bedömning</p>
                                  <p className="text-xs text-aifm-charcoal/80 font-medium">{rResult.aiAnalysis.esgVerdict}</p>
                                </div>
                              )}
                              {rResult.aiAnalysis.liquidityAssessment && (
                                <div className="p-2.5 bg-gray-50 rounded-lg">
                                  <p className="text-[10px] font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-0.5">Likviditet</p>
                                  <p className="text-xs text-aifm-charcoal/80 font-medium">{rResult.aiAnalysis.liquidityAssessment}</p>
                                </div>
                              )}
                            </div>

                            {rResult.aiAnalysis.keyQuestion && (
                              <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg">
                                <p className="text-xs text-amber-800 flex items-start gap-1.5">
                                  <Target className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                  <span><span className="font-semibold">Nyckelfråga:</span> {rResult.aiAnalysis.keyQuestion}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Data sources */}
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-aifm-charcoal flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-aifm-gold" />
                            Datakällor
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {rResult.dataSources?.map((src, si) => (
                              <span key={si} className="text-[10px] px-2 py-0.5 rounded-full bg-aifm-gold/15 text-aifm-charcoal/70 font-medium">
                                {src}
                              </span>
                            ))}
                          </div>
                        </div>

                        {rResult.website && (
                          <a
                            href={rResult.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <Globe className="w-3 h-3" />
                            {rResult.website}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        {rResult.downloadableDocuments && rResult.downloadableDocuments.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-aifm-charcoal mb-2">
                              Tillgängliga dokument ({rResult.downloadableDocuments.length})
                            </p>
                            <div className="space-y-1.5">
                              {rResult.downloadableDocuments.map((doc, di) => {
                                const isDownloading = downloadingDocs[doc.url];
                                const alreadyCollected = collectedFiles.some(
                                  (cf) => cf.file.name === (doc.title.endsWith('.pdf') ? doc.title : `${doc.title}.pdf`)
                                );
                                return (
                                  <div
                                    key={di}
                                    className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-gray-100"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileText className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                      <span className="truncate text-aifm-charcoal/80">{doc.title}</span>
                                      {doc.sizeKB > 0 && (
                                        <span className="text-aifm-charcoal/30 flex-shrink-0">
                                          ({doc.sizeKB > 1024 ? `${(doc.sizeKB / 1024).toFixed(1)} MB` : `${doc.sizeKB} KB`})
                                        </span>
                                      )}
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                                        {doc.category.replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadAndCollect(doc, rec.name)}
                                      disabled={isDownloading || alreadyCollected}
                                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex-shrink-0 ml-2 ${
                                        alreadyCollected
                                          ? 'bg-emerald-50 text-emerald-600'
                                          : 'bg-aifm-gold/10 text-aifm-charcoal hover:bg-aifm-gold/20 disabled:opacity-50'
                                      }`}
                                    >
                                      {alreadyCollected ? (
                                        <><CheckCircle2 className="w-3 h-3" /> Tillagd</>
                                      ) : isDownloading ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" /> Hämtar...</>
                                      ) : (
                                        <><Download className="w-3 h-3" /> Samla in</>
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {rResult.downloadableDocuments?.length === 0 && rResult.documents?.length === 0 && (
                          <p className="text-xs text-aifm-charcoal/40">
                            Inga nedladdningsbara dokument hittades automatiskt.
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => handleUseInAnalysis(rec)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium bg-aifm-charcoal text-white hover:opacity-90 transition-all shadow-sm"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          Använd i Investeringsanalys
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Collected files summary */}
            {collectedFiles.length > 0 && (
              <div className="mt-6 p-4 bg-aifm-gold/5 border border-aifm-gold/15 rounded-2xl">
                <p className="text-xs font-semibold text-aifm-charcoal mb-2 flex items-center gap-1.5">
                  <Leaf className="w-3.5 h-3.5 text-aifm-gold" />
                  Insamlade dokument ({collectedFiles.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {collectedFiles.map((cf, i) => (
                    <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-white border border-gray-100 text-aifm-charcoal/60">
                      {cf.file.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
