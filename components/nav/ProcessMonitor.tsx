'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2, Clock, AlertCircle, RefreshCw, Play, Pause,
  ChevronDown, ChevronUp, Calendar, Timer, Zap, Settings,
  Database, Mail, FileText, Users, TrendingUp, Activity
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ProcessJob {
  id: string;
  name: string;
  description: string;
  jobType: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'waiting';
  enabled: boolean;
  scheduledTime: string;
  lastRun?: string;
  lastRunDuration?: string;
  nextRun?: string;
  error?: string;
  savedTime?: string;
}

interface ProcessMonitorProps {
  jobs?: ProcessJob[];
  onRunJob?: (jobId: string) => Promise<void>;
  onToggleJob?: (jobId: string, enabled: boolean) => Promise<void>;
  onRefresh?: () => Promise<void>;
  compactMode?: boolean;
}

// ============================================================================
// Default Jobs (Mock data - replace with API call)
// ============================================================================

const DEFAULT_JOBS: ProcessJob[] = [
  {
    id: 'data-fetch',
    name: 'Hämta NAV-data',
    description: 'Hämtar data från LSEG, SEB och Fund Registry',
    jobType: 'DATA_FETCH',
    status: 'completed',
    enabled: true,
    scheduledTime: '06:00',
    lastRun: '2025-01-25 06:00:12',
    lastRunDuration: '45s',
    nextRun: '2025-01-27 06:00',
    savedTime: '15 min',
  },
  {
    id: 'notor',
    name: 'Notor utskick',
    description: 'Gårdagens in/utflöden per fond',
    jobType: 'NOTOR',
    status: 'completed',
    enabled: true,
    scheduledTime: '07:00',
    lastRun: '2025-01-25 07:00:05',
    lastRunDuration: '32s',
    nextRun: '2025-01-27 07:00',
    savedTime: '20 min',
  },
  {
    id: 'nav-approval',
    name: 'NAV Godkännande',
    description: 'Väntar på manuellt godkännande',
    jobType: 'APPROVAL',
    status: 'waiting',
    enabled: true,
    scheduledTime: '08:00',
    savedTime: '5 min',
  },
  {
    id: 'nav-reports',
    name: 'NAV-rapporter',
    description: 'Skickar NAV-rapporter efter godkännande',
    jobType: 'NAV_REPORTS',
    status: 'idle',
    enabled: true,
    scheduledTime: '08:30',
    nextRun: '2025-01-27 08:30',
    savedTime: '45 min',
  },
  {
    id: 'price-data',
    name: 'Prisdata',
    description: 'Skickar till institut & uppdaterar hemsidan',
    jobType: 'PRICE_DATA',
    status: 'completed',
    enabled: true,
    scheduledTime: '09:00',
    lastRun: '2025-01-25 09:00:08',
    lastRunDuration: '28s',
    nextRun: '2025-01-27 09:00',
    savedTime: '15 min',
  },
  {
    id: 'owner-data',
    name: 'Ägardata',
    description: 'Clearstream och övriga kunder',
    jobType: 'OWNER_DATA',
    status: 'completed',
    enabled: true,
    scheduledTime: '09:15',
    lastRun: '2025-01-25 09:15:03',
    lastRunDuration: '18s',
    nextRun: '2025-01-27 09:15',
    savedTime: '15 min',
  },
  {
    id: 'subred',
    name: 'SubReds',
    description: 'Dagens in/utflöden & kontoutdrag',
    jobType: 'SUBRED',
    status: 'idle',
    enabled: true,
    scheduledTime: '15:00',
    nextRun: '2025-01-27 15:00',
    savedTime: '25 min',
  },
];

// ============================================================================
// Helpers
// ============================================================================

function getJobIcon(jobType: string) {
  switch (jobType) {
    case 'DATA_FETCH': return Database;
    case 'NOTOR': return Activity;
    case 'APPROVAL': return CheckCircle2;
    case 'NAV_REPORTS': return FileText;
    case 'PRICE_DATA': return TrendingUp;
    case 'OWNER_DATA': return Users;
    case 'SUBRED': return Mail;
    default: return Zap;
  }
}

