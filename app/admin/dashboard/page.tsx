'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Database,
  Server,
  Cloud,
  Shield,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Link2,
  Zap,
  HardDrive,
  Cpu,
  BarChart3,
  TrendingUp,
  Rocket,
  CircleDashed,
  UserCheck,
  UserX,
  Mail,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

interface ServiceHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  lastCheck: string;
  details?: string;
}

interface SystemMetrics {
  activeUsers: number;
  activeUsersTrend: 'up' | 'down' | 'stable';
  documentsProcessed: number;
  documentsProcessedTrend: 'up' | 'down' | 'stable';
  apiRequests: number;
  apiRequestsTrend: 'up' | 'down' | 'stable';
  errorRate: number;
  errorRateTrend: 'up' | 'down' | 'stable';
}

interface RecentActivity {
  id: string;
  type: 'user_login' | 'document_upload' | 'integration_error' | 'system_alert' | 'policy_change';
  message: string;
  timestamp: string;
  severity?: 'info' | 'warning' | 'error';
}

interface UserOnboardingStatus {
  userId: string;
  email: string;
  name?: string;
  status: 'not_started' | 'in_progress' | 'completed';
  completedTasks: number;
  totalTasks: number;
  completionPercentage: number;
  startedAt?: string;
  completedAt?: string;
  lastActivity?: string;
  createdAt?: string;
}

interface OnboardingStats {
  totalUsers: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  averageCompletion: number;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockServices: ServiceHealth[] = [
  { name: 'API Gateway', status: 'healthy', latency: 45, lastCheck: new Date().toISOString() },
  { name: 'Database (Aurora)', status: 'healthy', latency: 12, lastCheck: new Date().toISOString() },
  { name: 'Authentication (Cognito)', status: 'healthy', latency: 89, lastCheck: new Date().toISOString() },
  { name: 'Storage (S3)', status: 'healthy', latency: 23, lastCheck: new Date().toISOString() },
  { name: 'Knowledge Base (Bedrock)', status: 'healthy', latency: 156, lastCheck: new Date().toISOString() },
  { name: 'Fortnox Integration', status: 'degraded', latency: 890, lastCheck: new Date().toISOString(), details: 'Hög latens' },
];

const mockMetrics: SystemMetrics = {
  activeUsers: 127,
  activeUsersTrend: 'up',
  documentsProcessed: 1843,
  documentsProcessedTrend: 'up',
  apiRequests: 45892,
  apiRequestsTrend: 'stable',
  errorRate: 0.12,
  errorRateTrend: 'down',
};

const mockActivities: RecentActivity[] = [
  { id: '1', type: 'user_login', message: 'admin@aifm.se loggade in', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), severity: 'info' },
  { id: '2', type: 'document_upload', message: '15 dokument processades framgångsrikt', timestamp: new Date(Date.now() - 15 * 60000).toISOString(), severity: 'info' },
  { id: '3', type: 'integration_error', message: 'Fortnox sync misslyckades för Nordic Fund', timestamp: new Date(Date.now() - 30 * 60000).toISOString(), severity: 'error' },
  { id: '4', type: 'system_alert', message: 'Hög CPU-användning detekterad', timestamp: new Date(Date.now() - 45 * 60000).toISOString(), severity: 'warning' },
  { id: '5', type: 'policy_change', message: 'Auto-approval policy uppdaterad', timestamp: new Date(Date.now() - 60 * 60000).toISOString(), severity: 'info' },
];

// ============================================================================
// Helper Components
// ============================================================================

