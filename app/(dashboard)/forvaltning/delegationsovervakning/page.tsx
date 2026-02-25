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
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Send,
  Building2,
  Users,
  AlertTriangle,
  Scale,
  Monitor,
  Leaf,
  PenTool,
  Download,
} from 'lucide-react';
import {
  DELEGATION_SECTIONS,
  UNDERLAG_ITEMS,
  getOrderedQuestionIds,
  type DelegationQuestion,
  type DelegationSection,
} from '@/lib/delegation/questions';
import { useBackgroundAnalysis } from '@/lib/analysis/useBackgroundAnalysis';
import AnalysisProgressBar from '@/components/ui/AnalysisProgressBar';
import FullPageDropZone from '@/components/ui/FullPageDropZone';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx';
const MAX_FILE_SIZE_MB = 50;

type SfdrArticle = '6' | '8' | '9';
const SFDR_OPTIONS: { value: SfdrArticle; label: string; short: string }[] = [
  { value: '6', label: 'Artikel 6 – Inga särskilda hållbarhetskrav', short: 'Art. 6' },
  { value: '8', label: 'Artikel 8 – Främjar miljö-/sociala egenskaper', short: 'Art. 8' },
  { value: '9', label: 'Artikel 9 – Hållbart investeringsmål', short: 'Art. 9' },
];

interface FundOption { id: string; name: string }

type AnswersState = Record<string, string>;
type UnderlagState = Record<string, boolean>;
type AiFilledState = Set<string>;

const STEPS = [
  { id: 1, name: 'Dokument & Analys', icon: Upload },
  { id: 2, name: 'Ekonomi & Organisation', icon: Building2 },
  { id: 3, name: 'Personal', icon: Users },
  { id: 4, name: 'Incidenter', icon: AlertTriangle },
  { id: 5, name: 'Legala aspekter', icon: Scale },
  { id: 6, name: 'IT & Säkerhet', icon: Monitor },
  { id: 7, name: 'ESG', icon: Leaf },
  { id: 8, name: 'Underlag & Signatur', icon: PenTool },
];

function flattenQuestions(section: DelegationSection): { q: DelegationQuestion; depth: number }[] {
  const out: { q: DelegationQuestion; depth: number }[] = [];
  function walk(q: DelegationQuestion, depth: number) {
    out.push({ q, depth });
    q.subQuestions?.forEach((sq) => walk(sq, depth + 1));
  }
  section.questions.forEach((q) => walk(q, 0));
  return out;
}

