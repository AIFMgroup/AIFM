'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Link2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Building2,
  Search,
  Filter,
  ChevronDown,
  ExternalLink,
  RotateCcw,
  Trash2,
  FileSpreadsheet,
  Mail,
  PenTool,
  Landmark,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type IntegrationStatus = 'connected' | 'not_connected' | 'expired' | 'revoked' | 'error';

interface CompanyIntegration {
  companyId: string;
  companyName: string;
  integrationType: string;
  integrationName: string;
  status: IntegrationStatus;
  externalName?: string;
  externalId?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  lastError?: string;
  tokenExpiresSoon?: boolean;
}

interface IntegrationSummary {
  type: string;
  name: string;
  icon: string;
  totalConnected: number;
  totalError: number;
  totalExpired: number;
}

// ============================================================================
// Mock Data (replace with API calls)
// ============================================================================

const mockCompanies = [
  { id: 'company-1', name: 'AIFM Kapital AB' },
  { id: 'company-2', name: 'Nordic Fund Management' },
  { id: 'company-3', name: 'Swedish Venture Partners' },
  { id: 'company-4', name: 'Baltic Investment Group' },
];

const mockIntegrations: CompanyIntegration[] = [
  {
    companyId: 'company-1',
    companyName: 'AIFM Kapital AB',
    integrationType: 'fortnox',
    integrationName: 'Fortnox',
    status: 'connected',
    externalName: 'AIFM Kapital AB',
    externalId: '556789-0123',
    connectedAt: '2024-01-15T10:30:00Z',
    lastSyncAt: '2024-01-08T14:22:00Z',
  },
  {
    companyId: 'company-1',
    companyName: 'AIFM Kapital AB',
    integrationType: 'microsoft',
    integrationName: 'Microsoft 365',
    status: 'connected',
    externalName: 'admin@aifmkapital.se',
    connectedAt: '2024-01-10T09:00:00Z',
    lastSyncAt: '2024-01-08T14:00:00Z',
    tokenExpiresSoon: true,
  },
  {
    companyId: 'company-2',
    companyName: 'Nordic Fund Management',
    integrationType: 'fortnox',
    integrationName: 'Fortnox',
    status: 'error',
    externalName: 'Nordic Fund Management AB',
    connectedAt: '2024-01-05T11:00:00Z',
    lastError: 'API rate limit exceeded',
  },
  {
    companyId: 'company-2',
    companyName: 'Nordic Fund Management',
    integrationType: 'scrive',
    integrationName: 'Scrive',
    status: 'connected',
    externalName: 'Nordic Fund Signing',
    connectedAt: '2024-01-12T15:30:00Z',
  },
  {
    companyId: 'company-3',
    companyName: 'Swedish Venture Partners',
    integrationType: 'fortnox',
    integrationName: 'Fortnox',
    status: 'expired',
    externalName: 'SVP Accounting',
    connectedAt: '2023-12-01T10:00:00Z',
    lastError: 'Token expired - needs re-authentication',
  },
  {
    companyId: 'company-4',
    companyName: 'Baltic Investment Group',
    integrationType: 'tink',
    integrationName: 'Tink',
    status: 'connected',
    externalName: 'BIG Main Account',
    connectedAt: '2024-01-08T08:00:00Z',
    lastSyncAt: '2024-01-08T14:30:00Z',
  },
];

// ============================================================================
// Helper Components
// ============================================================================

const integrationIcons: Record<string, React.ElementType> = {
  fortnox: FileSpreadsheet,
  microsoft: Mail,
  scrive: PenTool,
  tink: Landmark,
};