function StatusBadge({ status }: { status: HealthStatus }) {
  const config = {
    healthy: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Healthy' },
    degraded: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle, label: 'Degraded' },
    unhealthy: { color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle, label: 'Unhealthy' },
    unknown: { color: 'bg-gray-50 text-gray-600 border-gray-200', icon: Clock, label: 'Unknown' },
  };

  const { color, icon: Icon, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function TrendIndicator({ trend, value }: { trend: 'up' | 'down' | 'stable'; value?: string }) {
  if (trend === 'up') {
    return (
      <span className="flex items-center gap-0.5 text-emerald-600 text-xs">
        <ArrowUpRight className="w-3.5 h-3.5" />
        {value}
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="flex items-center gap-0.5 text-red-600 text-xs">
        <ArrowDownRight className="w-3.5 h-3.5" />
        {value}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-gray-500 text-xs">
      <Minus className="w-3.5 h-3.5" />
      Stable
    </span>
  );
}

function MetricCard({
  title,
  value,
  trend,
  trendValue,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string | number;
  trend: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon: React.ElementType;
  subtitle?: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:shadow-gray-100/50 transition-all">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
          <Icon className="w-5 h-5 text-aifm-charcoal/70" />
        </div>
        <TrendIndicator trend={trend} value={trendValue} />
      </div>
      <p className="text-2xl font-semibold text-aifm-charcoal mt-3">{value}</p>
      <p className="text-xs text-aifm-charcoal/50 mt-1">{title}</p>
      {subtitle && <p className="text-xs text-aifm-charcoal/30 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Just nu';
  if (minutes < 60) return `${minutes} min sedan`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} tim sedan`;
  return date.toLocaleDateString('sv-SE');
}

function ActivityIcon({ type }: { type: RecentActivity['type'] }) {
  const icons = {
    user_login: Users,
    document_upload: FileText,
    integration_error: Link2,
    system_alert: AlertTriangle,
    policy_change: Shield,
  };
  const Icon = icons[type];
  return <Icon className="w-4 h-4" />;
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminDashboardPage() {
  const [services, setServices] = useState<ServiceHealth[]>(mockServices);
  const [metrics, setMetrics] = useState<SystemMetrics>(mockMetrics);
  const [activities, setActivities] = useState<RecentActivity[]>(mockActivities);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [onboardingUsers, setOnboardingUsers] = useState<UserOnboardingStatus[]>([]);
  const [onboardingStats, setOnboardingStats] = useState<OnboardingStats | null>(null);

  // Fetch real health data
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/accounting/ops/health', { cache: 'no-store' });
        const data = await res.json();
        if (data.ok) {
          setServices((prev) =>
            prev.map((s) => (s.name === 'API Gateway' ? { ...s, status: 'healthy' } : s))
          );
        }
      } catch {
        setServices((prev) =>
          prev.map((s) => (s.name === 'API Gateway' ? { ...s, status: 'unhealthy' } : s))
        );
      }
    };
    fetchHealth();
  }, []);

  // Fetch onboarding status
  useEffect(() => {
    const fetchOnboarding = async () => {
      try {
        const res = await fetch('/api/admin/onboarding', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setOnboardingUsers(data.users || []);
          setOnboardingStats(data.stats || null);
        }
      } catch (error) {
        console.error('Failed to fetch onboarding data:', error);
      }
    };
    fetchOnboarding();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLastRefresh(new Date());
    setIsRefreshing(false);
  };

  const overallStatus: HealthStatus = services.some((s) => s.status === 'unhealthy')
    ? 'unhealthy'
    : services.some((s) => s.status === 'degraded')
      ? 'degraded'
      : 'healthy';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-aifm-charcoal">Admin Dashboard</h1>
          <p className="text-sm text-aifm-charcoal/50 mt-1">
            Systemöversikt och hälsostatus för AIFM-plattformen.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={overallStatus} />
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                       hover:bg-aifm-charcoal/90 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Uppdatera
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Aktiva användare"
          value={metrics.activeUsers}
          trend={metrics.activeUsersTrend}
          trendValue="+12%"
          icon={Users}
          subtitle="Senaste 24h"
        />
        <MetricCard
          title="Dokument processade"
          value={metrics.documentsProcessed.toLocaleString('sv-SE')}
          trend={metrics.documentsProcessedTrend}
          trendValue="+8%"
          icon={FileText}
          subtitle="Denna vecka"
        />
        <MetricCard
          title="API-anrop"
          value={metrics.apiRequests.toLocaleString('sv-SE')}
          trend={metrics.apiRequestsTrend}
          icon={Zap}
          subtitle="Senaste 24h"
        />
        <MetricCard
          title="Felfrekvens"
          value={`${metrics.errorRate}%`}
          trend={metrics.errorRateTrend}
          trendValue="-0.05%"
          icon={AlertTriangle}
          subtitle="Senaste timmen"
        />
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Health */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                Tjänstestatus
              </p>
              <p className="text-xs text-aifm-charcoal/50 mt-0.5">
                Senast uppdaterad: {formatTimestamp(lastRefresh.toISOString())}
              </p>
            </div>
            <Link
              href="/admin/integrations"
              className="text-xs text-aifm-gold hover:underline flex items-center gap-1"
            >
              Visa integrationer
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      service.status === 'healthy'
                        ? 'bg-emerald-500'
                        : service.status === 'degraded'
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-aifm-charcoal">{service.name}</p>
                    {service.details && (
                      <p className="text-xs text-aifm-charcoal/50">{service.details}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {service.latency && (
                    <span className="text-xs text-aifm-charcoal/50">{service.latency}ms</span>
                  )}
                  <StatusBadge status={service.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
              Senaste aktivitet
            </p>
            <Link
              href="/audit/logs"
              className="text-xs text-aifm-gold hover:underline flex items-center gap-1"
            >
              Alla loggar
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    activity.severity === 'error'
                      ? 'bg-red-50 text-red-600'
                      : activity.severity === 'warning'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-gray-100 text-aifm-charcoal/50'
                  }`}
                >
                  <ActivityIcon type={activity.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-aifm-charcoal line-clamp-2">{activity.message}</p>
                  <p className="text-xs text-aifm-charcoal/40 mt-0.5">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Onboarding Status Section */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-aifm-gold" />
              <p className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                Onboarding-status
              </p>
            </div>
            <p className="text-xs text-aifm-charcoal/50 mt-1">
              Följ användarnas framsteg i onboarding-processen
            </p>
          </div>
          <Link
            href="/admin/users"
            className="text-xs text-aifm-gold hover:underline flex items-center gap-1"
          >
            Hantera användare
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Stats Cards */}
        {onboardingStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500">Totalt</span>
              </div>
              <p className="text-xl font-semibold text-aifm-charcoal">{onboardingStats.totalUsers}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <CircleDashed className="w-4 h-4 text-amber-600" />
                <span className="text-xs text-amber-600">Pågående</span>
              </div>
              <p className="text-xl font-semibold text-amber-700">{onboardingStats.inProgress}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <UserX className="w-4 h-4 text-red-500" />
                <span className="text-xs text-red-500">Ej startat</span>
              </div>
              <p className="text-xl font-semibold text-red-600">{onboardingStats.notStarted}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs text-emerald-600">Klara</span>
              </div>
              <p className="text-xl font-semibold text-emerald-700">{onboardingStats.completed}</p>
            </div>
          </div>
        )}

        {/* User List */}
        <div className="space-y-2">
          {onboardingUsers.slice(0, 6).map((user) => (
            <div
              key={user.userId}
              className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${
                  user.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : user.status === 'in_progress'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-aifm-charcoal">
                    {user.name || user.email.split('@')[0]}
                  </p>
                  <p className="text-xs text-aifm-charcoal/50">{user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Progress bar */}
                <div className="hidden sm:flex items-center gap-2 w-32">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        user.status === 'completed'
                          ? 'bg-emerald-500'
                          : user.status === 'in_progress'
                          ? 'bg-amber-500'
                          : 'bg-gray-300'
                      }`}
                      style={{ width: `${user.completionPercentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-aifm-charcoal/50 w-8">
                    {user.completionPercentage}%
                  </span>
                </div>

                {/* Status badge */}
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  user.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700'
                    : user.status === 'in_progress'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {user.status === 'completed' ? 'Klar' : 
                   user.status === 'in_progress' ? 'Pågående' : 'Ej startat'}
                </span>

                {/* Send reminder button */}
                {user.status !== 'completed' && (
                  <button
                    onClick={() => {/* TODO: Send reminder */}}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Skicka påminnelse"
                  >
                    <Mail className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {onboardingUsers.length > 6 && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <Link
              href="/admin/users"
              className="text-sm text-aifm-gold hover:underline"
            >
              Visa alla {onboardingUsers.length} användare
            </Link>
          </div>
        )}

        {onboardingUsers.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Inga användare hittades</p>
            <Link
              href="/admin/users"
              className="text-xs text-aifm-gold hover:underline mt-2 inline-block"
            >
              Bjud in användare
            </Link>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/admin/integrations"
          className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:shadow-gray-100/50 hover:border-aifm-gold/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-aifm-gold/10 transition-colors">
            <Link2 className="w-5 h-5 text-aifm-charcoal/70 group-hover:text-aifm-gold transition-colors" />
          </div>
          <p className="text-sm font-medium text-aifm-charcoal mt-3">Integrationer</p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">Hantera alla bolagsintegrationer</p>
        </Link>

        <Link
          href="/admin/documents"
          className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:shadow-gray-100/50 hover:border-aifm-gold/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-aifm-gold/10 transition-colors">
            <FileText className="w-5 h-5 text-aifm-charcoal/70 group-hover:text-aifm-gold transition-colors" />
          </div>
          <p className="text-sm font-medium text-aifm-charcoal mt-3">Dokument</p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">Compliance-dokument & KB</p>
        </Link>

        <Link
          href="/admin/policies"
          className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:shadow-gray-100/50 hover:border-aifm-gold/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-aifm-gold/10 transition-colors">
            <Shield className="w-5 h-5 text-aifm-charcoal/70 group-hover:text-aifm-gold transition-colors" />
          </div>
          <p className="text-sm font-medium text-aifm-charcoal mt-3">Policies</p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">Auto-godkännande & regler</p>
        </Link>

        <Link
          href="/audit/logs"
          className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:shadow-gray-100/50 hover:border-aifm-gold/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-aifm-gold/10 transition-colors">
            <BarChart3 className="w-5 h-5 text-aifm-charcoal/70 group-hover:text-aifm-gold transition-colors" />
          </div>
          <p className="text-sm font-medium text-aifm-charcoal mt-3">Audit Logs</p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">Granska händelser & åtkomst</p>
        </Link>
      </div>
    </div>
  );
}