export default function DelegationsovervakningPage() {
  const router = useRouter();
  const [year, setYear] = useState(2025);
  const [currentStep, setCurrentStep] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [sfdrArticle, setSfdrArticle] = useState<SfdrArticle>('8');
  const [funds, setFunds] = useState<FundOption[]>([]);
  const [selectedFundId, setSelectedFundId] = useState('');
  const analysis = useBackgroundAnalysis('delegation');
  const [answers, setAnswers] = useState<AnswersState>(() => {
    const ids = getOrderedQuestionIds();
    const initial: AnswersState = {};
    ids.forEach((id) => (initial[id] = ''));
    return initial;
  });
  const [answerDetails, setAnswerDetails] = useState<AnswersState>(() => {
    const ids = getOrderedQuestionIds();
    const initial: AnswersState = {};
    ids.forEach((id) => (initial[id + '_detail'] = ''));
    return initial;
  });
  const [underlag, setUnderlag] = useState<UnderlagState>(() => {
    const o: UnderlagState = {};
    UNDERLAG_ITEMS.forEach((u) => (o[u.id] = false));
    return o;
  });
  const [signatureDate, setSignatureDate] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [signatureCompany, setSignatureCompany] = useState('');
  const [aiFilled, setAiFilled] = useState<AiFilledState>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const formTopRef = useRef<HTMLDivElement>(null);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const items = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(pdf|docx?|xlsx?)$/i.test(f.name)
    );
    if (items.some((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024)) return;
    setFiles((prev) => [...prev, ...items].slice(0, 10));
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

  // When background analysis completes, apply results
  useEffect(() => {
    if (analysis.isDone) {
      const result = analysis.consumeResult();
      if (result) {
        const nextAi = new Set<string>();
        const normalized = (v: string) => {
          const s = String(v).trim().toLowerCase();
          if (s === 'ja' || s === 'yes') return 'yes';
          if (s === 'nej' || s === 'no') return 'no';
          return String(v).trim();
        };
        setAnswers((prev) => {
          const next = { ...prev };
          for (const [id, value] of Object.entries(result.answers)) {
            if (value != null && String(value).trim() !== '') {
              next[id] = normalized(value);
              nextAi.add(id);
            }
          }
          return next;
        });
        setAnswerDetails((prev) => {
          const next = { ...prev };
          for (const [id, value] of Object.entries(result.details)) {
            if (value != null && String(value).trim() !== '') next[id + '_detail'] = String(value).trim();
          }
          return next;
        });
        setAiFilled(nextAi);

        // Auto-archive: generate PDF and save to personal data room (fire-and-forget)
        fetch('/api/auto-archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysisType: 'delegation',
            data: {
              answers: result.answers || {},
              details: result.details || {},
              sfdrArticle,
            },
          }),
        }).catch(() => {});
      }
    }
    if (analysis.isError && analysis.error) {
      setSaveMessage(analysis.error);
      setTimeout(() => setSaveMessage(null), 5000);
      analysis.reset();
    }
  }, [analysis.isDone, analysis.isError, analysis.error, analysis.consumeResult, analysis.reset, sfdrArticle]);

  const handleAnalyze = useCallback(() => {
    if (files.length === 0) return;
    const extra: Record<string, string> = { sfdrArticle };
    if (selectedFundId) extra.fundId = selectedFundId;
    analysis.startAnalysis('/api/delegation/analyze', files, extra);
  }, [files, sfdrArticle, selectedFundId, analysis.startAnalysis]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/delegation/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: submissionId ?? undefined,
          year,
          answers,
          answerDetails,
          underlag,
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
  }, [submissionId, year, sfdrArticle, answers, answerDetails, underlag, signatureDate, signatureName, signatureCompany]);

  const handleExportPdf = useCallback(async () => {
    setExportingPdf(true);
    try {
      const res = await fetch('/api/delegation/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, answerDetails, signatureDate, signatureName, signatureCompany, sfdrArticle, underlag }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || 'Kunde inte generera PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Delegationsovervakning_${new Date().toLocaleDateString('sv-SE')}.pdf`;
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
  }, [answers, answerDetails, signatureDate, signatureName, signatureCompany, year, sfdrArticle]);

  const renderQuestion = (q: DelegationQuestion, depth: number) => {
    const id = q.id;
    const value = answers[id] ?? '';
    const detailValue = answerDetails[id + '_detail'] ?? '';
    const isAiFilled = aiFilled.has(id) && value.trim() !== '';

    if (q.type === 'text') {
      return (
        <div key={id} className={depth > 0 ? 'ml-6 mt-3' : 'mt-5'}>
          <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">
            {q.number}. {q.text}
            {isAiFilled && (
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-aifm-gold/10 text-aifm-charcoal">
                <Sparkles className="w-3 h-3" /> Agent-ifyllt
              </span>
            )}
          </label>
          <textarea
            value={value}
            onChange={(e) => setAnswer(id, e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
      );
    }

    if (q.type === 'yesno' || q.type === 'yesno_with_detail') {
      return (
        <div key={id} className={depth > 0 ? 'ml-6 mt-3' : 'mt-5'}>
          <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">
            {q.number}. {q.text}
            {isAiFilled && (
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-aifm-gold/10 text-aifm-charcoal">
                <Sparkles className="w-3 h-3" /> Agent-ifyllt
              </span>
            )}
          </label>
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

    return null;
  };

  const renderSectionQuestions = (sectionIndex: number) => {
    const section = DELEGATION_SECTIONS[sectionIndex];
    if (!section) return null;
    const flat = flattenQuestions(section);
    return (
      <div>
        <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-2 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-aifm-gold" />
          {section.title}
        </h2>
        {flat.map(({ q, depth }) => renderQuestion(q, depth))}
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
              Ladda upp dokument för analys
            </h2>
            <p className="text-sm text-aifm-charcoal/60 mb-4">
              Ladda upp relevanta dokument (årsredovisning, policyer, beredskapsplaner etc.) så analyserar AI:n innehållet och fyller i svaren automatiskt.
            </p>

            <p className="text-sm font-medium text-aifm-charcoal mb-3">SFDR-klassificering – vilken typ av fond/bolag gäller delegationen?</p>
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
                  <Leaf className="w-3.5 h-3.5" />
                  Fondvillkor och exkluderingspolicy inkluderas i analysen.
                </p>
              )}
            </div>

            <div
              className="border-2 border-dashed border-gray-200 rounded-2xl p-8 transition-colors hover:border-aifm-gold/30"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
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
                  id="delegation-file-input"
                />
                <label
                  htmlFor="delegation-file-input"
                  className="cursor-pointer px-4 py-2 rounded-full bg-aifm-charcoal/5 text-aifm-charcoal text-sm font-medium hover:bg-aifm-charcoal/10 transition-colors"
                >
                  Välj filer
                </label>
              </div>
            </div>
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
                  <span className="text-aifm-charcoal/60">Gå vidare för att granska och justera svaren.</span>
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
            {/* Begäran om underlag */}
            <h2 className="text-base font-semibold text-aifm-charcoal pb-2 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-aifm-gold" />
              Begäran om underlag
            </h2>
            <p className="text-sm text-aifm-charcoal/60 mb-4">
              Bifoga alla tillämpliga dokument om den delegerade verksamheten (kryssa i när bifogat).
            </p>
            <ul className="space-y-3 mb-10">
              {UNDERLAG_ITEMS.map((u) => (
                <li key={u.id} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={u.id}
                    checked={underlag[u.id] ?? false}
                    onChange={(e) => setUnderlag((prev) => ({ ...prev, [u.id]: e.target.checked }))}
                    className="mt-0.5 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                  />
                  <label htmlFor={u.id} className="text-sm text-aifm-charcoal cursor-pointer leading-relaxed">
                    {u.label}
                  </label>
                </li>
              ))}
            </ul>

            {/* Signatur */}
            <h2 className="text-base font-semibold text-aifm-charcoal border-t border-gray-100 pt-8 pb-2 mb-4">
              Signatur
            </h2>
            <p className="text-sm text-aifm-charcoal/60 mb-4">
              Denna signatur bekräftar att uppgifterna är korrekta och att AIFM Capital AB ska kontaktas vid förändringar.
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
                <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">Namnförtydligande</label>
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
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">
                Delegationsövervakning
              </h1>
              <p className="text-xs text-aifm-charcoal/40 mt-0.5 tracking-wide">
                Portföljförvaltning {year}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                onClick={() => router.back()}
                className="p-2 text-aifm-charcoal/30 hover:text-aifm-charcoal hover:bg-gray-50 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8" ref={formTopRef}>
        {/* Progress Steps — minimal pill stepper (identical to securities/new-approval) */}
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
                    <span
                      className={`text-xs font-medium tracking-wide hidden lg:inline ${
                        isActive ? 'text-white' : ''
                      }`}
                    >
                      {step.name}
                    </span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-6 h-px mx-0.5 ${isCompleted ? 'bg-aifm-gold/40' : 'bg-gray-200'}`}
                    />
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
            {/* Save status */}
            {saveMessage && (
              <span className="flex items-center gap-1 text-sm text-aifm-charcoal/60">
                {saveMessage === 'Sparat' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {saveMessage}
              </span>
            )}

            {/* Save button */}
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
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-aifm-gold text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Skicka in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </FullPageDropZone>
  );
}