function getStatusColor(status: IntegrationStatus) {
  switch (status) {
    case 'connected':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'error':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'expired':
    case 'revoked':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

function getStatusIcon(status: IntegrationStatus) {
  switch (status) {
    case 'connected':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'error':
      return <XCircle className="w-4 h-4" />;
    case 'expired':
    case 'revoked':
      return <AlertCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
}

function getStatusLabel(status: IntegrationStatus) {
  switch (status) {
    case 'connected':
      return 'Ansluten';
    case 'error':
      return 'Fel';
    case 'expired':
      return 'Utgången';
    case 'revoked':
      return 'Återkallad';
    default:
      return 'Ej ansluten';
  }
}

function formatDate(dateString?: string) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminIntegrationsPage() {
  const [integrations, setIntegrations] = useState<CompanyIntegration[]>(mockIntegrations);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IntegrationStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Calculate summaries
  const summaries: IntegrationSummary[] = [
    {
      type: 'fortnox',
      name: 'Fortnox',
      icon: 'FileSpreadsheet',
      totalConnected: integrations.filter((i) => i.integrationType === 'fortnox' && i.status === 'connected').length,
      totalError: integrations.filter((i) => i.integrationType === 'fortnox' && i.status === 'error').length,
      totalExpired: integrations.filter((i) => i.integrationType === 'fortnox' && (i.status === 'expired' || i.status === 'revoked')).length,
    },
    {
      type: 'microsoft',
      name: 'Microsoft 365',
      icon: 'Mail',
      totalConnected: integrations.filter((i) => i.integrationType === 'microsoft' && i.status === 'connected').length,
      totalError: integrations.filter((i) => i.integrationType === 'microsoft' && i.status === 'error').length,
      totalExpired: integrations.filter((i) => i.integrationType === 'microsoft' && (i.status === 'expired' || i.status === 'revoked')).length,
    },
    {
      type: 'scrive',
      name: 'Scrive',
      icon: 'PenTool',
      totalConnected: integrations.filter((i) => i.integrationType === 'scrive' && i.status === 'connected').length,
      totalError: integrations.filter((i) => i.integrationType === 'scrive' && i.status === 'error').length,
      totalExpired: integrations.filter((i) => i.integrationType === 'scrive' && (i.status === 'expired' || i.status === 'revoked')).length,
    },
    {
      type: 'tink',
      name: 'Tink',
      icon: 'Landmark',
      totalConnected: integrations.filter((i) => i.integrationType === 'tink' && i.status === 'connected').length,
      totalError: integrations.filter((i) => i.integrationType === 'tink' && i.status === 'error').length,
      totalExpired: integrations.filter((i) => i.integrationType === 'tink' && (i.status === 'expired' || i.status === 'revoked')).length,
    },
  ];

  // Filter integrations
  const filteredIntegrations = integrations.filter((integration) => {
    const matchesSearch =
      searchQuery === '' ||
      integration.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.integrationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.externalName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || integration.status === statusFilter;
    const matchesType = typeFilter === 'all' || integration.integrationType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const handleRefresh = async () => {
    setIsLoading(true);
    // TODO: Fetch from API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  const handleReconnect = async (companyId: string, integrationType: string) => {
    // TODO: Redirect to OAuth flow
    console.log('Reconnect', companyId, integrationType);
  };

  const handleDisconnect = async (companyId: string, integrationType: string) => {
    if (!confirm('Är du säker på att du vill koppla bort denna integration?')) return;
    // TODO: Call API to disconnect
    setIntegrations((prev) =>
      prev.filter((i) => !(i.companyId === companyId && i.integrationType === integrationType))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-aifm-charcoal">Integrationer</h1>
          <p className="text-sm text-aifm-charcoal/50 mt-1">
            Övervaka och hantera alla integrationer för samtliga bolag.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                     hover:bg-aifm-charcoal/90 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Uppdatera
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaries.map((summary) => {
          const Icon = integrationIcons[summary.type] || Link2;
          const total = summary.totalConnected + summary.totalError + summary.totalExpired;
          return (
            <div
              key={summary.type}
              className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:shadow-gray-100/50 transition-all cursor-pointer"
              onClick={() => setTypeFilter(typeFilter === summary.type ? 'all' : summary.type)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-aifm-charcoal/70" />
                </div>
                {typeFilter === summary.type && (
                  <span className="px-2 py-0.5 bg-aifm-gold/10 text-aifm-gold text-xs rounded-full font-medium">
                    Filtrerad
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-aifm-charcoal">{summary.name}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-emerald-600">{summary.totalConnected} anslutna</span>
                {summary.totalError > 0 && (
                  <span className="text-xs text-red-600">{summary.totalError} fel</span>
                )}
                {summary.totalExpired > 0 && (
                  <span className="text-xs text-amber-600">{summary.totalExpired} utgångna</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/30" />
            <input
              type="text"
              placeholder="Sök bolag, integration eller externt namn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm
                         focus:outline-none focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/10"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-all ${
              showFilters || statusFilter !== 'all'
                ? 'border-aifm-gold bg-aifm-gold/5 text-aifm-gold'
                : 'border-gray-200 text-aifm-charcoal/70 hover:border-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
            <span className="text-xs text-aifm-charcoal/50 self-center mr-2">Status:</span>
            {(['all', 'connected', 'error', 'expired', 'revoked'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-aifm-charcoal text-white'
                    : 'bg-gray-100 text-aifm-charcoal/70 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'Alla' : getStatusLabel(status)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Integrations Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-4 text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                  Bolag
                </th>
                <th className="text-left px-5 py-4 text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                  Integration
                </th>
                <th className="text-left px-5 py-4 text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                  Status
                </th>
                <th className="text-left px-5 py-4 text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                  Externt konto
                </th>
                <th className="text-left px-5 py-4 text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                  Senaste synk
                </th>
                <th className="text-right px-5 py-4 text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                  Åtgärder
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredIntegrations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-aifm-charcoal/50">
                    Inga integrationer matchar din sökning.
                  </td>
                </tr>
              ) : (
                filteredIntegrations.map((integration, index) => {
                  const Icon = integrationIcons[integration.integrationType] || Link2;
                  return (
                    <tr
                      key={`${integration.companyId}-${integration.integrationType}`}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-aifm-charcoal/50" />
                          </div>
                          <span className="text-sm font-medium text-aifm-charcoal">
                            {integration.companyName}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-aifm-charcoal/50" />
                          <span className="text-sm text-aifm-charcoal">{integration.integrationName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              integration.status
                            )}`}
                          >
                            {getStatusIcon(integration.status)}
                            {getStatusLabel(integration.status)}
                          </span>
                          {integration.tokenExpiresSoon && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
                              Token utgår snart
                            </span>
                          )}
                        </div>
                        {integration.lastError && (
                          <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={integration.lastError}>
                            {integration.lastError}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm text-aifm-charcoal">{integration.externalName || '—'}</p>
                          {integration.externalId && (
                            <p className="text-xs text-aifm-charcoal/50">{integration.externalId}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm text-aifm-charcoal">{formatDate(integration.lastSyncAt)}</p>
                          <p className="text-xs text-aifm-charcoal/50">
                            Ansluten: {formatDate(integration.connectedAt)}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {(integration.status === 'expired' ||
                            integration.status === 'revoked' ||
                            integration.status === 'error' ||
                            integration.tokenExpiresSoon) && (
                            <button
                              onClick={() => handleReconnect(integration.companyId, integration.integrationType)}
                              className="p-2 text-aifm-gold hover:bg-aifm-gold/10 rounded-lg transition-colors"
                              title="Återanslut"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDisconnect(integration.companyId, integration.integrationType)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Koppla bort"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-semibold text-aifm-charcoal">
            {integrations.filter((i) => i.status === 'connected').length}
          </p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">Aktiva anslutningar</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-semibold text-red-600">
            {integrations.filter((i) => i.status === 'error').length}
          </p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">Med fel</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-semibold text-amber-600">
            {integrations.filter((i) => i.status === 'expired' || i.status === 'revoked').length}
          </p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">Utgångna</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-semibold text-aifm-charcoal">{mockCompanies.length}</p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">Bolag totalt</p>
        </div>
      </div>
    </div>
  );
}

