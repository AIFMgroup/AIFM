'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Play, Upload, CheckCircle2, Clock, AlertCircle,
  Loader2, FileText, RefreshCw, Zap, ChevronRight, Calendar,
  FileSpreadsheet, BarChart3, Shield, Mail, XCircle
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  details?: string;
  error?: string;
}

interface PipelineRun {
  date: string;
  status: string;
  steps: PipelineStep[];
  startedAt: string;
  completedAt?: string;
  approvalId?: string;
  error?: string;
}

interface PipelineResponse {
  success: boolean;
  navDate: string;
  status: string;
  approvalId?: string;
  steps: PipelineStep[];
  message?: string;
  error?: string;
}

// ============================================================================
// Step Icons
// ============================================================================

const STEP_ICONS: Record<string, React.ElementType> = {
  'Import NAV-priser (CSV)': FileText,
  'Import NAV-detaljer (XLS)': FileSpreadsheet,
  'Import Sub/Red (XLS)': Upload,
  'Hämta FX-kurser (ECB)': BarChart3,
  'Beräkna NAV': Zap,
  'Compliance-check': Shield,
  'Skapa godkännandebegäran': Mail,
};

// ============================================================================
// Components
// ============================================================================

function StepCard({ step, index }: { step: PipelineStep; index: number }) {
  const Icon = STEP_ICONS[step.name] || Zap;

  const statusConfig = {
    pending: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-50', ring: 'ring-gray-200', label: 'Väntar' },
    running: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50', ring: 'ring-blue-200', label: 'Körs...' },
    completed: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', ring: 'ring-emerald-200', label: 'Klar' },
    failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', ring: 'ring-red-200', label: 'Misslyckades' },
    skipped: { icon: ChevronRight, color: 'text-gray-400', bg: 'bg-gray-50', ring: 'ring-gray-200', label: 'Överhoppad' },
  };

  const config = statusConfig[step.status];
  const StatusIcon = config.icon;

  return (
    <div className={`relative flex items-start gap-4 p-4 rounded-xl border transition-all ${
      step.status === 'running' ? 'bg-blue-50/50 border-blue-200 shadow-sm' :
      step.status === 'completed' ? 'bg-emerald-50/30 border-emerald-100' :
      step.status === 'failed' ? 'bg-red-50/30 border-red-100' :
      'bg-white border-gray-100'
    }`}>
      {/* Step number */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center ring-2 ${config.ring}`}>
        <StatusIcon className={`w-5 h-5 ${config.color} ${step.status === 'running' ? 'animate-spin' : ''}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-aifm-charcoal/50" />
            <h4 className="font-medium text-aifm-charcoal text-sm">{step.name}</h4>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.bg} ${config.color}`}>
            {config.label}
          </span>
        </div>
        {step.details && (
          <p className="text-xs text-aifm-charcoal/60 mt-1.5 whitespace-pre-line">{step.details}</p>
        )}
        {step.error && (
          <p className="text-xs text-red-600 mt-1.5 bg-red-50 rounded-lg p-2">{step.error}</p>
        )}
        {step.completedAt && (
          <p className="text-xs text-aifm-charcoal/40 mt-1">
            {new Date(step.completedAt).toLocaleTimeString('sv-SE')}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function PipelinePage() {
  const [navDate, setNavDate] = useState(new Date().toISOString().split('T')[0]);
  const [csvContent, setCsvContent] = useState('');
  const [pipelineSource, setPipelineSource] = useState<'auto' | 'isec' | 'csv'>('auto');
  const [isRunning, setIsRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<PipelineResponse | null>(null);
  const [currentRun, setCurrentRun] = useState<PipelineRun | null>(null);
  const [recentRuns, setRecentRuns] = useState<PipelineRun[]>([]);
  const [isecAvailable, setIsecAvailable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current pipeline status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/nav/pipeline?date=${navDate}`);
      if (res.ok) {
        const data = await res.json();
        if (data.steps) {
          setCurrentRun(data);
        }
      }
    } catch {
      // API might not be available yet
    }

    try {
      const recentRes = await fetch('/api/nav/pipeline?action=recent');
      if (recentRes.ok) {
        const data = await recentRes.json();
        if (data.runs) {
          setRecentRuns(data.runs);
        }
      }
    } catch {
      // Ignore
    }
  }, [navDate]);

  useEffect(() => {
    fetchStatus();
    fetch('/api/nav/status').then(r => r.json()).then(data => {
      if (data.status?.isec?.available) {
        setIsecAvailable(true);
      }
    }).catch(() => {});
  }, [fetchStatus]);

  // Handle CSV file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
    };
    reader.readAsText(file);
  };

  const runPipeline = async () => {
    setIsRunning(true);
    setPipelineResult(null);

    try {
      const res = await fetch('/api/nav/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          navDate,
          csvContent: csvContent || undefined,
          source: pipelineSource,
        }),
      });

      const data: PipelineResponse = await res.json();
      setPipelineResult(data);

      // Refresh status
      await fetchStatus();
    } catch (err) {
      setPipelineResult({
        success: false,
        navDate,
        status: 'failed',
        steps: [],
        error: err instanceof Error ? err.message : 'Nätverksfel',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const steps = pipelineResult?.steps || currentRun?.steps || [];
  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const totalSteps = steps.length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 -mx-6 -mt-6 px-6 py-4 mb-2">
        <div className="flex items-center gap-4">
          <Link
            href="/nav-admin"
            className="p-2 hover:bg-aifm-charcoal/[0.04] rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-aifm-charcoal/60" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Daglig NAV-pipeline</h1>
            <p className="text-sm text-aifm-charcoal/40">
              {isecAvailable
                ? 'Automatisk NAV-beräkning via ISEC SECURA med positioner, kassor och avgifter'
                : 'Automatisk import, beräkning och godkännande av NAV'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Controls */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        {/* Source selector */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs font-medium text-aifm-charcoal/60">Datakälla:</span>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setPipelineSource('auto')}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                pipelineSource === 'auto' ? 'bg-aifm-charcoal text-white' : 'bg-white text-aifm-charcoal/60 hover:bg-gray-50'
              }`}
            >
              Auto (ISEC → CSV)
            </button>
            <button
              onClick={() => setPipelineSource('isec')}
              className={`px-4 py-2 text-xs font-medium transition-colors border-l border-gray-200 ${
                pipelineSource === 'isec' ? 'bg-aifm-charcoal text-white' : 'bg-white text-aifm-charcoal/60 hover:bg-gray-50'
              }`}
            >
              ISEC SECURA
            </button>
            <button
              onClick={() => setPipelineSource('csv')}
              className={`px-4 py-2 text-xs font-medium transition-colors border-l border-gray-200 ${
                pipelineSource === 'csv' ? 'bg-aifm-charcoal text-white' : 'bg-white text-aifm-charcoal/60 hover:bg-gray-50'
              }`}
            >
              CSV-import
            </button>
          </div>
          {isecAvailable && (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              ISEC ansluten
            </span>
          )}
          {!isecAvailable && pipelineSource === 'isec' && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
              ISEC ej tillgänglig — VPN krävs
            </span>
          )}
        </div>

        <div className="flex items-start gap-6">
          {/* Date picker */}
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-aifm-charcoal/60 mb-1.5">NAV-datum</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/40" />
              <input
                type="date"
                value={navDate}
                onChange={(e) => setNavDate(e.target.value)}
                className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              />
            </div>
          </div>

          {/* CSV Upload (only when relevant) */}
          {pipelineSource !== 'isec' && (
            <div className="flex-1">
              <label className="block text-xs font-medium text-aifm-charcoal/60 mb-1.5">NAV-priser (CSV)</label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:border-aifm-gold/50 hover:bg-aifm-gold/5 transition-all"
                >
                  <Upload className="w-4 h-4 text-aifm-charcoal/50" />
                  <span className="text-aifm-charcoal/70">
                    {csvContent ? 'CSV laddad' : 'Ladda upp CSV'}
                  </span>
                </button>
                {csvContent && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {csvContent.split('\n').length - 1} rader
                  </span>
                )}
                <span className="text-xs text-aifm-charcoal/40">
                  Valfritt — kan även använda redan importerade priser
                </span>
              </div>
            </div>
          )}

          {pipelineSource === 'isec' && (
            <div className="flex-1">
              <label className="block text-xs font-medium text-aifm-charcoal/60 mb-1.5">ISEC SECURA</label>
              <p className="text-xs text-aifm-charcoal/50 mt-1">
                Positioner, kassor, FX-kurser och avgifter hämtas automatiskt från ISEC.
                NAV beräknas med den inbyggda NAV-motorn baserat på ISEC-data.
              </p>
            </div>
          )}

          {/* Run button */}
          <div className="flex-shrink-0 pt-5">
            <button
              onClick={runPipeline}
              disabled={isRunning}
              className="flex items-center gap-2 px-8 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kör pipeline...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>{pipelineSource === 'isec' ? 'Beräkna NAV via ISEC' : 'Kör daglig pipeline'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {steps.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-aifm-charcoal tracking-tight">Pipeline-status</h2>
            <div className="flex items-center gap-3">
              {pipelineResult?.approvalId && (
                <span className="text-xs bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full font-medium">
                  Väntar på godkännande
                </span>
              )}
              <span className="text-sm text-aifm-charcoal/50">
                {completedSteps}/{totalSteps} steg
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-100 rounded-full mb-6 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pipelineResult?.success === false ? 'bg-red-400' :
                progressPercent === 100 ? 'bg-emerald-400' :
                'bg-aifm-gold'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <StepCard key={idx} step={step} index={idx} />
            ))}
          </div>

          {/* Result message */}
          {pipelineResult?.message && (
            <div className={`mt-6 p-4 rounded-xl ${
              pipelineResult.success
                ? 'bg-emerald-50 border border-emerald-100'
                : 'bg-red-50 border border-red-100'
            }`}>
              <div className="flex items-start gap-3">
                {pipelineResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${pipelineResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                    {pipelineResult.message}
                  </p>
                  {pipelineResult.approvalId && (
                    <Link
                      href="/nav-admin"
                      className="inline-flex items-center gap-1 mt-2 text-sm text-aifm-gold hover:underline"
                    >
                      Gå till godkännande
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      {steps.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mx-auto w-16 h-16 bg-aifm-gold/10 rounded-2xl flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-aifm-gold" />
            </div>
            <h2 className="text-xl font-semibold text-aifm-charcoal mb-3">Automatisk NAV-process</h2>
            <p className="text-sm text-aifm-charcoal/50 mb-8">
              Pipelinen kör alla steg automatiskt. Det enda manuella steget är godkännandet.
            </p>

            <div className="grid grid-cols-7 gap-2 items-center text-center">
              {[
                { icon: FileText, label: 'CSV-priser' },
                { icon: ChevronRight, label: '' },
                { icon: Upload, label: 'Sub/Red' },
                { icon: ChevronRight, label: '' },
                { icon: Zap, label: 'NAV-beräkning' },
                { icon: ChevronRight, label: '' },
                { icon: Shield, label: 'Godkänn' },
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  {item.label ? (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-aifm-charcoal/[0.04] flex items-center justify-center mb-2">
                        <item.icon className="w-6 h-6 text-aifm-charcoal/60" />
                      </div>
                      <span className="text-xs text-aifm-charcoal/50">{item.label}</span>
                    </>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-aifm-charcoal/20" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-aifm-charcoal tracking-tight">Senaste körningar</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentRuns.slice(0, 5).map((run, idx) => (
              <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-aifm-charcoal/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    run.status === 'distributed' || run.status === 'approved' ? 'bg-emerald-400' :
                    run.status === 'pending_approval' ? 'bg-amber-400' :
                    run.status === 'failed' ? 'bg-red-400' :
                    'bg-gray-300'
                  }`} />
                  <span className="text-sm font-medium text-aifm-charcoal">{run.date}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-aifm-charcoal/50">
                    {run.steps?.filter((s) => s.status === 'completed').length || 0}/{run.steps?.length || 0} steg
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    run.status === 'distributed' ? 'bg-emerald-50 text-emerald-600' :
                    run.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                    run.status === 'pending_approval' ? 'bg-amber-50 text-amber-600' :
                    run.status === 'failed' ? 'bg-red-50 text-red-600' :
                    'bg-gray-50 text-gray-600'
                  }`}>
                    {run.status === 'distributed' ? 'Distribuerad' :
                     run.status === 'approved' ? 'Godkänd' :
                     run.status === 'pending_approval' ? 'Väntar godkännande' :
                     run.status === 'failed' ? 'Misslyckad' :
                     run.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
