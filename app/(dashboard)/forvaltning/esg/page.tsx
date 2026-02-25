'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Upload,
  FileText,
  Loader2,
  Sparkles,
  Save,
  CheckCircle2,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Scale,
  AlertTriangle,
  BarChart3,
  PenTool,
  Factory,
  Zap,
  Truck,
  Info,
  Download,
  ShieldX,
} from 'lucide-react';
import {
  ESG_SECTIONS,
  getOrderedQuestionIds,
  type ESGQuestion,
  type ESGSection,
  type ESGSubSection,
} from '@/lib/esg/questions';
import { useBackgroundAnalysis } from '@/lib/analysis/useBackgroundAnalysis';
import AnalysisProgressBar from '@/components/ui/AnalysisProgressBar';
import FullPageDropZone from '@/components/ui/FullPageDropZone';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx';
const MAX_FILE_SIZE_MB = 50;
const SESSION_KEY = 'aifm-esg-analysis';

type SfdrArticle = '6' | '8' | '9';
const SFDR_OPTIONS: { value: SfdrArticle; label: string; short: string }[] = [
  { value: '6', label: 'Artikel 6 – Inga särskilda hållbarhetskrav', short: 'Art. 6' },
  { value: '8', label: 'Artikel 8 – Främjar miljö-/sociala egenskaper', short: 'Art. 8' },
  { value: '9', label: 'Artikel 9 – Hållbart investeringsmål', short: 'Art. 9' },
];

type AnswersState = Record<string, string>;
type AiFilledState = Set<string>;

const STEPS = [
  { id: 1, name: 'Dokument & Analys', icon: Upload },
  { id: 2, name: 'Normbaserad screening', icon: Scale },
  { id: 3, name: 'Exkluderingskontroll', icon: AlertTriangle },
  { id: 4, name: 'Good Governance', icon: ClipboardCheck },
  { id: 5, name: 'ESG-riskanalys', icon: BarChart3 },
  { id: 6, name: 'PAI-indikatorer', icon: BarChart3 },
  { id: 7, name: 'EU Taxonomi', icon: Leaf },
  { id: 8, name: 'Sammanfattning & Signatur', icon: PenTool },
];

function flattenQuestions(section: ESGSection): ESGQuestion[] {
  const out: ESGQuestion[] = [];
  function walk(q: ESGQuestion) {
    out.push(q);
    q.subQuestions?.forEach(walk);
  }
  section.questions.forEach(walk);
  return out;
}

const PAI_YEARS = ['2022', '2023', '2024', '2025', '2026'];

