'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Upload,
  FileText,
  Loader2,
  Sparkles,
  Save,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Building2,
  TrendingUp,
  Shield,
  BarChart3,
  Target,
  Leaf,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  FileCheck,
  Plus,
  Search,
  Database,
  Compass,
} from 'lucide-react';
import AnalysisProgressBar from '@/components/ui/AnalysisProgressBar';
import { useBackgroundAnalysis } from '@/lib/analysis/useBackgroundAnalysis';
import FullPageDropZone from '@/components/ui/FullPageDropZone';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx';
const MAX_FILE_SIZE_MB = 50;

type SfdrArticle = '6' | '8' | '9';
const SFDR_OPTIONS: { value: SfdrArticle; label: string; short: string }[] = [
  { value: '6', label: 'Inga särskilda hållbarhetskrav', short: 'Art. 6' },
  { value: '8', label: 'Främjar miljö-/sociala egenskaper', short: 'Art. 8' },
  { value: '9', label: 'Hållbart investeringsmål', short: 'Art. 9' },
];

interface DocumentCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  examples: string[];
}

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    id: 'annual_report',
    label: 'Årsredovisning',
    description: 'Senaste årsredovisningen med resultat- och balansräkning',
    icon: FileText,
    examples: ['Årsredovisning 2024', 'Annual Report 2024'],
  },
  {
    id: 'quarterly_report',
    label: 'Kvartalsrapporter',
    description: 'Senaste kvartalsrapporter (Q1–Q4)',
    icon: BarChart3,
    examples: ['Q4 2024', 'Q3 2024', 'Halvårsrapport'],
  },
  {
    id: 'sustainability_report',
    label: 'Hållbarhetsrapport',
    description: 'ESG-rapport, hållbarhetsredovisning eller GRI-rapport',
    icon: Leaf,
    examples: ['Sustainability Report', 'ESG Report', 'GRI-rapport'],
  },
  {
    id: 'investor_presentation',
    label: 'Investerarpresentation',
    description: 'Capital Markets Day, investor deck eller roadshow-material',
    icon: TrendingUp,
    examples: ['CMD 2024', 'Investor Presentation', 'Equity Story'],
  },
  {
    id: 'industry_analysis',
    label: 'Branschanalys',
    description: 'Branschrapporter, marknadsanalyser eller konkurrentjämförelser',
    icon: Target,
    examples: ['Branschrapport', 'Market Overview', 'Peer Comparison'],
  },
  {
    id: 'other',
    label: 'Övrigt',
    description: 'Prospekt, analytikerrapporter, pressmeddelanden eller andra dokument',
    icon: Plus,
    examples: ['Prospekt', 'Analytikerrapport', 'Pressmeddelande', 'Bolagsordning'],
  },
];

interface UploadedFile {
  file: File;
  category: string;
}

interface AnalysisResult {
  companyName?: string;
  ticker?: string;
  sector?: string;
  overallRating?: string;
  riskLevel?: string;
  esgRating?: string;
  executiveSummary?: string;
  companyOverview?: string;
  businessModel?: string;
  marketPosition?: string;
  financialAnalysis?: string;
  valuationMetrics?: string;
  managementGovernance?: string;
  esgAssessment?: string;
  riskAnalysis?: string;
  swotAnalysis?: { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[] };
  investmentThesis?: string;
  prosAndCons?: { pros?: string[]; cons?: string[] };
  conclusion?: string;
}

type AnalysisStatus = 'idle' | 'uploading' | 'analyzing' | 'merging' | 'done' | 'error';

const STEPS = [
  { id: 1, name: 'Dokument', icon: Upload },
  { id: 2, name: 'Sammanfattning', icon: Sparkles },
  { id: 3, name: 'Bolag & Marknad', icon: Building2 },
  { id: 4, name: 'Finansiellt', icon: BarChart3 },
  { id: 5, name: 'ESG & Risk', icon: Shield },
  { id: 6, name: 'SWOT & Pros/Cons', icon: Target },
  { id: 7, name: 'Slutsats & PDF', icon: Download },
];