function getStatusConfig(status: ProcessJob['status']) {
  switch (status) {
    case 'completed':
      return { 
        icon: CheckCircle2, 
        color: 'text-emerald-600', 
        bg: 'bg-emerald-50', 
        label: 'Klar',
        pulse: false,
      };
    case 'running':
      return { 
        icon: RefreshCw, 
        color: 'text-blue-600', 
        bg: 'bg-blue-50', 
        label: 'Körs',
        pulse: true,
      };
    case 'waiting':
      return { 
        icon: Clock, 
        color: 'text-amber-600', 
        bg: 'bg-amber-50', 
        label: 'Väntar',
        pulse: true,
      };
    case 'failed':
      return { 
        icon: AlertCircle, 
        color: 'text-red-600', 
        bg: 'bg-red-50', 
        label: 'Fel',
        pulse: false,
      };
    case 'idle':
    default:
      return { 
        icon: Clock, 
        color: 'text-gray-400', 
        bg: 'bg-gray-50', 
        label: 'Schemalagd',
        pulse: false,
      };
  }
}

// ============================================================================
// Components
// ============================================================================

function JobCard({ 
  job, 
  expanded, 
  onToggleExpand,
  onRun,
  onToggle,
}: { 
  job: ProcessJob;
  expanded: boolean;
  onToggleExpand: () => void;
  onRun: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const statusConfig = getStatusConfig(job.status);
  const StatusIcon = statusConfig.icon;
  const JobIcon = getJobIcon(job.jobType);

  return (
    <div className={`
      border rounded-xl overflow-hidden transition-all
      ${job.status === 'waiting' ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-white'}
      ${job.status === 'failed' ? 'border-red-200 bg-red-50/30' : ''}
    `}>
      {/* Main row */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${statusConfig.bg}`}>
            <JobIcon className={`w-4 h-4 ${statusConfig.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-aifm-charcoal">{job.name}</span>
              <span className="text-xs text-aifm-charcoal/50">kl {job.scheduledTime}</span>
            </div>
            <p className="text-xs text-aifm-charcoal/60 mt-0.5">{job.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {job.savedTime && (
            <span className="hidden sm:flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <Timer className="w-3 h-3" />
              {job.savedTime}
            </span>
          )}
          
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusConfig.bg}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${statusConfig.color} ${statusConfig.pulse ? 'animate-pulse' : ''} ${job.status === 'running' ? 'animate-spin' : ''}`} />
            <span className={`text-xs font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>

          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-aifm-charcoal/40" />
            ) : (
              <ChevronDown className="w-4 h-4 text-aifm-charcoal/40" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {job.lastRun && (
              <div>
                <p className="text-xs text-aifm-charcoal/50 mb-1">Senaste körning</p>
                <p className="text-sm font-medium text-aifm-charcoal">{job.lastRun}</p>
              </div>
            )}
            {job.lastRunDuration && (
              <div>
                <p className="text-xs text-aifm-charcoal/50 mb-1">Körtid</p>
                <p className="text-sm font-medium text-aifm-charcoal">{job.lastRunDuration}</p>
              </div>
            )}
            {job.nextRun && (
              <div>
                <p className="text-xs text-aifm-charcoal/50 mb-1">Nästa körning</p>
                <p className="text-sm font-medium text-aifm-charcoal">{job.nextRun}</p>
              </div>
            )}
            {job.error && (
              <div className="col-span-2 md:col-span-4">
                <p className="text-xs text-red-600 mb-1">Felmeddelande</p>
                <p className="text-sm text-red-700 bg-red-50 p-2 rounded">{job.error}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={job.enabled}
                onChange={(e) => onToggle(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold/20"
              />
              <span className="text-sm text-aifm-charcoal/70">Aktiverad</span>
            </label>

            <div className="flex items-center gap-2">
              {job.status === 'failed' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRun(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Kör om
                </button>
              )}
              {(job.status === 'idle' || job.status === 'completed') && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRun(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-aifm-charcoal text-white rounded-lg hover:bg-aifm-charcoal/90 transition-colors text-sm font-medium"
                >
                  <Play className="w-3.5 h-3.5" />
                  Kör manuellt
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProcessMonitor({
  jobs = DEFAULT_JOBS,
  onRunJob,
  onToggleJob,
  onRefresh,
  compactMode = false,
}: ProcessMonitorProps) {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleRunJob = async (jobId: string) => {
    try {
      await onRunJob?.(jobId);
    } catch (error) {
      console.error('Failed to run job:', error);
    }
  };

  const handleToggleJob = async (jobId: string, enabled: boolean) => {
    try {
      await onToggleJob?.(jobId, enabled);
    } catch (error) {
      console.error('Failed to toggle job:', error);
    }
  };

  // Calculate stats
  const completedToday = jobs.filter(j => j.status === 'completed').length;
  const waiting = jobs.filter(j => j.status === 'waiting').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  const totalSavedTime = jobs.reduce((sum, j) => {
    if (j.savedTime && j.status === 'completed') {
      const minutes = parseInt(j.savedTime);
      return sum + (isNaN(minutes) ? 0 : minutes);
    }
    return sum;
  }, 0);

  if (compactMode) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-aifm-charcoal">Processstatus</h3>
          <button
            onClick={handleRefresh}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-aifm-charcoal/50 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <div className="space-y-2">
          {jobs.slice(0, 5).map((job) => {
            const config = getStatusConfig(job.status);
            const Icon = config.icon;
            return (
              <div key={job.id} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-aifm-charcoal/70">{job.name}</span>
                <div className={`flex items-center gap-1 ${config.color}`}>
                  <Icon className={`w-3.5 h-3.5 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                  <span className="text-xs font-medium">{config.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-aifm-charcoal">Processstatus</h2>
          <p className="text-sm text-aifm-charcoal/60 mt-0.5">
            Övervakning av automatiserade NAV-processer
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-aifm-charcoal/70">{completedToday} klara</span>
            </div>
            {waiting > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-aifm-charcoal/70">{waiting} väntar</span>
              </div>
            )}
            {failed > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-red-600 font-medium">{failed} fel</span>
              </div>
            )}
            {totalSavedTime > 0 && (
              <div className="flex items-center gap-1.5 text-emerald-600">
                <Timer className="w-4 h-4" />
                <span className="font-medium">~{totalSavedTime} min sparad</span>
              </div>
            )}
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-aifm-charcoal/60 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm text-aifm-charcoal/70">Uppdatera</span>
          </button>
        </div>
      </div>

      {/* Timeline visualization */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-aifm-charcoal/40" />
          <span className="text-sm font-medium text-aifm-charcoal/70">Dagligt schema</span>
        </div>
        <div className="relative">
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200" />
          <div className="flex justify-between relative">
            {jobs.map((job) => {
              const config = getStatusConfig(job.status);
              return (
                <div key={job.id} className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full ${config.bg} flex items-center justify-center z-10 border-2 border-white`}>
                    <div className={`w-2 h-2 rounded-full ${job.status === 'completed' ? 'bg-emerald-500' : job.status === 'waiting' ? 'bg-amber-500 animate-pulse' : job.status === 'failed' ? 'bg-red-500' : 'bg-gray-300'}`} />
                  </div>
                  <span className="text-xs text-aifm-charcoal/50 mt-1">{job.scheduledTime}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Job list */}
      <div className="space-y-3">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            expanded={expandedJob === job.id}
            onToggleExpand={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
            onRun={() => handleRunJob(job.id)}
            onToggle={(enabled) => handleToggleJob(job.id, enabled)}
          />
        ))}
      </div>
    </div>
  );
}

export default ProcessMonitor;