function PaiIndicatorTable({ paiTable }: { paiTable: Array<Record<string, string>> }) {
  return (
    <div className="mb-8 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/80">
            <th className="text-left py-3 px-4 font-semibold text-aifm-charcoal">PAIs</th>
            {PAI_YEARS.map((y) => (
              <th key={y} className="text-right py-3 px-3 font-semibold text-aifm-charcoal">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paiTable.map((row, idx) => {
            const indicator = row.indicator ?? row['indicator'] ?? '';
            const isHeader = row.isHeader === 'true' || row.isHeader === true;
            const isBold = row.isBold === 'true' || row.isBold === true || isHeader;
            const hasYearCols = PAI_YEARS.some((y) => row[y] != null && String(row[y]).trim() !== '' && String(row[y]).trim() !== 'null');

            if (isHeader) {
              return (
                <tr key={idx} className="border-b border-gray-100 bg-aifm-gold/5">
                  <td colSpan={PAI_YEARS.length + 1} className="py-2 px-4 text-xs font-semibold text-aifm-charcoal/80 uppercase tracking-wide">
                    {indicator}
                  </td>
                </tr>
              );
            }

            return (
              <tr key={idx} className={`border-b border-gray-100 hover:bg-gray-50/50 ${isBold ? 'bg-gray-50/30' : ''}`}>
                <td className={`py-2.5 px-4 text-aifm-charcoal ${isBold ? 'font-semibold' : ''}`}>
                  <span className="flex items-center gap-1">
                    {indicator}
                    {row.unit ? (
                      <span className="text-xs text-aifm-charcoal/50">({row.unit})</span>
                    ) : null}
                  </span>
                </td>
                {PAI_YEARS.map((y) => {
                  const val = row[y];
                  const display =
                    val != null && String(val).trim() !== '' && String(val).trim() !== 'null'
                      ? String(val).trim()
                      : !hasYearCols && y === '2024' && row.value
                        ? String(row.value).trim()
                        : '-';
                  return (
                    <td key={y} className={`py-2.5 px-3 text-right text-aifm-charcoal/90 ${isBold ? 'font-semibold' : ''}`}>
                      {display}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ESGPage() {
  const router = useRouter();
  const _initCache = typeof window !== 'undefined' ? (() => { try { const r = sessionStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; } })() : null;
  const [currentStep, setCurrentStep] = useState(_initCache?.sfdrArticle ? 1 : 1);
  const [sfdrArticle, setSfdrArticle] = useState<SfdrArticle>(_initCache?.sfdrArticle || '8');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [fundAssignments, setFundAssignments] = useState<{ article: SfdrArticle }[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/role', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { role?: string; email?: string | null }) => {
        if (!cancelled) {
          setUserRole((data.role || '').toLowerCase());
          setUserEmail(data.email ?? null);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (userRole !== 'forvaltare' || !userEmail) return;
    let cancelled = false;
    fetch(`/api/admin/fund-assignments?email=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((data: { assignments?: { article: SfdrArticle }[] }) => {
        if (!cancelled) setFundAssignments(data.assignments || []);
      })
      .catch(() => { if (!cancelled) setFundAssignments([]); });
    return () => { cancelled = true; };
  }, [userRole, userEmail]);

  const allowedSfdrOptions = useMemo(() => {
    if (userRole === 'forvaltare' && fundAssignments.length > 0) {
      const articles = new Set(fundAssignments.map((a) => a.article));
      return SFDR_OPTIONS.filter((opt) => articles.has(opt.value));
    }
    return SFDR_OPTIONS;
  }, [userRole, fundAssignments]);

  useEffect(() => {
    if (allowedSfdrOptions.length > 0 && !allowedSfdrOptions.some((o) => o.value === sfdrArticle)) {
      setSfdrArticle(allowedSfdrOptions[0].value);
    }
  }, [allowedSfdrOptions, sfdrArticle]);

  const analysis = useBackgroundAnalysis('esg');

  // Restore from sessionStorage on mount
  const cached = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const [answers, setAnswers] = useState<AnswersState>(() => {
    if (cached?.answers) return cached.answers;
    const ids = getOrderedQuestionIds();
    const initial: AnswersState = {};
    ids.forEach((id) => (initial[id] = ''));
    return initial;
  });
  const [answerDetails, setAnswerDetails] = useState<AnswersState>(() => {
    if (cached?.answerDetails) return cached.answerDetails;
    const initial: AnswersState = {};
    ESG_SECTIONS.forEach((s) => {
      flattenQuestions(s).forEach((q) => {
        if (q.type === 'yesno_with_detail') initial[q.id + '_detail'] = '';
      });
    });
    return initial;
  });
  const [aiFilled, setAiFilled] = useState<AiFilledState>(() => new Set(cached?.aiFilled || []));
  const [signatureDate, setSignatureDate] = useState(cached?.signatureDate || '');
  const [signatureName, setSignatureName] = useState(cached?.signatureName || '');
  const [signatureCompany, setSignatureCompany] = useState(cached?.signatureCompany || '');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(cached?.submissionId || null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [executiveSummary, setExecutiveSummary] = useState(cached?.executiveSummary || '');
  const [methodology, setMethodology] = useState(cached?.methodology || '');
  const [dnshAnalysis, setDnshAnalysis] = useState<Record<string, string> | null>(cached?.dnshAnalysis || null);
  const [paiTable, setPaiTable] = useState<Array<Record<string, string>> | null>(cached?.paiTable || null);
  const [goodGovernanceAssessment, setGoodGovernanceAssessment] = useState(cached?.goodGovernanceAssessment || '');
  const [earlyRejection, setEarlyRejection] = useState<{
    rejected: boolean;
    reason: string;
    category: string;
    companyName: string;
  } | null>(cached?.earlyRejection || null);
  const formTopRef = useRef<HTMLDivElement>(null);

  // Persist to sessionStorage whenever analysis results change
  useEffect(() => {
    const hasContent = executiveSummary || Object.values(answers).some((v) => v && v.trim());
    if (!hasContent) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        answers, answerDetails, aiFilled: Array.from(aiFilled),
        signatureDate, signatureName, signatureCompany, submissionId,
        executiveSummary, methodology, dnshAnalysis, paiTable,
        goodGovernanceAssessment, earlyRejection, sfdrArticle,
      }));
    } catch { /* quota exceeded – ignore */ }
  }, [answers, answerDetails, aiFilled, signatureDate, signatureName, signatureCompany,
      submissionId, executiveSummary, methodology, dnshAnalysis, paiTable,
      goodGovernanceAssessment, earlyRejection, sfdrArticle]);

  const setAnswer = useCallback((id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const setAnswerDetail = useCallback((id: string, value: string) => {
    setAnswerDetails((prev) => ({ ...prev, [id + '_detail']: value }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
    formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleDroppedFiles = useCallback((validFiles: File[]) => {
    setFiles((prev) => [...prev, ...validFiles].slice(0, 10));
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const items = Array.from(e.target.files || []).filter((f) =>
      /\.(pdf|docx?|xlsx?)$/i.test(f.name)
    );
    setFiles((prev) => [...prev, ...items].slice(0, 10));
    e.target.value = '';
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // When background analysis completes (even if user navigated away and came back), apply results
  useEffect(() => {
    if (analysis.isDone) {
      const result = analysis.consumeResult() as {
        answers?: Record<string, string>;
        details?: Record<string, string>;
        executiveSummary?: string;
        methodology?: string;
        dnshAnalysis?: Record<string, string>;
        paiTable?: Array<Record<string, string>>;
        goodGovernanceAssessment?: string;
        earlyRejection?: { rejected: boolean; reason: string; category: string; companyName: string };
      } | null;
      if (result) {
        if (result.earlyRejection) {
          setEarlyRejection(result.earlyRejection);
          return;
        }
        const nextAi = new Set<string>();
        const normalized = (v: string) => {
          const s = String(v).trim().toLowerCase();
          if (s === 'ja' || s === 'yes') return 'yes';
          if (s === 'nej' || s === 'no') return 'no';
          return String(v).trim();
        };
        setAnswers((prev) => {
          const next = { ...prev };
          for (const [id, value] of Object.entries(result.answers || {})) {
            if (value != null && String(value).trim() !== '') {
              next[id] = normalized(value);
              nextAi.add(id);
            }
          }
          return next;
        });
        setAnswerDetails((prev) => {
          const next = { ...prev };
          for (const [id, value] of Object.entries(result.details || {})) {
            if (value != null && String(value).trim() !== '') next[id + '_detail'] = String(value).trim();
          }
          return next;
        });
        setAiFilled(nextAi);
        if (result.executiveSummary) setExecutiveSummary(String(result.executiveSummary));
        if (result.methodology) setMethodology(String(result.methodology));
        if (result.dnshAnalysis) setDnshAnalysis(result.dnshAnalysis);
        if (result.paiTable) setPaiTable(result.paiTable);
        if (result.goodGovernanceAssessment) setGoodGovernanceAssessment(String(result.goodGovernanceAssessment));

        // Auto-archive: generate PDF and save to personal data room
        fetch('/api/auto-archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysisType: 'esg',
            data: {
              answers: result.answers || {},
              details: result.details || {},
              sfdrArticle,
              executiveSummary: result.executiveSummary,
              methodology: result.methodology,
              dnshAnalysis: result.dnshAnalysis,
              paiTable: result.paiTable,
              goodGovernanceAssessment: result.goodGovernanceAssessment,
            },
          }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.ok) console.log('[ESG] Auto-archived to data room:', d.fileName);
            else console.warn('[ESG] Auto-archive failed:', d.reason || d.error);
          })
          .catch((e) => console.warn('[ESG] Auto-archive error:', e));
      }
    }
    if (analysis.isError && analysis.error) {
      setSaveMessage(analysis.error);
      setTimeout(() => setSaveMessage(null), 5000);
      analysis.reset();
    }
  }, [analysis.isDone, analysis.isError, analysis.error, analysis.consumeResult, analysis.reset, sfdrArticle]);

  const handleAnalyze = useCallback((forceFull = false) => {
    if (files.length === 0) return;
    setEarlyRejection(null);
    analysis.startAnalysis('/api/esg/analyze', files, {
      sfdrArticle,
      ...(forceFull ? { forceFullAnalysis: 'true' } : {}),
    });
  }, [files, sfdrArticle, analysis.startAnalysis]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/esg/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: submissionId ?? undefined,
          sfdrArticle,
          answers,
          answerDetails,
          signatureDate,
          signatureName,
          signatureCompany,
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
  }, [submissionId, answers, answerDetails, signatureDate, signatureName, signatureCompany]);

  const handleExportPdf = useCallback(async () => {
    setExportingPdf(true);
    try {
      const res = await fetch('/api/esg/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          answerDetails,
          signatureDate,
          signatureName,
          signatureCompany,
          sfdrArticle,
          executiveSummary: executiveSummary || undefined,
          methodology: methodology || undefined,
          dnshAnalysis: dnshAnalysis || undefined,
          paiTable: paiTable || undefined,
          goodGovernanceAssessment: goodGovernanceAssessment || undefined,
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
      a.download = `ESG-analys_${new Date().toLocaleDateString('sv-SE')}.pdf`;
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
  }, [answers, answerDetails, signatureDate, signatureName, signatureCompany, sfdrArticle, executiveSummary, methodology, dnshAnalysis, paiTable, goodGovernanceAssessment]);

  const renderQuestion = (q: ESGQuestion, depth: number) => {
    const id = q.id;
    const value = answers[id] ?? '';
    const detailValue = answerDetails[id + '_detail'] ?? '';
    const isAiFilled = aiFilled.has(id) && value.trim() !== '';

    const label = (
      <div className="mb-1.5">
        <label className="block text-sm font-medium text-aifm-charcoal">
          {q.number}. {q.text}
          {isAiFilled && (
            <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-aifm-gold/10 text-aifm-charcoal">
              <Sparkles className="w-3 h-3" /> Agent-ifyllt
            </span>
          )}
        </label>
        {q.description && (
          <p className="text-xs text-aifm-charcoal/40 mt-0.5">{q.description}</p>
        )}
      </div>
    );

    if (q.type === 'text') {
      return (
        <div key={id} className={depth > 0 ? 'ml-6 mt-3' : 'mt-5'}>
          {label}
          <textarea
            value={value}
            onChange={(e) => setAnswer(id, e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
      );
    }

    if (q.type === 'number') {
      return (
        <div key={id} className={depth > 0 ? 'ml-6 mt-3' : 'mt-5'}>
          {label}
          <input
            type="number"
            value={value}
            onChange={(e) => setAnswer(id, e.target.value)}
            className="w-full max-w-[200px] px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
      );
    }

    if (q.type === 'yesno' || q.type === 'yesno_with_detail') {
      return (
        <div key={id} className={depth > 0 ? 'ml-6 mt-3' : 'mt-5'}>
          {label}
          <div className="flex flex-wrap gap-4 mb-2">
            {['yes', 'no'].map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={id}
                  checked={(value || '').toLowerCase() === opt}
                  onChange={() => setAnswer(id, opt)}
                  className="text-aifm-gold focus:ring-aifm-gold"
                />
                <span className="text-sm text-aifm-charcoal">{opt === 'yes' ? 'Ja' : 'Nej'}</span>
              </label>
            ))}
          </div>
          {q.type === 'yesno_with_detail' && (
            <textarea
              value={detailValue}
              onChange={(e) => setAnswerDetail(id, e.target.value)}
              placeholder="Motivering / beskrivning (vid behov)"
              rows={2}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors mt-1"
            />
          )}
        </div>
      );
    }

    if (q.type === 'select' && q.options) {
      return (
        <div key={id} className={depth > 0 ? 'ml-6 mt-3' : 'mt-5'}>
          {label}
          <select
            value={value}
            onChange={(e) => setAnswer(id, e.target.value)}
            className="w-full max-w-md px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors bg-white"
          >
            {q.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return null;
  };

  const SCOPE_ICONS: Record<string, React.ElementType> = {
    scope1: Factory,
    scope2: Zap,
    scope3: Truck,
  };

  const SCOPE_COLORS: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
    scope1: { bg: 'bg-red-50/60', border: 'border-red-200/60', icon: 'text-red-500', badge: 'bg-red-100 text-red-700' },
    scope2: { bg: 'bg-amber-50/60', border: 'border-amber-200/60', icon: 'text-amber-500', badge: 'bg-amber-100 text-amber-700' },
    scope3: { bg: 'bg-blue-50/60', border: 'border-blue-200/60', icon: 'text-blue-500', badge: 'bg-blue-100 text-blue-700' },
  };

  const renderSubSection = (sub: ESGSubSection) => {
    const ScopeIcon = SCOPE_ICONS[sub.id] || BarChart3;
    const colors = SCOPE_COLORS[sub.id] || { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-500', badge: 'bg-gray-100 text-gray-700' };

    return (
      <div key={sub.id} className={`rounded-2xl border ${colors.border} ${colors.bg} p-6 transition-all`}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${colors.badge} flex items-center justify-center`}>
            <ScopeIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-aifm-charcoal">{sub.title}</h3>
            <p className="text-xs text-aifm-charcoal/50 mt-1 leading-relaxed">{sub.description}</p>
          </div>
        </div>
        <div className="space-y-1">
          {sub.questions.map((q) => renderQuestion(q, 0))}
        </div>
      </div>
    );
  };

  const renderSectionQuestions = (sectionIndex: number) => {
    const section = ESG_SECTIONS[sectionIndex];
    if (!section) return null;

    const hasSubSections = section.subSections && section.subSections.length > 0;

    return (
      <div>
        <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-2 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-aifm-gold" />
          {section.title}
        </h2>
        {section.description && (
          <p className="text-sm text-aifm-charcoal/50 mb-6 flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-aifm-charcoal/30" />
            {section.description}
          </p>
        )}

        {section.id === 'pai' && paiTable && paiTable.length > 0 && (
          <PaiIndicatorTable paiTable={paiTable} />
        )}

        {hasSubSections && (
          <div className="grid grid-cols-1 gap-5 mb-8">
            {section.subSections!.map((sub) => renderSubSection(sub))}
          </div>
        )}

        {section.questions.length > 0 && (
          <div>
            {hasSubSections && (
              <h3 className="text-sm font-semibold text-aifm-charcoal mt-2 mb-1 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-aifm-gold" />
                Övriga PAI-indikatorer
              </h3>
            )}
            {flattenQuestions({ ...section, subSections: undefined } as ESGSection).map((q) => renderQuestion(q, 0))}
          </div>
        )}
      </div>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div>
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-aifm-gold" />
              Ladda upp ESG-rapporter för analys
            </h2>
            <p className="text-sm text-aifm-charcoal/60 mb-4">
              Ladda upp ESG-rapporter från bolagen (PDF, Word, Excel). AI:n analyserar innehållet och fyller i formuläret automatiskt. Du kan sedan jämföra med data från API.
            </p>

            <p className="text-sm font-medium text-aifm-charcoal mb-3">SFDR-klassificering – vilken typ av fond/bolag analyserar du?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {allowedSfdrOptions.map((opt) => (
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

            <div
              className="border-2 border-dashed border-gray-200 rounded-2xl p-8 transition-colors hover:border-aifm-gold/30"
            >
              <div className="flex flex-col items-center justify-center text-center">
                <Upload className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-aifm-charcoal mb-1">
                  Dra och släpp dokument här eller klicka för att välja
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  PDF, Word (.doc, .docx), Excel (.xls, .xlsx). Max {MAX_FILE_SIZE_MB} MB per fil.
                </p>
                <input
                  type="file"
                  accept={ACCEPTED_TYPES}
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                  id="esg-file-input"
                />
                <label
                  htmlFor="esg-file-input"
                  className="cursor-pointer px-4 py-2 rounded-full bg-aifm-charcoal/5 text-aifm-charcoal text-sm font-medium hover:bg-aifm-charcoal/10 transition-colors"
                >
                  Välj filer
                </label>
              </div>
            </div>
            {earlyRejection && (
              <div className="mt-6 p-5 rounded-2xl border-2 border-red-200 bg-red-50 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <ShieldX className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-800">Godkänns ej</h3>
                    <p className="text-sm text-red-700 mt-1">{earlyRejection.reason}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEarlyRejection(null)}
                    className="px-4 py-2 rounded-full border border-red-300 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors"
                  >
                    Stäng
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAnalyze(true)}
                    disabled={analysis.isRunning}
                    className="px-4 py-2 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    Kör full analys ändå
                  </button>
                </div>
              </div>
            )}
            {files.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium text-aifm-charcoal mb-3">Uppladdade filer ({files.length})</p>
                <ul className="space-y-2 mb-4">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between text-sm text-aifm-charcoal bg-gray-50 rounded-xl px-4 py-2.5"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        {f.name}
                        <span className="text-xs text-gray-400">({(f.size / 1024).toFixed(0)} KB)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analysis.isRunning || files.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-aifm-gold text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {analysis.isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyserar
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analysera dokument
                    </>
                  )}
                </button>
              </div>
            )}
            {analysis.isRunning && (
              <div className="mt-6">
                <AnalysisProgressBar
                  isActive
                  progress={analysis.progress}
                  message={analysis.message}
                  completedChunks={analysis.completedChunks}
                  totalChunks={analysis.totalChunks}
                />
              </div>
            )}
            {aiFilled.size > 0 && (
              <div className="mt-6 p-4 bg-aifm-gold/5 border border-aifm-gold/15 rounded-2xl">
                <div className="flex items-center gap-2 text-sm text-aifm-charcoal">
                  <CheckCircle2 className="w-4 h-4 text-aifm-gold" />
                  <span className="font-medium">{aiFilled.size} frågor ifyllda av agenten.</span>
                  <span className="text-aifm-charcoal/60">Gå vidare för att granska och jämföra med API-data.</span>
                </div>
              </div>
            )}
          </div>
        );
      case 2:
        return renderSectionQuestions(0);
      case 3:
        return renderSectionQuestions(1);
      case 4:
        return renderSectionQuestions(2);
      case 5:
        return renderSectionQuestions(3);
      case 6:
        return renderSectionQuestions(4);
      case 7:
        return renderSectionQuestions(5);
      case 8:
        return (
          <div>
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <PenTool className="w-4 h-4 text-aifm-gold" />
              Sammanfattning & signatur
            </h2>
            {renderSectionQuestions(6)}
            <h2 className="text-base font-semibold text-aifm-charcoal border-t border-gray-100 pt-8 pb-2 mb-4 mt-8">
              Signatur
            </h2>
            <p className="text-sm text-aifm-charcoal/60 mb-4">
              Bekräfta att ESG-uppgifterna är korrekta och att AIFM Capital AB ska kontaktas vid förändringar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">Datum</label>
                <input
                  type="date"
                  value={signatureDate}
                  onChange={(e) => setSignatureDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">Namn</label>
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Namn"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">Företag</label>
                <input
                  type="text"
                  value={signatureCompany}
                  onChange={(e) => setSignatureCompany(e.target.value)}
                  placeholder="Företagsnamn"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
                />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-aifm-charcoal text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-aifm"
              >
                {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Exportera som PDF
              </button>
              <p className="text-xs text-aifm-charcoal/40 mt-2">
                Genererar en professionell PDF med alla frågor, svar och signaturer.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <FullPageDropZone onFiles={handleDroppedFiles} maxSizeMB={MAX_FILE_SIZE_MB} disabled={analysis.isRunning}>
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">ESG</h1>
              <p className="text-xs text-aifm-charcoal/40 mt-0.5 tracking-wide">
                Analys av ESG-rapporter från bolag
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

        <div className="bg-white rounded-2xl border border-gray-100 shadow-aifm p-8">
          {renderStep()}
        </div>

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
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-200 text-sm text-aifm-charcoal hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Spara
            </button>
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
