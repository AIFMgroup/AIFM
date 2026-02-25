'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search,
  Loader2,
  Building2,
  BarChart3,
  Leaf,
  Shield,
  FileText,
  TrendingUp,
  AlertTriangle,
  Newspaper,
  CheckCircle2,
  Download,
  Sparkles,
  Database,
  ThumbsUp,
  ThumbsDown,
  Globe,
  Target,
  GitCompare,
  Plus,
  X,
} from 'lucide-react';
import type { CompleteCompanyAnalysis } from '@/lib/company-analysis/types';

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

const TABS = [
  { id: 'overview', label: 'Översikt', icon: Sparkles },
  { id: 'identification', label: 'Identifiering', icon: Building2 },
  { id: 'market', label: 'Marknadsdata', icon: BarChart3 },
  { id: 'metrics', label: 'Nyckeltal', icon: Target },
  { id: 'esg', label: 'ESG & Hållbarhet', icon: Leaf },
  { id: 'compliance', label: 'Compliance', icon: Shield },
  { id: 'financial', label: 'Finansiell analys', icon: TrendingUp },
  { id: 'risk', label: 'Risk & SWOT', icon: AlertTriangle },
  { id: 'documents', label: 'Dokument', icon: FileText },
  { id: 'news', label: 'Nyheter', icon: Newspaper },
];

type FundOption = { id: string; name: string };
type Mode = 'single' | 'compare';