const RATING_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  strong_buy: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'STARK KÖP' },
  buy: { bg: 'bg-green-100', text: 'text-green-800', label: 'KÖP' },
  hold: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'AVVAKTA' },
  sell: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'SÄLJ' },
  strong_sell: { bg: 'bg-red-100', text: 'text-red-800', label: 'STARK SÄLJ' },
};

const RISK_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Låg risk' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Medelrisk' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Hög risk' },
  very_high: { bg: 'bg-red-100', text: 'text-red-800', label: 'Mycket hög risk' },
};

const ESG_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  excellent: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Utmärkt' },
  good: { bg: 'bg-green-100', text: 'text-green-800', label: 'Bra' },
  adequate: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Godkänd' },
  poor: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Svag' },
  critical: { bg: 'bg-red-100', text: 'text-red-800', label: 'Kritisk' },
};

interface FundOption { id: string; name: string }

export default function InvesteringsanalysPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [sfdrArticle, setSfdrArticle] = useState<SfdrArticle>('8');
  const [companyName, setCompanyName] = useState('');
  const [isin, setIsin] = useState('');
  const [mic, setMic] = useState('');
  const [investmentStrategy, setInvestmentStrategy] = useState('');
  const [funds, setFunds] = useState<FundOption[]>([]);
  const [selectedFundId, setSelectedFundId] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('annual_report');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupData, setLookupData] = useState<Record<string, unknown> | null>(null);
  const [esgData, setEsgData] = useState<Record<string, unknown> | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  const bgAnalysis = useBackgroundAnalysis('investment-analysis');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const formTopRef = useRef<HTMLDivElement>(null);

  const analysisStatus = bgAnalysis.status as AnalysisStatus;
  const analysisProgress = bgAnalysis.progress;
  const analysisMessage = bgAnalysis.message;
  const completedChunks = bgAnalysis.completedChunks;
  const totalChunks = bgAnalysis.totalChunks;

  // Consume background analysis result when done
  useEffect(() => {
    if (bgAnalysis.isDone && !analysis) {
      const result = bgAnalysis.consumeResult<AnalysisResult>();
      if (result) {
        setAnalysis(result);
        setCurrentStep(2);

        // Auto-archive: generate PDF and save to personal data room (fire-and-forget)
        fetch('/api/auto-archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysisType: 'investment-analysis',
            data: {
              analysis: result,
              sfdrArticle,
              analyzedDocuments: uploadedFiles.map((f) => f.file.name),
            },
          }),
        }).catch(() => {});
      }
    }
  }, [bgAnalysis.isDone, bgAnalysis.consumeResult, analysis, sfdrArticle, uploadedFiles]);

  useEffect(() => {
    fetch('/api/funds/list')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.funds)) {
          setFunds(data.funds.map((f: { fundId: string; fundName: string }) => ({ id: f.fundId, name: f.fundName })));
        }
      })
      .catch(() => {});
  }, []);

  // Receive pre-filled data from AI Investeringsscout
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('scout-transfer');
      if (!raw) return;
      sessionStorage.removeItem('scout-transfer');
      const data = JSON.parse(raw);
      if (data.companyName) setCompanyName(data.companyName);
      if (data.isin) setIsin(data.isin);
      if (data.sfdrArticle) setSfdrArticle(data.sfdrArticle);
      if (data.investmentStrategy) setInvestmentStrategy(data.investmentStrategy);
    } catch {
      // ignore parse errors
    }
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
    formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleLookup = useCallback(async () => {
    if (!isin && !companyName) return;
    setLookupLoading(true);
    setLookupMessage(null);
    setLookupData(null);
    setEsgData(null);

    try {
      const lookupRes = await fetch('/api/securities/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isin: isin || undefined, ticker: companyName || undefined, mic: mic || undefined }),
      });
      if (lookupRes.ok) {
        const json = await lookupRes.json();
        if (json.success && json.data) {
          setLookupData(json.data);
          if (json.esgSummary) setEsgData(json.esgSummary);
          if (json.data.name && !companyName) setCompanyName(json.data.name);
          const sources = (json.sourcesUsed || []).map((s: { name: string }) => s.name).join(', ');
          setLookupMessage(`Data hämtad${sources ? ` (${sources})` : ''}`);
        } else {
          setLookupMessage(json.error || 'Ingen data hittades');
        }
      } else {
        setLookupMessage('Kunde inte slå upp värdepappret');
      }

      if (isin || (lookupData as Record<string, unknown>)?.isin) {
        const esgId = isin || String((lookupData as Record<string, unknown>)?.isin || '');
        if (esgId) {
          try {
            const esgRes = await fetch(`/api/securities/esg?identifier=${encodeURIComponent(esgId)}`);
            if (esgRes.ok) {
              const esgJson = await esgRes.json();
              if (esgJson.success && esgJson.esgSummary) {
                setEsgData(esgJson.esgSummary);
              }
            }
          } catch { /* ESG is optional */ }
        }
      }
    } catch {
      setLookupMessage('Nätverksfel vid uppslagning');
    } finally {
      setLookupLoading(false);
    }
  }, [isin, mic, companyName, lookupData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const items = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(pdf|docx?|xlsx?)$/i.test(f.name)
    );
    if (items.some((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024)) return;
    setUploadedFiles((prev) => [
      ...prev,
      ...items.map((file) => ({ file, category: activeCategory })),
    ].slice(0, 20));
  }, [activeCategory]);

  const handleDroppedFiles = useCallback((validFiles: File[]) => {
    setUploadedFiles((prev) => [
      ...prev,
      ...validFiles.map((file) => ({ file, category: activeCategory })),
    ].slice(0, 20));
  }, [activeCategory]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const items = Array.from(e.target.files || []).filter((f) =>
      /\.(pdf|docx?|xlsx?)$/i.test(f.name)
    );
    setUploadedFiles((prev) => [
      ...prev,
      ...items.map((file) => ({ file, category: activeCategory })),
    ].slice(0, 20));
    e.target.value = '';
  }, [activeCategory]);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const isRunning = bgAnalysis.isRunning;

  const handleAnalyze = useCallback(() => {
    if (uploadedFiles.length === 0 || isRunning) return;

    setAnalysis(null);

    const extraFormData: Record<string, string> = {};
    extraFormData.fileCategories = JSON.stringify(
      uploadedFiles.map((uf) => ({
        name: uf.file.name,
        category: DOCUMENT_CATEGORIES.find((c) => c.id === uf.category)?.label || uf.category,
      }))
    );
    if (sfdrArticle) extraFormData.sfdrArticle = sfdrArticle;
    if (investmentStrategy) extraFormData.investmentStrategy = investmentStrategy;
    if (companyName) extraFormData.companyName = companyName;
    if (isin) extraFormData.isin = isin;
    if (mic) extraFormData.mic = mic;
    if (selectedFundId) extraFormData.fundId = selectedFundId;
    if (lookupData) extraFormData.lookupData = JSON.stringify(lookupData);
    if (esgData) extraFormData.esgData = JSON.stringify(esgData);

    const investmentResultParser = (data: Record<string, unknown>) => {
      return (data.analysis as AnalysisResult) || {};
    };

    bgAnalysis.startAnalysis(
      '/api/investment-analysis/analyze',
      uploadedFiles.map((uf) => uf.file),
      extraFormData,
      investmentResultParser,
    );
  }, [uploadedFiles, sfdrArticle, investmentStrategy, companyName, isin, mic, lookupData, esgData, isRunning, bgAnalysis]);

  const handleSave = useCallback(async () => {
    if (!analysis) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/investment-analysis/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: submissionId ?? undefined,
          companyName,
          sfdrArticle,
          investmentStrategy,
          analysis,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.id) setSubmissionId(data.id);
        setSaveMessage('Sparat');
        setTimeout(() => setSaveMessage(null), 2000);
      } else {
        const d = await res.json().catch(() => ({}));
        setSaveMessage(d.error || 'Kunde inte spara');
      }
    } catch {
      setSaveMessage('Kunde inte spara');
    } finally {
      setSaving(false);
    }
  }, [submissionId, companyName, sfdrArticle, investmentStrategy, analysis]);

  const handleExportPdf = useCallback(async () => {
    if (!analysis) return;
    setExportingPdf(true);
    try {
      const res = await fetch('/api/investment-analysis/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          sfdrArticle,
          analyzedDocuments: uploadedFiles.map((f) => f.file.name),
          analysisDate: new Date().toLocaleDateString('sv-SE'),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || 'Kunde inte generera PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Investeringsanalys_${new Date().toLocaleDateString('sv-SE')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Kunde inte generera PDF');
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setExportingPdf(false);
    }
  }, [analysis, sfdrArticle, uploadedFiles]);

  const filesForCategory = (catId: string) => uploadedFiles.filter((uf) => uf.category === catId);

  const renderSection = (title: string, content: string | undefined, icon: React.ElementType) => {
    if (!content) return null;
    const Icon = icon;
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-aifm-charcoal flex items-center gap-2 mb-3">
          <Icon className="w-4 h-4 text-aifm-gold" />
          {title}
        </h3>
        <div className="text-sm text-aifm-charcoal/80 leading-relaxed whitespace-pre-line">
          {content}
        </div>
      </div>
    );
  };

  const renderBadge = (map: Record<string, { bg: string; text: string; label: string }>, value: string | undefined, prefix: string) => {
    if (!value || !map[value]) return null;
    const { bg, text, label } = map[value];
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${bg} ${text}`}>
        {prefix}: {label}
      </span>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div>
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-aifm-gold" />
              Ladda upp dokument för investeringsanalys
            </h2>
            <p className="text-sm text-aifm-charcoal/60 mb-6">
              Ladda upp alla relevanta dokument om bolaget du vill analysera. Ju fler och mer detaljerade dokument, desto bättre analys. AI:n producerar en komplett investeringsanalys med rekommendation, SWOT, pros/cons och PDF-export.
            </p>

            {/* Company name + ISIN + MIC */}
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">Bolagsnamn eller ticker</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="T.ex. Volvo, Atlas Copco, ATCO-A.ST..."
                  className="w-full max-w-md px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">ISIN-kod</label>
                  <input
                    type="text"
                    value={isin}
                    onChange={(e) => setIsin(e.target.value.toUpperCase())}
                    placeholder="T.ex. SE0000115446"
                    maxLength={12}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">MIC-kod (börs)</label>
                  <input
                    type="text"
                    value={mic}
                    onChange={(e) => setMic(e.target.value.toUpperCase())}
                    placeholder="T.ex. XSTO"
                    maxLength={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={lookupLoading || (!isin && !companyName)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-aifm-gold/30 text-sm font-medium text-aifm-charcoal hover:bg-aifm-gold/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Hämta data från API:er
                </button>
                {lookupMessage && (
                  <span className={`flex items-center gap-1.5 text-xs ${lookupData ? 'text-emerald-600' : 'text-aifm-charcoal/50'}`}>
                    {lookupData && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {lookupMessage}
                  </span>
                )}
              </div>

              {/* API data preview */}
              {lookupData && (
                <div className="p-4 bg-gradient-to-br from-aifm-gold/5 to-transparent border border-aifm-gold/15 rounded-2xl">
                  <p className="text-xs font-semibold text-aifm-charcoal mb-2 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-aifm-gold" />
                    Hämtad data (inkluderas automatiskt i analysen)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
                    {lookupData.name && <div><span className="text-aifm-charcoal/40">Namn:</span> <span className="font-medium">{String(lookupData.name)}</span></div>}
                    {lookupData.ticker && <div><span className="text-aifm-charcoal/40">Ticker:</span> <span className="font-medium">{String(lookupData.ticker)}</span></div>}
                    {lookupData.isin && <div><span className="text-aifm-charcoal/40">ISIN:</span> <span className="font-mono font-medium">{String(lookupData.isin)}</span></div>}
                    {lookupData.exchangeName && <div><span className="text-aifm-charcoal/40">Börs:</span> <span className="font-medium">{String(lookupData.exchangeName)}</span></div>}
                    {lookupData.gicsSector && <div><span className="text-aifm-charcoal/40">Sektor:</span> <span className="font-medium">{String(lookupData.gicsSector)}</span></div>}
                    {lookupData.industry && <div><span className="text-aifm-charcoal/40">Bransch:</span> <span className="font-medium">{String(lookupData.industry)}</span></div>}
                    {lookupData.country && <div><span className="text-aifm-charcoal/40">Land:</span> <span className="font-medium">{String(lookupData.countryName || lookupData.country)}</span></div>}
                    {lookupData.currency && <div><span className="text-aifm-charcoal/40">Valuta:</span> <span className="font-medium">{String(lookupData.currency)}</span></div>}
                    {lookupData.marketCap && <div><span className="text-aifm-charcoal/40">Börsvärde:</span> <span className="font-medium">{Number(lookupData.marketCap) > 1e9 ? `${(Number(lookupData.marketCap) / 1e9).toFixed(1)} mdr` : `${(Number(lookupData.marketCap) / 1e6).toFixed(0)} mkr`}</span></div>}
                    {lookupData.currentPrice && <div><span className="text-aifm-charcoal/40">Kurs:</span> <span className="font-medium">{String(lookupData.currentPrice)} {String(lookupData.currency || '')}</span></div>}
                  </div>
                  {esgData && (
                    <div className="mt-3 pt-3 border-t border-aifm-gold/10">
                      <p className="text-xs font-semibold text-aifm-charcoal mb-1.5 flex items-center gap-1.5">
                        <Leaf className="w-3.5 h-3.5 text-emerald-500" />
                        ESG-data ({String(esgData.provider || 'API')})
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
                        {esgData.totalScore != null && <div><span className="text-aifm-charcoal/40">Total:</span> <span className="font-bold">{String(esgData.totalScore)}</span></div>}
                        {esgData.environmentScore != null && <div><span className="text-aifm-charcoal/40">Miljö:</span> <span className="font-medium">{String(esgData.environmentScore)}</span></div>}
                        {esgData.socialScore != null && <div><span className="text-aifm-charcoal/40">Socialt:</span> <span className="font-medium">{String(esgData.socialScore)}</span></div>}
                        {esgData.governanceScore != null && <div><span className="text-aifm-charcoal/40">Styrning:</span> <span className="font-medium">{String(esgData.governanceScore)}</span></div>}
                        {esgData.carbonIntensity != null && <div><span className="text-aifm-charcoal/40">Koldioxid:</span> <span className="font-medium">{String(esgData.carbonIntensity)} {String(esgData.carbonIntensityUnit || '')}</span></div>}
                        {esgData.controversyLevel != null && <div><span className="text-aifm-charcoal/40">Kontroverser:</span> <span className="font-medium">{String(esgData.controversyLevel)}</span></div>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

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

            {/* Fund selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">Fond (valfritt)</label>
              <select
                value={selectedFundId}
                onChange={(e) => setSelectedFundId(e.target.value)}
                className="w-full max-w-md px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold bg-white transition-colors"
              >
                <option value="">Ingen fond vald</option>
                {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              {selectedFundId && (
                <p className="mt-2 text-xs text-aifm-gold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Sparade fondvillkor och exkluderingspolicy används automatiskt i analysen.
                </p>
              )}
            </div>

            {/* Investment strategy */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">Investeringsstrategi (valfritt)</label>
              <input
                type="text"
                value={investmentStrategy}
                onChange={(e) => setInvestmentStrategy(e.target.value)}
                placeholder="T.ex. Tillväxt, Värde, Utdelning, Small Cap, Nordiska bolag..."
                className="w-full max-w-md px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              />
            </div>

            {/* AI Scout link */}
            <button
              type="button"
              onClick={() => router.push('/forvaltning/investeringsscout')}
              className="w-full mb-8 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-aifm-gold/5 via-aifm-gold/10 to-transparent hover:from-aifm-gold/10 hover:via-aifm-gold/15 transition-all border border-aifm-gold/20 rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-aifm-gold/20 flex items-center justify-center">
                  <Compass className="w-5 h-5 text-aifm-gold" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-aifm-charcoal">AI Investeringsscout</p>
                  <p className="text-xs text-aifm-charcoal/50">Låt AI rekommendera innehav baserat på fondvillkor och strategi</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-aifm-charcoal/40" />
            </button>

            {/* Document categories */}
            <div className="border-t border-gray-100 pt-6">
              <p className="text-sm font-medium text-aifm-charcoal mb-4">Dokument – välj kategori och ladda upp</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {DOCUMENT_CATEGORIES.map((cat) => {
                  const count = filesForCategory(cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium transition-all ${
                        activeCategory === cat.id
                          ? 'bg-aifm-charcoal text-white shadow-aifm'
                          : count > 0
                            ? 'bg-aifm-gold/10 text-aifm-charcoal hover:bg-aifm-gold/20'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <cat.icon className="w-3.5 h-3.5" />
                      {cat.label}
                      {count > 0 && (
                        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          activeCategory === cat.id ? 'bg-aifm-gold text-white' : 'bg-aifm-gold/20 text-aifm-charcoal'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active category info */}
              {(() => {
                const cat = DOCUMENT_CATEGORIES.find((c) => c.id === activeCategory);
                if (!cat) return null;
                return (
                  <div className="mb-4 p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-aifm-charcoal/70">
                      <span className="font-medium">{cat.label}:</span> {cat.description}
                    </p>
                    <p className="text-xs text-aifm-charcoal/40 mt-1">
                      Exempel: {cat.examples.join(', ')}
                    </p>
                  </div>
                );
              })()}

              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-gray-200 rounded-2xl p-8 transition-colors hover:border-aifm-gold/30"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center text-center">
                  <Upload className="w-10 h-10 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-aifm-charcoal mb-1">
                    Dra och släpp filer här
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    PDF, Word, Excel. Max {MAX_FILE_SIZE_MB} MB per fil. Upp till 20 filer totalt.
                  </p>
                  <input
                    type="file"
                    accept={ACCEPTED_TYPES}
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                    id="inv-file-input"
                  />
                  <label
                    htmlFor="inv-file-input"
                    className="cursor-pointer px-4 py-2 rounded-full bg-aifm-charcoal/5 text-aifm-charcoal text-sm font-medium hover:bg-aifm-charcoal/10 transition-colors"
                  >
                    Välj filer
                  </label>
                </div>
              </div>
            </div>

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium text-aifm-charcoal mb-3">
                  Uppladdade dokument ({uploadedFiles.length})
                </p>
                <ul className="space-y-2 mb-6">
                  {uploadedFiles.map((uf, i) => {
                    const cat = DOCUMENT_CATEGORIES.find((c) => c.id === uf.category);
                    return (
                      <li
                        key={`${uf.file.name}-${i}`}
                        className="flex items-center justify-between text-sm text-aifm-charcoal bg-gray-50 rounded-xl px-4 py-2.5"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{uf.file.name}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">({(uf.file.size / 1024).toFixed(0)} KB)</span>
                          {cat && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-aifm-gold/10 text-aifm-charcoal/60 font-medium flex-shrink-0">
                              {cat.label}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-gray-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isRunning || uploadedFiles.length === 0}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-aifm-gold text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-aifm"
                >
                  {isRunning ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Analyserar...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Starta investeringsanalys</>
                  )}
                </button>
              </div>
            )}

            {isRunning && (
              <div className="mt-6">
                <AnalysisProgressBar
                  isActive
                  progress={analysisProgress}
                  message={analysisMessage}
                  completedChunks={completedChunks}
                  totalChunks={totalChunks}
                />
              </div>
            )}

            {analysisStatus === 'error' && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                <p className="text-sm text-red-700">{analysisMessage}</p>
              </div>
            )}

            {analysis && analysisStatus === 'done' && (
              <div className="mt-6 p-4 bg-aifm-gold/5 border border-aifm-gold/15 rounded-2xl">
                <div className="flex items-center gap-2 text-sm text-aifm-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-aifm-gold" />
                  <span className="font-medium">Analys klar!</span>
                  <span className="text-aifm-charcoal/60">Gå vidare för att granska resultatet.</span>
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div>
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-aifm-gold" />
              Sammanfattning
            </h2>
            {analysis && (
              <>
                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {renderBadge(RATING_COLORS, analysis.overallRating, 'Rekommendation')}
                  {renderBadge(RISK_COLORS, analysis.riskLevel, 'Risk')}
                  {renderBadge(ESG_COLORS, analysis.esgRating, 'ESG')}
                </div>
                {renderSection('Sammanfattning', analysis.executiveSummary, FileCheck)}
                {renderSection('Investeringstes', analysis.investmentThesis, Target)}
              </>
            )}
            {!analysis && <p className="text-sm text-aifm-charcoal/50">Ingen analys tillgänglig. Gå tillbaka och ladda upp dokument.</p>}
          </div>
        );

      case 3:
        return (
          <div>
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-aifm-gold" />
              Bolag & Marknad
            </h2>
            {analysis && (
              <>
                {renderSection('Bolagsbeskrivning', analysis.companyOverview, Building2)}
                {renderSection('Affärsmodell', analysis.businessModel, TrendingUp)}
                {renderSection('Marknadsposition', analysis.marketPosition, Target)}
              </>
            )}
          </div>
        );

      case 4:
        return (
          <div>
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-aifm-gold" />
              Finansiell analys & Värdering
            </h2>
            {analysis && (
              <>
                {renderSection('Finansiell analys', analysis.financialAnalysis, BarChart3)}
                {renderSection('Värdering', analysis.valuationMetrics, TrendingUp)}
                {renderSection('Ledning & styrning', analysis.managementGovernance, Building2)}
              </>
            )}
          </div>
        );

      case 5:
        return (
          <div>
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-aifm-gold" />
              ESG & Riskanalys
            </h2>
            {analysis && (
              <>
                {analysis.esgRating && (
                  <div className="mb-4">
                    {renderBadge(ESG_COLORS, analysis.esgRating, 'ESG-betyg')}
                  </div>
                )}
                {renderSection('ESG-bedömning', analysis.esgAssessment, Leaf)}
                {renderSection('Riskanalys', analysis.riskAnalysis, AlertTriangle)}
              </>
            )}
          </div>
        );

      case 6:
        return (
          <div>
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-aifm-gold" />
              SWOT-analys & Fördelar/Nackdelar
            </h2>
            {analysis?.swotAnalysis && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {[
                  { key: 'strengths' as const, label: 'Styrkor', color: 'border-emerald-200 bg-emerald-50/60', textColor: 'text-emerald-800' },
                  { key: 'weaknesses' as const, label: 'Svagheter', color: 'border-orange-200 bg-orange-50/60', textColor: 'text-orange-800' },
                  { key: 'opportunities' as const, label: 'Möjligheter', color: 'border-blue-200 bg-blue-50/60', textColor: 'text-blue-800' },
                  { key: 'threats' as const, label: 'Hot', color: 'border-red-200 bg-red-50/60', textColor: 'text-red-800' },
                ].map(({ key, label, color, textColor }) => {
                  const items = analysis.swotAnalysis?.[key] || [];
                  return (
                    <div key={key} className={`rounded-2xl border ${color} p-5`}>
                      <h4 className={`text-sm font-semibold ${textColor} mb-3`}>{label}</h4>
                      <ul className="space-y-2">
                        {items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-aifm-charcoal/80">
                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${textColor.replace('text-', 'bg-')}`} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            {analysis?.prosAndCons && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
                  <h4 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4" /> Fördelar
                  </h4>
                  <ul className="space-y-2">
                    {(analysis.prosAndCons.pros || []).map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-aifm-charcoal/80">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
                  <h4 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                    <ThumbsDown className="w-4 h-4" /> Nackdelar
                  </h4>
                  <ul className="space-y-2">
                    {(analysis.prosAndCons.cons || []).map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-aifm-charcoal/80">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );

      case 7:
        return (
          <div>
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <Download className="w-4 h-4 text-aifm-gold" />
              Slutsats & Export
            </h2>
            {analysis && (
              <>
                {/* Rating badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {renderBadge(RATING_COLORS, analysis.overallRating, 'Rekommendation')}
                  {renderBadge(RISK_COLORS, analysis.riskLevel, 'Risk')}
                  {renderBadge(ESG_COLORS, analysis.esgRating, 'ESG')}
                </div>

                {renderSection('Slutsats & rekommendation', analysis.conclusion, FileCheck)}

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-aifm-charcoal mb-4">Exportera analys</h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleExportPdf}
                      disabled={exportingPdf}
                      className="flex items-center gap-2 px-6 py-3 rounded-full bg-aifm-charcoal text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-aifm"
                    >
                      {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Ladda ner som PDF
                    </button>
                  </div>
                  <p className="text-xs text-aifm-charcoal/40 mt-2">
                    Genererar en professionell investeringsanalys-PDF med alla avsnitt, SWOT, pros/cons och rekommendation.
                  </p>
                </div>
              </>
            )}
            {!analysis && <p className="text-sm text-aifm-charcoal/50">Ingen analys tillgänglig.</p>}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <FullPageDropZone onFiles={handleDroppedFiles} maxSizeMB={MAX_FILE_SIZE_MB} disabled={bgAnalysis.isRunning}>
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Investeringsanalys</h1>
              <p className="text-xs text-aifm-charcoal/40 mt-0.5 tracking-wide">
                AI-driven analys av potentiella innehav
              </p>
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

      <div className="max-w-5xl mx-auto px-6 py-8" ref={formTopRef}>
        {/* Step navigation */}
        <div className="mb-8 overflow-x-auto pb-1">
          <div className="flex items-center gap-1 min-w-max">
            {STEPS.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => goToStep(step.id)}
                    className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all duration-200 ${
                      isActive
                        ? 'bg-aifm-charcoal text-white shadow-aifm'
                        : isCompleted
                          ? 'bg-aifm-gold/10 text-aifm-charcoal hover:bg-aifm-gold/20 cursor-pointer'
                          : 'text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-aifm-charcoal cursor-pointer'
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-aifm-gold text-white'
                          : isCompleted
                            ? 'bg-aifm-gold/80 text-white'
                            : 'bg-gray-200 text-gray-500 group-hover:bg-gray-300'
                      }`}
                    >
                      {isCompleted ? '✓' : step.id}
                    </span>
                    <span className={`text-xs font-medium tracking-wide hidden lg:inline ${isActive ? 'text-white' : ''}`}>
                      {step.name}
                    </span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div className={`w-6 h-px mx-0.5 ${isCompleted ? 'bg-aifm-gold/40' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-aifm p-8">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => goToStep(currentStep - 1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-200 text-sm text-aifm-charcoal hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Föregående
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {saveMessage && (
              <span className="flex items-center gap-1 text-sm text-aifm-charcoal/60">
                {saveMessage === 'Sparat' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {saveMessage}
              </span>
            )}
            {analysis && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-200 text-sm text-aifm-charcoal hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Spara
              </button>
            )}
            {currentStep < STEPS.length ? (
              <button
                type="button"
                onClick={() => goToStep(currentStep + 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-aifm-charcoal text-white text-sm font-medium hover:opacity-90 transition-all"
              >
                Nästa
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    </FullPageDropZone>
  );
}
