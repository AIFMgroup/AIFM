'use client';

import { useState, useEffect } from 'react';
import {
  Globe, Search, Download, FileText, CheckCircle2, XCircle,
  AlertTriangle, Loader2, RefreshCw, Trash2, ChevronDown,
  ChevronRight, ExternalLink, FolderOpen, SkipForward,
} from 'lucide-react';

interface PdfLink {
  url: string;
  text: string;
  fileName: string;
  category: string;
  selected?: boolean;
}

interface DownloadResult {
  fileName: string;
  status: 'ok' | 'skipped' | 'error';
  message: string;
  documentId?: string;
  textLength?: number;
}

interface FundOption {
  id: string;
  name: string;
}

interface ExistingDoc {
  documentId: string;
  fileName: string;
  category: string;
  uploadedAt: string;
  fileSize: number;
  uploadedBy: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  fondvillkor: 'Fondvillkor / Prospekt',
  hallbarhetsrapport: 'Hållbarhetsrapport',
  placeringspolicy: 'Placeringspolicy',
  arsredovisning: 'Årsredovisning',
  delarsrapport: 'Delårsrapport',
  informationsbroschyr: 'Informationsbroschyr',
  faktablad: 'Faktablad / PRIIP',
  ovrigt: 'Övrigt',
};

const CATEGORY_OPTIONS = [
  { value: 'fondvillkor', label: 'Fondvillkor / Prospekt' },
  { value: 'informationsbroschyr', label: 'Informationsbroschyr' },
  { value: 'faktablad', label: 'Faktablad / PRIIP' },
  { value: 'hallbarhetsrapport', label: 'Hållbarhetsrapport' },
  { value: 'placeringspolicy', label: 'Placeringspolicy' },
  { value: 'arsredovisning', label: 'Årsredovisning' },
  { value: 'delarsrapport', label: 'Delårsrapport' },
  { value: 'ovrigt', label: 'Övrigt' },
];

function StatusIcon({ status }: { status: string }) {
  if (status === 'ok') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'skipped') return <SkipForward className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