export default function HelhetsanalysPage() {
  const [mode, setMode] = useState<Mode>('single');
  const [isin, setIsin] = useState('');
  const [mic, setMic] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [compareEntries, setCompareEntries] = useState<Array<{ isin: string; mic: string; name: string }>>([
    { isin: '', mic: '', name: '' },
    { isin: '', mic: '', name: '' },
  ]);
  const [funds, setFunds] = useState<FundOption[]>([]);
  const [selectedFundId, setSelectedFundId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CompleteCompanyAnalysis | null>(null);
  const [compareAnalyses, setCompareAnalyses] = useState<CompleteCompanyAnalysis[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

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

  const handleAnalyze = useCallback(async () => {
    if (!isin.trim() && !companyName.trim()) {
      setError('Ange ISIN eller bolagsnamn.');
      return;
    }
    setError(null);
    setLoading(true);
    setAnalysis(null);
    setProgressMsg('Identifierar bolag via OpenFIGI, GLEIF & Yahoo Finance...');

    try {
      const res = await fetch('/api/company-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isin: isin.trim() || undefined,
          mic: mic.trim() || undefined,
          query: companyName.trim() || undefined,
          companyName: companyName.trim() || undefined,
          fundId: selectedFundId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysen misslyckades');
      setAnalysis(data);
      setActiveTab('overview');
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  }, [isin, mic, companyName, selectedFundId]);

  const handleCompare = useCallback(async () => {
    const valid = compareEntries.filter((e) => e.isin.trim() || e.name.trim());
    if (valid.length < 2) { setError('Ange minst 2 bolag att jämföra (ISIN eller namn krävs).'); return; }
    setError(null);
    setLoading(true);
    setCompareAnalyses([]);
    try {
      const res = await fetch('/api/company-analysis/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: valid.map((e) => ({
            isin: e.isin.trim() || undefined,
            mic: e.mic.trim() || undefined,
            name: e.name.trim() || undefined,
          })),
          fundId: selectedFundId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Jämförelse misslyckades');
      setCompareAnalyses(data.analyses || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel');
    } finally {
      setLoading(false);
    }
  }, [compareEntries, selectedFundId]);

  const handleExportPdf = useCallback(async () => {
    if (!analysis) return;
    setExportingPdf(true);
    try {
      const res = await fetch('/api/company-analysis/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || 'Kunde inte generera PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Helhetsanalys_${new Date().toLocaleDateString('sv-SE')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF-export misslyckades');
    } finally {
      setExportingPdf(false);
    }
  }, [analysis]);

  const displayName = (a: CompleteCompanyAnalysis) =>
    a.identification?.companyName || a.identification?.ticker || 'Okänt bolag';

  return (
    <div className="min-h-screen bg-gray-50/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c0a280] to-[#a08060] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#2d2a26]">Helhetsanalys</h1>
              <p className="text-sm text-gray-500">
                Komplett bolagsanalys — identifiering, marknadsdata, ESG, compliance, AI-analys och nyheter
              </p>
            </div>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => { setMode('single'); setCompareAnalyses([]); }} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'single' ? 'bg-[#c0a280] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <Search className="w-4 h-4 inline mr-1.5 -mt-0.5" />Enskild analys
          </button>
          <button onClick={() => { setMode('compare'); setAnalysis(null); }} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'compare' ? 'bg-[#c0a280] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <GitCompare className="w-4 h-4 inline mr-1.5 -mt-0.5" />Jämför bolag
          </button>
        </div>

        {/* Input form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-6">
          {mode === 'single' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">ISIN</label>
                  <input
                    type="text"
                    value={isin}
                    onChange={(e) => setIsin(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    placeholder="t.ex. SE0000115446"
                    className="w-full py-2.5 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c0a280]/40 focus:border-[#c0a280] placeholder:text-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">MIC / Börs</label>
                  <input
                    type="text"
                    value={mic}
                    onChange={(e) => setMic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    placeholder="t.ex. XSTO"
                    className="w-full py-2.5 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c0a280]/40 focus:border-[#c0a280] placeholder:text-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Bolagsnamn <span className="text-gray-400 normal-case">(valfritt)</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    placeholder="t.ex. Volvo, Apple Inc"
                    className="w-full py-2.5 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c0a280]/40 focus:border-[#c0a280] placeholder:text-gray-300"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[180px]">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Fond (valfritt)</label>
                  <select
                    value={selectedFundId}
                    onChange={(e) => setSelectedFundId(e.target.value)}
                    className="w-full py-2.5 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c0a280]/40 focus:border-[#c0a280] bg-white"
                  >
                    <option value="">Ingen fond vald</option>
                    {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#c0a280] to-[#a08060] text-white rounded-xl text-sm font-medium hover:shadow-md transition-all disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  {loading ? 'Analyserar...' : 'Kör helhetsanalys'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Jämför 2–3 bolag</label>
              <div className="space-y-4">
                {compareEntries.map((entry, i) => (
                  <div key={i} className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-[#c0a280] bg-[#c0a280]/10 w-6 h-6 rounded-full flex items-center justify-center">{i + 1}</span>
                      <span className="text-xs font-medium text-gray-500">Bolag {i + 1}</span>
                      {compareEntries.length > 2 && (
                        <button onClick={() => setCompareEntries((p) => p.filter((_, j) => j !== i))} className="ml-auto text-gray-400 hover:text-red-500 text-xs flex items-center gap-1"><X className="w-3.5 h-3.5" />Ta bort</button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">ISIN</label>
                        <input
                          type="text"
                          value={entry.isin}
                          onChange={(e) => setCompareEntries((p) => { const n = [...p]; n[i] = { ...n[i], isin: e.target.value }; return n; })}
                          placeholder="t.ex. SE0000115446"
                          className="w-full py-2 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c0a280]/40 focus:border-[#c0a280] placeholder:text-gray-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">MIC / Börs</label>
                        <input
                          type="text"
                          value={entry.mic}
                          onChange={(e) => setCompareEntries((p) => { const n = [...p]; n[i] = { ...n[i], mic: e.target.value }; return n; })}
                          placeholder="t.ex. XSTO"
                          className="w-full py-2 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c0a280]/40 focus:border-[#c0a280] placeholder:text-gray-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Bolagsnamn <span className="text-gray-300">(valfritt)</span></label>
                        <input
                          type="text"
                          value={entry.name}
                          onChange={(e) => setCompareEntries((p) => { const n = [...p]; n[i] = { ...n[i], name: e.target.value }; return n; })}
                          placeholder="t.ex. Volvo"
                          className="w-full py-2 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c0a280]/40 focus:border-[#c0a280] placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                    {i < compareEntries.length - 1 && <div className="border-b border-gray-100 mt-4"></div>}
                  </div>
                ))}
                {compareEntries.length < 3 && (
                  <button onClick={() => setCompareEntries((p) => [...p, { isin: '', mic: '', name: '' }])} className="inline-flex items-center gap-1 text-sm text-[#c0a280] hover:underline">
                    <Plus className="w-4 h-4" />Lägg till bolag
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[180px]">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Fond (valfritt)</label>
                  <select
                    value={selectedFundId}
                    onChange={(e) => setSelectedFundId(e.target.value)}
                    className="w-full py-2.5 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c0a280]/40 focus:border-[#c0a280] bg-white"
                  >
                    <option value="">Ingen fond vald</option>
                    {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleCompare}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#c0a280] to-[#a08060] text-white rounded-xl text-sm font-medium hover:shadow-md transition-all disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
                  {loading ? 'Jämför...' : 'Jämför bolag'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        {loading && (
          <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-2 border-[#c0a280]/20"></div>
                <div className="absolute inset-0 rounded-full border-2 border-[#c0a280] border-t-transparent animate-spin"></div>
              </div>
              <div>
                <p className="text-sm font-medium text-[#2d2a26]">Kör helhetsanalys</p>
                <p className="text-xs text-gray-500">
                  Samlar data från OpenFIGI, GLEIF, Yahoo Finance, ESG, nyheter och kör AI-djupanalys med Claude...
                </p>
                <p className="text-xs text-[#c0a280] mt-1 font-medium">
                  Analysen kan ta upp till 5 minuter, stäng inte ner denna sida.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Single result */}
        {mode === 'single' && analysis && (
          <div ref={resultRef} className="space-y-6">
            {/* Header bar */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#2d2a26]">{displayName(analysis)}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {[analysis.identification?.ticker, analysis.identification?.isin, analysis.identification?.sector].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-all"
                >
                  {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Exportera PDF
                </button>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mt-4">
                {analysis.summary?.overallRating && (() => {
                  const r = RATING_COLORS[analysis.summary.overallRating];
                  return r ? <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${r.bg} ${r.text}`}>{r.label}</span> : null;
                })()}
                {analysis.summary?.riskLevel && (() => {
                  const r = RISK_COLORS[analysis.summary.riskLevel];
                  return r ? <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${r.bg} ${r.text}`}>{r.label}</span> : null;
                })()}
                {analysis.summary?.esgRating && (() => {
                  const r = ESG_COLORS[analysis.summary.esgRating];
                  return r ? <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${r.bg} ${r.text}`}>ESG: {r.label}</span> : null;
                })()}
              </div>

              {(analysis.warnings?.length ?? 0) > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-xs">
                  {analysis.warnings!.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}
            </div>

            {/* Tab bar */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 px-2 overflow-x-auto">
                <nav className="flex gap-0 min-w-max">
                  {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === id
                          ? 'border-[#c0a280] text-[#c0a280]'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />{label}
                    </button>
                  ))}
                </nav>
              </div>
              <div className="p-6">
                <TabContent tabId={activeTab} analysis={analysis} />
              </div>
            </div>
          </div>
        )}

        {/* Compare result */}
        {mode === 'compare' && compareAnalyses.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-[#2d2a26]">Jämförelse</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 w-40"></th>
                    {compareAnalyses.map((a, i) => <th key={i} className="text-left py-3 px-4 font-semibold text-[#2d2a26]">{displayName(a)}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <CompareRow label="Ticker" values={compareAnalyses.map((a) => a.identification?.ticker)} />
                  <CompareRow label="ISIN" values={compareAnalyses.map((a) => a.identification?.isin)} />
                  <CompareRow label="Sektor" values={compareAnalyses.map((a) => a.identification?.sector)} />
                  <CompareRow label="Land" values={compareAnalyses.map((a) => a.identification?.country)} />
                  <CompareRow label="Pris" values={compareAnalyses.map((a) => a.marketData?.currentPrice != null ? `${a.marketData.currentPrice} ${a.marketData.currency ?? ''}` : undefined)} />
                  <CompareRow label="Börsvärde" values={compareAnalyses.map((a) => a.marketData?.marketCap != null ? formatNum(a.marketData.marketCap) : undefined)} />
                  <CompareRow label="52v hög / låg" values={compareAnalyses.map((a) => a.marketData?.fiftyTwoWeekHigh != null ? `${a.marketData.fiftyTwoWeekHigh} / ${a.marketData.fiftyTwoWeekLow}` : undefined)} />
                  <CompareRow label="P/E" values={compareAnalyses.map((a) => a.marketData?.peRatio != null ? String(a.marketData.peRatio.toFixed(1)) : undefined)} />
                  <CompareRow label="ROE %" values={compareAnalyses.map((a) => a.marketData?.returnOnEquity != null ? String(a.marketData.returnOnEquity.toFixed(1)) : undefined)} />
                  <CompareRow label="ESG-poäng" values={compareAnalyses.map((a) => a.esg?.esg?.totalScore != null ? String(a.esg.esg.totalScore) : undefined)} />
                  <CompareRow label="Likviditet" values={compareAnalyses.map((a) => a.marketData?.liquidityCategory)} />
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareRow({ label, values }: { label: string; values: (string | undefined)[] }) {
  return (
    <tr>
      <td className="py-2.5 px-4 text-gray-500 font-medium">{label}</td>
      {values.map((v, i) => <td key={i} className="py-2.5 px-4 text-[#2d2a26]">{v || <span className="text-gray-300">—</span>}</td>)}
    </tr>
  );
}

function TabContent({ tabId, analysis }: { tabId: string; analysis: CompleteCompanyAnalysis }) {
  const id = analysis.identification;
  const market = analysis.marketData;
  const esg = analysis.esg;
  const compliance = analysis.compliance;
  const docs = analysis.documents;
  const financial = analysis.financialAnalysis;
  const riskSwot = analysis.riskSwot;
  const news = analysis.news;
  const summary = analysis.summary;

  switch (tabId) {
    case 'overview':
      return (
        <div className="space-y-8">
          {/* Executive summary */}
          {financial?.executiveSummary && (
            <div className="bg-[#f9f7f4] border border-[#c0a280]/20 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#c0a280] uppercase tracking-wide mb-3">Sammanfattning</h3>
              <FormattedText text={financial.executiveSummary} className="text-sm text-[#2d2a26] leading-relaxed" />
            </div>
          )}

          {/* Key metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard label="Kurs" value={market?.currentPrice != null ? `${market.currentPrice} ${market.currency ?? ''}` : '—'} />
            <MetricCard label="Börsvärde" value={market?.marketCap != null ? formatNum(market.marketCap) : '—'} />
            <MetricCard label="ESG-poäng" value={esg?.esg?.totalScore != null ? String(esg.esg.totalScore) : '—'} />
            <MetricCard label="Likviditet" value={market?.liquidityCategory || '—'} />
          </div>

          {/* ESG decision banner when fund context available */}
          {esg?.esgDecision && analysis.fundTermsContext && (
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${esg.esgDecision === 'approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              {esg.esgDecision === 'approved'
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                : <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />}
              <div>
                <p className={`text-sm font-semibold ${esg.esgDecision === 'approved' ? 'text-emerald-800' : 'text-red-800'}`}>
                  Fondvillkorkontroll ({analysis.fundTermsContext.fundName}): {esg.esgDecision === 'approved' ? 'GODKÄND' : 'UNDERKÄND'}
                </p>
                {esg.esgDecisionMotivation && (
                  <FormattedText
                    text={esg.esgDecisionMotivation.length > 500 ? esg.esgDecisionMotivation.slice(0, 500) + '...' : esg.esgDecisionMotivation}
                    className={`text-sm mt-2 leading-relaxed ${esg.esgDecision === 'approved' ? 'text-emerald-700' : 'text-red-700'}`}
                  />
                )}
              </div>
            </div>
          )}

          {/* Conclusion */}
          {summary?.conclusion && (
            <div>
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-2">Slutsats</h3>
              <FormattedText text={summary.conclusion} className="text-sm text-gray-700 leading-relaxed" />
            </div>
          )}

          {/* Investment thesis */}
          {summary?.investmentThesis && (
            <div>
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-2">Investeringstes</h3>
              <FormattedText text={summary.investmentThesis} className="text-sm text-gray-700 leading-relaxed" />
            </div>
          )}

          {/* Pros & Cons */}
          {summary?.prosAndCons && (summary.prosAndCons.pros?.length || summary.prosAndCons.cons?.length) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {summary.prosAndCons.pros?.length ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />Fördelar</h4>
                  <ul className="space-y-1">{summary.prosAndCons.pros.map((p, i) => <li key={i} className="text-sm text-emerald-800">{p}</li>)}</ul>
                </div>
              ) : null}
              {summary.prosAndCons.cons?.length ? (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1"><ThumbsDown className="w-3.5 h-3.5" />Nackdelar</h4>
                  <ul className="space-y-1">{summary.prosAndCons.cons.map((c, i) => <li key={i} className="text-sm text-red-800">{c}</li>)}</ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      );

    case 'identification':
      return (
        <div className="space-y-3">
          <InfoRow label="Bolag" value={id?.companyName} />
          <InfoRow label="Ticker" value={id?.ticker} />
          <InfoRow label="ISIN" value={id?.isin} />
          <InfoRow label="Sektor" value={id?.sector} />
          <InfoRow label="Bransch" value={id?.industry} />
          <InfoRow label="Land" value={id?.country} />
          <InfoRow label="Börs" value={id?.exchange} />
          <InfoRow label="Valuta" value={id?.currency} />
          <InfoRow label="Emittent" value={id?.emitter} />
          <InfoRow label="Emittent LEI" value={id?.emitterLEI} />
        </div>
      );

    case 'market':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <MetricCard label="Kurs" value={market?.currentPrice != null ? `${market.currentPrice}` : '—'} sub={market?.currency} />
            <MetricCard label="Börsvärde" value={market?.marketCap != null ? formatNum(market.marketCap) : '—'} sub={market?.currency} />
            <MetricCard label="Snittvolym/dag" value={market?.averageDailyVolume != null ? formatNum(market.averageDailyVolume) : '—'} />
            <MetricCard label="52v hög" value={market?.fiftyTwoWeekHigh != null ? String(market.fiftyTwoWeekHigh) : '—'} />
            <MetricCard label="52v låg" value={market?.fiftyTwoWeekLow != null ? String(market.fiftyTwoWeekLow) : '—'} />
            <MetricCard label="Likviditet" value={market?.liquidityCategory || '—'} />
          </div>
          <div className="space-y-3">
            <InfoRow label="Börs" value={market?.exchange} />
            <InfoRow label="Reglerad marknad" value={market?.isRegulatedMarket != null ? (market.isRegulatedMarket ? 'Ja' : 'Nej') : undefined} />
            <InfoRow label="Likviditetspresumtion" value={market?.meetsLiquidityPresumption != null ? (market.meetsLiquidityPresumption ? 'Uppfylld' : 'Ej uppfylld') : undefined} />
            <InfoRow label="Beräknad avyttringstid" value={market?.estimatedLiquidationDays != null ? `${market.estimatedLiquidationDays} dagar` : undefined} />
          </div>
        </div>
      );

    case 'metrics':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <MetricWithLight label="P/E" value={market?.peRatio} type="pe" />
            <MetricWithLight label="Forward P/E" value={market?.forwardPE} type="pe" />
            <MetricWithLight label="P/B" value={market?.pbRatio} type="pb" />
            <MetricWithLight label="EV/EBITDA" value={market?.evToEbitda} type="evEbitda" />
            <MetricWithLight label="Utdelningsavkastning %" value={market?.dividendYield} type="yield" />
            <MetricWithLight label="ROE %" value={market?.returnOnEquity} type="roe" />
            <MetricWithLight label="Vinstmarginal %" value={market?.profitMargin} type="margin" />
            <MetricWithLight label="Rörelsemarginal %" value={market?.operatingMargin} type="margin" />
            <MetricWithLight label="Skuld/EK" value={market?.debtToEquity} type="debt" />
            <MetricWithLight label="Intäktstillväxt %" value={market?.revenueGrowth} type="growth" />
            <MetricWithLight label="Beta" value={market?.beta} type="beta" />
            <MetricWithLight label="50-dagars MA" value={market?.fiftyDayMA} type="neutral" />
            <MetricWithLight label="200-dagars MA" value={market?.twoHundredDayMA} type="neutral" />
          </div>
          {analysis.fundContext?.positionWeight != null && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-2">Fondkontext</h3>
              <p className="text-sm text-gray-600">Positionens vikt i fonden: <strong>{(analysis.fundContext.positionWeight * 100).toFixed(2)}%</strong></p>
              {analysis.fundContext.sectorPeers && analysis.fundContext.sectorPeers.length > 0 && (
                <p className="text-sm text-gray-600 mt-1">Övriga innehav (topp): {analysis.fundContext.sectorPeers.slice(0, 5).map((p) => p.name).join(', ')}</p>
              )}
            </div>
          )}
        </div>
      );

    case 'esg': {
      const ftc = analysis.fundTermsContext;
      return (
        <div className="space-y-6">
          {esg?.esgDecision && (
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${esg.esgDecision === 'approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              {esg.esgDecision === 'approved'
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                : <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />}
              <div>
                <p className={`text-sm font-semibold ${esg.esgDecision === 'approved' ? 'text-emerald-800' : 'text-red-800'}`}>
                  ESG-beslut: {esg.esgDecision === 'approved' ? 'GODKÄND' : 'UNDERKÄND'}
                  {ftc ? ` (${ftc.fundName}, Artikel ${ftc.article})` : ''}
                </p>
                {esg.esgDecisionMotivation && (
                  <FormattedText text={esg.esgDecisionMotivation} className={`text-sm mt-2 leading-relaxed ${esg.esgDecision === 'approved' ? 'text-emerald-700' : 'text-red-700'}`} />
                )}
              </div>
            </div>
          )}

          {esg?.esg && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard label="ESG totalt" value={esg.esg.totalScore != null ? String(esg.esg.totalScore) : '—'} />
              <MetricCard label="Miljö (E)" value={esg.esg.environmentScore != null ? String(esg.esg.environmentScore) : '—'} />
              <MetricCard label="Socialt (S)" value={esg.esg.socialScore != null ? String(esg.esg.socialScore) : '—'} />
              <MetricCard label="Styrning (G)" value={esg.esg.governanceScore != null ? String(esg.esg.governanceScore) : '—'} />
            </div>
          )}

          <div className="space-y-3">
            <InfoRow label="Kontroversnivå" value={esg?.esg?.controversyLevel != null ? String(esg.esg.controversyLevel) : undefined} />
            <InfoRow label="SFDR" value={esg?.esg?.sfdrAlignment} />
            <InfoRow label="Datakälla" value={esg?.provider} />
          </div>

          {ftc && ftc.exclusions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-3">
                Exkluderingskontroll — {ftc.fundName} (max omsättning %)
              </h3>
              <div className="space-y-2">
                {ftc.exclusions.map((ex, i) => (
                  <div key={i} className={`flex items-center justify-between gap-3 py-2.5 px-4 rounded-xl border ${
                    ex.actualPercent === null
                      ? 'bg-gray-50 border-gray-200'
                      : ex.approved
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      {ex.actualPercent === null
                        ? <div className="w-4 h-4 rounded-full bg-gray-300 flex-shrink-0" />
                        : ex.approved
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          : <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                      <span className="text-sm font-medium text-[#2d2a26]">{ex.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500">Gräns: {ex.threshold}%</span>
                      <span className={ex.actualPercent === null ? 'text-gray-400' : ex.approved ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                        {ex.actualPercent !== null ? `${ex.actualPercent.toFixed(1)}%` : 'Ingen data'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        ex.actualPercent === null
                          ? 'bg-gray-200 text-gray-600'
                          : ex.approved
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                      }`}>
                        {ex.actualPercent === null ? 'N/A' : ex.approved ? 'OK' : 'EJ OK'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ftc?.promotedCharacteristics && ftc.promotedCharacteristics.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-2">Främjade egenskaper (Artikel {ftc.article})</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                {ftc.promotedCharacteristics.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Leaf className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!ftc && esg?.exclusionScreening && (
            <div>
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-2">Exkluderingsscreening (utan fondkontext)</h3>
              <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl overflow-x-auto">{JSON.stringify(esg.exclusionScreening, null, 2)}</pre>
            </div>
          )}
        </div>
      );
    }

    case 'compliance':
      return (
        <div className="space-y-6">
          {(compliance?.fffsCompliance || compliance?.fffs) && (
            <div>
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-3">FFFS 2013:9 24 kap. 1 §</h3>
              <ul className="space-y-2">
                <ComplianceCheckItem label="Begränsad förlustpotential" ok={(compliance.fffsCompliance ?? compliance.fffs)?.limitedPotentialLoss} />
                <ComplianceCheckItem label="Likviditet inte äventurad" ok={(compliance.fffsCompliance ?? compliance.fffs)?.liquidityNotEndangered} />
                <ComplianceCheckItem label="Pålitlig värdering" ok={(compliance.fffsCompliance ?? compliance.fffs)?.reliableValuation?.checked} />
                <ComplianceCheckItem label="Lämplig information" ok={(compliance.fffsCompliance ?? compliance.fffs)?.appropriateInformation?.checked} />
                <ComplianceCheckItem label="Marknadsbar" ok={(compliance.fffsCompliance ?? compliance.fffs)?.isMarketable} />
                <ComplianceCheckItem label="Förenlig med fond" ok={(compliance.fffsCompliance ?? compliance.fffs)?.compatibleWithFund} />
                <ComplianceCheckItem label="Riskhantering täcker" ok={(compliance.fffsCompliance ?? compliance.fffs)?.riskManagementCaptures} />
              </ul>
            </div>
          )}
          {compliance?.liquidityAnalysis && (
            <div>
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-3">Likviditetsanalys</h3>
              <ComplianceDataGrid data={compliance.liquidityAnalysis} />
            </div>
          )}
          {compliance?.valuationInfo && (
            <div>
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-3">Värderingsinfo</h3>
              <ComplianceDataGrid data={compliance.valuationInfo} />
            </div>
          )}
          {compliance?.regulatoryContext && compliance.regulatoryContext.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-2">Regelverkskontext</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                {compliance.regulatoryContext.slice(0, 5).map((text, i) => (
                  <li key={i} className="bg-gray-50 p-3 rounded-xl border border-gray-100">{text.slice(0, 400)}{text.length > 400 ? '…' : ''}</li>
                ))}
              </ul>
            </div>
          )}
          {compliance?.fundCompliance && (
            <div>
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-3">Fondcompliance</h3>
              <ComplianceDataGrid data={compliance.fundCompliance} />
            </div>
          )}
          {!compliance?.liquidityAnalysis && !compliance?.valuationInfo && !compliance?.fundCompliance && !compliance?.fffsCompliance && !compliance?.fffs && <EmptyState text="Ingen compliance-data tillgänglig." />}
        </div>
      );

    case 'financial':
      return (
        <div className="space-y-6">
          {financial?.executiveSummary && <TextSection title="Sammanfattning" text={financial.executiveSummary} />}
          {financial?.placementStrategyFit && (
            <div className="bg-[#f9f7f4] border border-[#c0a280]/20 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-[#c0a280]" />
                Passform med fondens placeringsstrategi
              </h3>
              <FormattedText text={financial.placementStrategyFit} className="text-sm text-gray-700 leading-relaxed" />
            </div>
          )}
          {financial?.companyOverview && <TextSection title="Bolagsbeskrivning" text={financial.companyOverview} />}
          {financial?.businessModel && <TextSection title="Affärsmodell" text={financial.businessModel} />}
          {financial?.marketPosition && <TextSection title="Marknadsposition" text={financial.marketPosition} />}
          {financial?.financialAnalysis && <TextSection title="Finansiell analys" text={financial.financialAnalysis} />}
          {financial?.valuationMetrics && <TextSection title="Värdering" text={financial.valuationMetrics} />}
          {financial?.managementGovernance && <TextSection title="Ledning & styrning" text={financial.managementGovernance} />}
          {!financial?.executiveSummary && !financial?.companyOverview && <EmptyState text="Ingen AI-genererad finansiell analys tillgänglig." />}
        </div>
      );

    case 'risk':
      return (
        <div className="space-y-6">
          {riskSwot?.riskAnalysis && <TextSection title="Riskanalys" text={riskSwot.riskAnalysis} />}
          {riskSwot?.controversySummary && <TextSection title="Kontroverser" text={riskSwot.controversySummary} />}
          {riskSwot?.swotAnalysis && (
            <div>
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-3">SWOT-analys</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SwotCard title="Styrkor" items={riskSwot.swotAnalysis.strengths} color="emerald" />
                <SwotCard title="Svagheter" items={riskSwot.swotAnalysis.weaknesses} color="red" />
                <SwotCard title="Möjligheter" items={riskSwot.swotAnalysis.opportunities} color="blue" />
                <SwotCard title="Hot" items={riskSwot.swotAnalysis.threats} color="amber" />
              </div>
            </div>
          )}
          {!riskSwot?.riskAnalysis && !riskSwot?.swotAnalysis && <EmptyState text="Ingen risk/SWOT-data tillgänglig." />}
        </div>
      );

    case 'documents':
      return (
        <div className="space-y-6">
          {docs?.documentExcerpts && docs.documentExcerpts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-3">Dokumentutdrag (använda i analysen)</h3>
              <div className="space-y-4">
                {docs.documentExcerpts.map((ex, i) => (
                  <div key={i} className="bg-[#f9f7f4] border border-[#c0a280]/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-[#c0a280]" />
                      <span className="font-medium text-[#2d2a26]">{ex.fileName}</span>
                      {ex.category && <span className="text-xs text-gray-500">({ex.category})</span>}
                    </div>
                    <FormattedText text={ex.excerpt} className="text-sm text-gray-700 leading-relaxed line-clamp-6" />
                    {ex.excerptLength && <p className="text-xs text-gray-400 mt-2">Utdrag: ca {ex.excerptLength} tecken</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {docs?.irDocuments?.length ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#2d2a26] mb-2">Tillgängliga IR-dokument</h3>
              {docs.irDocuments.slice(0, 30).map((d, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-xl">
                  <FileText className="w-4 h-4 text-[#c0a280] flex-shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium text-[#2d2a26]">{d.fileName}</span>
                    <span className="text-gray-400 ml-2">{d.category}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : !docs?.documentExcerpts?.length ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-1">Inga IR-dokument har skrapats för detta bolag ännu.</p>
              <p className="text-xs text-gray-400">Dokument skrapas automatiskt veckovis för bolag i fondernas innehav.</p>
            </div>
          ) : null}
        </div>
      );

    case 'news':
      return (
        <div>
          {news?.articles?.length ? (
            <div className="space-y-3">
              {news.articles.slice(0, 15).map((art, i) => (
                <div key={i} className="py-3 border-b border-gray-100 last:border-0">
                  <a href={art.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#c0a280] hover:underline flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" />{art.title}
                  </a>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    {art.source && <span>{art.source}</span>}
                    {art.publishedAt && <span>{new Date(art.publishedAt).toLocaleDateString('sv-SE')}</span>}
                  </div>
                  {art.summary && <p className="text-sm text-gray-600 mt-1">{art.summary}</p>}
                </div>
              ))}
            </div>
          ) : <EmptyState text="Inga nyheter hittades." />}
        </div>
      );

    default:
      return null;
  }
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-semibold text-[#2d2a26]">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-4 py-2 border-b border-gray-50">
      <span className="text-sm text-gray-500 w-40 flex-shrink-0">{label}</span>
      <span className="text-sm text-[#2d2a26] font-medium">{value}</span>
    </div>
  );
}

function FormattedText({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}|\r\n\r\n/).filter(Boolean);
  if (paragraphs.length <= 1) {
    const lines = text.split(/\n/).filter(Boolean);
    if (lines.length <= 1) {
      return <p className={className}>{text}</p>;
    }
    return (
      <div className={`space-y-3 ${className || ''}`}>
        {lines.map((line, i) => <p key={i}>{line.trim()}</p>)}
      </div>
    );
  }
  return (
    <div className={`space-y-4 ${className || ''}`}>
      {paragraphs.map((para, i) => {
        const lines = para.split(/\n/).filter(Boolean);
        return (
          <div key={i} className="space-y-1">
            {lines.map((line, j) => <p key={j}>{line.trim()}</p>)}
          </div>
        );
      })}
    </div>
  );
}

function TextSection({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#2d2a26] mb-2">{title}</h3>
      <FormattedText text={text} className="text-sm text-gray-700 leading-relaxed" />
    </div>
  );
}

function SwotCard({ title, items, color }: { title: string; items?: string[]; color: string }) {
  if (!items?.length) return null;
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    red: 'bg-red-50 border-red-100 text-red-800',
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || 'bg-gray-50 border-gray-100 text-gray-800'}`}>
      <h4 className="text-xs font-semibold uppercase tracking-wide mb-2">{title}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => <li key={i} className="text-sm">{item}</li>)}
      </ul>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 py-8 text-center">{text}</p>;
}

type MetricLightType = 'pe' | 'pb' | 'roe' | 'margin' | 'yield' | 'debt' | 'growth' | 'evEbitda' | 'beta' | 'neutral';
function metricLight(value: number | undefined, type: MetricLightType): 'green' | 'amber' | 'red' | 'gray' {
  if (value == null || type === 'neutral') return 'gray';
  switch (type) {
    case 'pe':
    case 'evEbitda':
      return value < 15 ? 'green' : value <= 25 ? 'amber' : 'red';
    case 'pb':
      return value < 2 ? 'green' : value <= 4 ? 'amber' : 'red';
    case 'roe':
    case 'margin':
      return value >= 15 ? 'green' : value >= 5 ? 'amber' : 'red';
    case 'yield':
      return value >= 2 ? 'green' : value > 0 ? 'amber' : 'gray';
    case 'debt':
      return value < 1 ? 'green' : value <= 2 ? 'amber' : 'red';
    case 'growth':
      return value >= 10 ? 'green' : value >= 0 ? 'amber' : 'red';
    case 'beta':
      return value >= 0.8 && value <= 1.2 ? 'green' : 'amber';
    default:
      return 'gray';
  }
}

function MetricWithLight({ label, value, type }: { label: string; value?: number; type: MetricLightType }) {
  const light = metricLight(value, type);
  const dot = light === 'green' ? 'bg-emerald-500' : light === 'amber' ? 'bg-amber-500' : light === 'red' ? 'bg-red-500' : 'bg-gray-300';
  const display = value != null ? (type === 'yield' || type === 'margin' || type === 'roe' || type === 'growth' ? `${value.toFixed(1)}%` : value.toFixed(2)) : '—';
  return (
    <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between gap-2">
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-[#2d2a26]">{display}</p>
      </div>
      {value != null && <span className={`w-3 h-3 rounded-full flex-shrink-0 ${dot}`} title={light} />}
    </div>
  );
}

const COMPLIANCE_LABELS: Record<string, string> = {
  fffsLiquidityNotEndangered: 'Likviditet inte äventurad (FFFS)',
  fffsIsMarketable: 'Marknadsbar (FFFS)',
  limitedPotentialLoss: 'Begränsad förlustpotential',
  liquidityNotEndangered: 'Likviditet inte äventurad',
  reliableValuation: 'Pålitlig värdering',
  appropriateInformation: 'Lämplig information',
  isMarketable: 'Marknadsbar',
  compatibleWithFund: 'Förenlig med fond',
  riskManagementCaptures: 'Riskhantering täcker',
  reliableDailyPrices: 'Daglig pålitlig prisdata',
  priceSourceUrl: 'Källa för prisdata',
  isEmission: 'Emission',
  averageDailyVolume: 'Genomsnittlig daglig volym',
  bidAskSpread: 'Bid/ask-spread',
  liquidityCategory: 'Likviditetskategori',
  motivering: 'Motivering',
  complianceMotivation: 'Motivering',
};

function ComplianceDataGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {entries.map(([key, val]) => {
        const label = COMPLIANCE_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
        let display: React.ReactNode;
        if (typeof val === 'boolean') {
          display = val
            ? <span className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />Ja</span>
            : <span className="flex items-center gap-1.5 text-red-700"><AlertTriangle className="w-3.5 h-3.5" />Nej</span>;
        } else if (typeof val === 'string' && val.startsWith('http')) {
          display = <a href={val} target="_blank" rel="noopener noreferrer" className="text-[#c0a280] underline truncate">{val.replace(/^https?:\/\//, '').slice(0, 50)}</a>;
        } else if (typeof val === 'object') {
          const obj = val as Record<string, unknown>;
          if ('checked' in obj) {
            display = obj.checked
              ? <span className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />Ja</span>
              : <span className="flex items-center gap-1.5 text-red-700"><AlertTriangle className="w-3.5 h-3.5" />Nej</span>;
          } else {
            display = <span className="text-gray-600">{JSON.stringify(val)}</span>;
          }
        } else {
          display = <span className="text-[#2d2a26] font-medium">{String(val)}</span>;
        }
        return (
          <div key={key} className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100">
            <span className="text-xs text-gray-500">{label}</span>
            <span className="text-sm">{display}</span>
          </div>
        );
      })}
    </div>
  );
}

function ComplianceCheckItem({ label, ok }: { label: string; ok?: boolean }) {
  if (ok == null) return null;
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
      <span className={ok ? 'text-gray-700' : 'text-red-700'}>{label}</span>
      <span className="ml-auto text-xs text-gray-400">{ok ? 'Uppfylld' : 'Ej uppfylld'}</span>
    </li>
  );
}

function formatNum(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' k';
  return String(n);
}
