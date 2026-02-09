'use client';

/**
 * ESG Dashboard Component
 *
 * Displays portfolio-level ESG data including:
 * - Weighted average E/S/G scores with bar charts
 * - Exclusion compliance summary
 * - Carbon intensity
 * - SFDR Article distribution
 * - Per-holding drill-down
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Leaf,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type { PortfolioESGSummary, HoldingESGResult } from '@/app/api/portfolio/esg/route';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ESGDashboardProps {
  fundId: string;
  /** Holdings with ISIN/ticker and portfolio weight */
  holdings: { identifier: string; name: string; weight: number }[];
  isDarkMode?: boolean;
}

// ---------------------------------------------------------------------------
// Score bar component
// ---------------------------------------------------------------------------

function ScoreBar({ label, score, maxScore = 100 }: { label: string; score: number | null; maxScore?: number }) {
  if (score === null) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="w-20 text-gray-500 dark:text-gray-400">{label}</span>
        <span className="text-gray-400 dark:text-gray-500 italic text-xs">Ej tillgänglig</span>
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const color =
    score >= 70
      ? 'bg-emerald-500'
      : score >= 50
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-20 text-gray-600 dark:text-gray-300 font-medium">{label}</span>
      <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right font-semibold text-gray-800 dark:text-gray-100">
        {score.toFixed(0)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function ExclusionBadge({ status }: { status: HoldingESGResult['exclusionStatus'] }) {
  switch (status) {
    case 'pass':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 size={12} /> OK
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <AlertTriangle size={12} /> Varning
        </span>
      );
    case 'fail':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <XCircle size={12} /> Exkluderad
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
          <HelpCircle size={12} /> Ingen data
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ESGDashboard({ fundId, holdings, isDarkMode }: ESGDashboardProps) {
  const [data, setData] = useState<PortfolioESGSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedHolding, setExpandedHolding] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!fundId || holdings.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portfolio/esg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId, holdings }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PortfolioESGSummary = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta ESG-data');
    } finally {
      setLoading(false);
    }
  }, [fundId, holdings]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Loading / Error ----
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500 dark:text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Hämtar ESG-data...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 text-center text-red-600 dark:text-red-400">
        <AlertTriangle className="mx-auto mb-2" size={24} />
        <p>{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 text-sm underline hover:no-underline"
        >
          Försök igen
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { exclusionSummary } = data;
  const totalHoldings = exclusionSummary.pass + exclusionSummary.warning + exclusionSummary.fail + exclusionSummary.noData;

  return (
    <div className={`space-y-6 ${isDarkMode ? 'dark' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Leaf className="text-emerald-600 dark:text-emerald-400" size={22} />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            ESG-översikt
          </h2>
          {data.provider && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              {data.provider}
            </span>
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 disabled:opacity-50"
          title="Uppdatera"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weighted scores */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Viktade ESG-scores
          </h3>
          <ScoreBar label="Total" score={data.weightedTotalScore} />
          <ScoreBar label="Miljö (E)" score={data.weightedEnvironmentScore} />
          <ScoreBar label="Socialt (S)" score={data.weightedSocialScore} />
          <ScoreBar label="Styrning (G)" score={data.weightedGovernanceScore} />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Datatäckning: {(data.dataCoverage * 100).toFixed(0)}% av portföljvikt
          </p>
        </div>

        {/* Exclusion summary */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Exkluderingsstatus
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                OK: {exclusionSummary.pass}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Varning: {exclusionSummary.warning}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Exkluderad: {exclusionSummary.fail}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Ingen data: {exclusionSummary.noData}
              </span>
            </div>
          </div>

          {/* Visual bar */}
          {totalHoldings > 0 && (
            <div className="h-4 flex rounded-full overflow-hidden mt-3">
              {exclusionSummary.pass > 0 && (
                <div
                  className="bg-emerald-500"
                  style={{ width: `${(exclusionSummary.pass / totalHoldings) * 100}%` }}
                />
              )}
              {exclusionSummary.warning > 0 && (
                <div
                  className="bg-amber-500"
                  style={{ width: `${(exclusionSummary.warning / totalHoldings) * 100}%` }}
                />
              )}
              {exclusionSummary.fail > 0 && (
                <div
                  className="bg-red-500"
                  style={{ width: `${(exclusionSummary.fail / totalHoldings) * 100}%` }}
                />
              )}
              {exclusionSummary.noData > 0 && (
                <div
                  className="bg-gray-300 dark:bg-gray-600"
                  style={{ width: `${(exclusionSummary.noData / totalHoldings) * 100}%` }}
                />
              )}
            </div>
          )}

          {/* Carbon & SFDR */}
          <div className="mt-4 space-y-1 text-sm text-gray-600 dark:text-gray-300">
            {data.weightedCarbonIntensity !== null && (
              <p>
                Koldioxidintensitet:{' '}
                <span className="font-medium">{data.weightedCarbonIntensity.toFixed(1)} tCO2e/MEUR</span>
              </p>
            )}
            {Object.keys(data.sfdrDistribution).length > 0 && (
              <p>
                SFDR-fördelning:{' '}
                {Object.entries(data.sfdrDistribution)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Holdings table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Innehav ({data.holdings.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {data.holdings.map((h) => {
            const isExpanded = expandedHolding === h.identifier;
            return (
              <div key={h.identifier}>
                <button
                  onClick={() => setExpandedHolding(isExpanded ? null : h.identifier)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                  )}
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {h.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right">
                    {(h.weight * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                    {h.esg?.totalScore !== null && h.esg?.totalScore !== undefined
                      ? h.esg.totalScore.toFixed(0)
                      : '-'}
                  </span>
                  <ExclusionBadge status={h.exclusionStatus} />
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 pl-12 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    {h.esg ? (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <span className="text-gray-400 text-xs">Miljö</span>
                            <p className="font-medium">
                              {h.esg.environmentScore !== null ? h.esg.environmentScore.toFixed(1) : '-'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Socialt</span>
                            <p className="font-medium">
                              {h.esg.socialScore !== null ? h.esg.socialScore.toFixed(1) : '-'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Styrning</span>
                            <p className="font-medium">
                              {h.esg.governanceScore !== null ? h.esg.governanceScore.toFixed(1) : '-'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Kontrovers</span>
                            <p className="font-medium">
                              {h.esg.controversyLevel !== null ? `${h.esg.controversyLevel}/5` : '-'}
                            </p>
                          </div>
                        </div>
                        {h.exclusionNotes.length > 0 && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            {h.exclusionNotes.join(', ')}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          Källa: {h.esg.provider} | {h.esg.fetchedAt.split('T')[0]}
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-400 italic">Ingen ESG-data tillgänglig</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