export default function FundDocumentsPage() {
  const [url, setUrl] = useState('');
  const [fundId, setFundId] = useState('');
  const [funds, setFunds] = useState<FundOption[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const [pdfLinks, setPdfLinks] = useState<PdfLink[]>([]);
  const [results, setResults] = useState<DownloadResult[]>([]);
  const [error, setError] = useState('');
  const [existingDocs, setExistingDocs] = useState<ExistingDoc[]>([]);
  const [showExisting, setShowExisting] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Load funds
  useEffect(() => {
    fetch('/api/funds')
      .then((r) => r.json())
      .then((data) => {
        const f = data.funds?.map((f: any) => ({ id: f.id, name: f.name })) || [];
        setFunds(f);
      })
      .catch(() => {});
  }, []);

  // Load existing documents when fundId changes
  useEffect(() => {
    if (!fundId) { setExistingDocs([]); return; }
    setLoadingDocs(true);
    fetch(`/api/funds/documents?fundId=${encodeURIComponent(fundId)}`)
      .then((r) => r.json())
      .then((data) => setExistingDocs(data.documents || []))
      .catch(() => setExistingDocs([]))
      .finally(() => setLoadingDocs(false));
  }, [fundId]);

  const handleScan = async () => {
    if (!url.trim()) return;
    setIsScanning(true);
    setError('');
    setPdfLinks([]);
    setResults([]);
    setPageTitle('');

    try {
      const res = await fetch('/api/admin/scrape-fund-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Skanning misslyckades');

      setPageTitle(data.pageTitle || '');
      setPdfLinks((data.pdfLinks || []).map((l: PdfLink) => ({ ...l, selected: true })));
    } catch (err: any) {
      setError(err.message || 'Kunde inte skanna sidan');
    } finally {
      setIsScanning(false);
    }
  };

  const handleDownload = async () => {
    if (!fundId) { setError('Välj en fond först'); return; }
    const selected = pdfLinks.filter((l) => l.selected);
    if (selected.length === 0) { setError('Välj minst en PDF att ladda ner'); return; }

    setIsDownloading(true);
    setError('');
    setResults([]);

    try {
      const res = await fetch('/api/admin/scrape-fund-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          fundId,
          dryRun: false,
          selectedLinks: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nedladdning misslyckades');

      setResults(data.results || []);

      // Refresh existing docs
      if (fundId) {
        const docsRes = await fetch(`/api/funds/documents?fundId=${encodeURIComponent(fundId)}`);
        const docsData = await docsRes.json();
        setExistingDocs(docsData.documents || []);
      }
    } catch (err: any) {
      setError(err.message || 'Nedladdning misslyckades');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!fundId || !confirm('Ta bort detta dokument?')) return;
    try {
      await fetch(`/api/funds/documents?fundId=${encodeURIComponent(fundId)}&documentId=${encodeURIComponent(docId)}`, {
        method: 'DELETE',
      });
      setExistingDocs((prev) => prev.filter((d) => d.documentId !== docId));
    } catch {
      alert('Kunde inte ta bort dokumentet');
    }
  };

  const toggleAll = (selected: boolean) => {
    setPdfLinks((prev) => prev.map((l) => ({ ...l, selected })));
  };

  const toggleLink = (index: number) => {
    setPdfLinks((prev) => prev.map((l, i) => i === index ? { ...l, selected: !l.selected } : l));
  };

  const updateCategory = (index: number, category: string) => {
    setPdfLinks((prev) => prev.map((l, i) => i === index ? { ...l, category } : l));
  };

  const selectedCount = pdfLinks.filter((l) => l.selected).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fonddokument-skrapare</h1>
        <p className="text-gray-500 mt-1">
          Ange en webbsida med fonddokument. Verktyget hittar alla PDF-filer, laddar ner dem och utbildar plattformen.
        </p>
      </div>

      {/* URL Input + Fund Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Webbadress (URL)
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://aifmgroup.com/fond-namn/"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c0a280] focus:ring-2 focus:ring-[#c0a280]/10"
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              />
            </div>
            <button
              onClick={handleScan}
              disabled={isScanning || !url.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#2d2a26] rounded-lg hover:bg-[#3d3a36] disabled:opacity-40 transition-colors"
            >
              {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Skanna
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Koppla till fond
          </label>
          <select
            value={fundId}
            onChange={(e) => setFundId(e.target.value)}
            className="w-full py-2.5 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c0a280]"
          >
            <option value="">Välj fond...</option>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Scan Results */}
      {pdfLinks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Hittade {pdfLinks.length} PDF-filer
              </h2>
              {pageTitle && (
                <p className="text-xs text-gray-400 mt-0.5">{pageTitle}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleAll(true)}
                className="text-xs text-[#c0a280] hover:underline"
              >
                Välj alla
              </button>
              <button
                onClick={() => toggleAll(false)}
                className="text-xs text-gray-400 hover:underline"
              >
                Avmarkera alla
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {pdfLinks.map((link, i) => (
              <div
                key={i}
                className={`px-6 py-3 flex items-center gap-4 transition-colors ${
                  link.selected ? 'bg-white' : 'bg-gray-50/50 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={link.selected || false}
                  onChange={() => toggleLink(i)}
                  className="w-4 h-4 rounded border-gray-300 text-[#c0a280] focus:ring-[#c0a280]"
                />
                <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{link.text}</p>
                  <p className="text-xs text-gray-400 truncate">{link.fileName}</p>
                </div>
                <select
                  value={link.category}
                  onChange={(e) => updateCategory(i, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#c0a280]"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  title="Öppna PDF"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {selectedCount} av {pdfLinks.length} valda
            </p>
            <button
              onClick={handleDownload}
              disabled={isDownloading || selectedCount === 0 || !fundId}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#2d2a26] rounded-lg hover:bg-[#3d3a36] disabled:opacity-40 transition-colors"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isDownloading ? 'Laddar ner...' : `Ladda ner & utbilda (${selectedCount})`}
            </button>
          </div>
        </div>
      )}

      {/* Download Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Resultat</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {results.map((result, i) => (
              <div key={i} className="px-6 py-3 flex items-center gap-3">
                <StatusIcon status={result.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{result.fileName}</p>
                  <p className="text-xs text-gray-400">{result.message}</p>
                </div>
                {result.status === 'ok' && result.textLength && result.textLength > 0 && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    {result.textLength.toLocaleString()} tecken
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-500">
              {results.filter((r) => r.status === 'ok').length} nedladdade
              {results.filter((r) => r.status === 'skipped').length > 0 && `, ${results.filter((r) => r.status === 'skipped').length} redan uppladdade`}
              {results.filter((r) => r.status === 'error').length > 0 && `, ${results.filter((r) => r.status === 'error').length} fel`}
            </p>
          </div>
        </div>
      )}

      {/* Existing Documents */}
      {fundId && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowExisting(!showExisting)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">
                Befintliga dokument ({existingDocs.length})
              </h2>
              {loadingDocs && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            </div>
            {showExisting ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {showExisting && (
            <div className="border-t border-gray-100">
              {existingDocs.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Inga dokument uppladdade för denna fond</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {existingDocs.map((doc) => (
                    <div key={doc.documentId} className="px-6 py-3 flex items-center gap-3">
                      <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                        <p className="text-xs text-gray-400">
                          {CATEGORY_LABELS[doc.category] || doc.category} · {Math.round(doc.fileSize / 1024)} KB · {doc.uploadedBy} · {new Date(doc.uploadedAt).toLocaleDateString('sv-SE')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteDoc(doc.documentId)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title="Ta bort"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Links */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Snabblänkar – AIFM Group fonder</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Arte Collectum I', url: 'https://aifmgroup.com/arte-collectum-i-ab/' },
            { label: 'Arte Collectum II', url: 'https://aifmgroup.com/arte-collectum-ii/' },
          ].map((link) => (
            <button
              key={link.url}
              onClick={() => { setUrl(link.url); }}
              className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:border-[#c0a280] hover:text-[#c0a280] transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
