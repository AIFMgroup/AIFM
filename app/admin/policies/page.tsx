'use client';

import { useState } from 'react';
import {
  Shield,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Copy,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  Building2,
  FileText,
  DollarSign,
  Calendar,
  Tag,
  Zap,
  Eye,
  Settings,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type PolicyType = 'auto_approval' | 'document_retention' | 'access_control' | 'notification' | 'compliance';
type PolicyScope = 'global' | 'company' | 'user';

interface PolicyCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in';
  value: string | number | string[];
}

interface PolicyAction {
  type: 'approve' | 'reject' | 'notify' | 'flag' | 'escalate' | 'archive';
  config?: Record<string, unknown>;
}

interface Policy {
  id: string;
  name: string;
  description: string;
  type: PolicyType;
  scope: PolicyScope;
  companyId?: string;
  companyName?: string;
  enabled: boolean;
  priority: number;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  matchCount: number;
  lastMatchAt?: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockPolicies: Policy[] = [
  {
    id: '1',
    name: 'Auto-godkänn små fakturor',
    description: 'Automatiskt godkänn leverantörsfakturor under 5000 SEK från kända leverantörer',
    type: 'auto_approval',
    scope: 'global',
    enabled: true,
    priority: 10,
    conditions: [
      { field: 'amount', operator: 'less_than', value: 5000 },
      { field: 'supplier.known', operator: 'equals', value: 'true' },
      { field: 'confidence', operator: 'greater_than', value: 0.9 },
    ],
    actions: [{ type: 'approve' }],
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-05T14:30:00Z',
    createdBy: 'admin@aifm.se',
    matchCount: 234,
    lastMatchAt: '2024-01-08T12:30:00Z',
  },
  {
    id: '2',
    name: 'Flagga höga belopp',
    description: 'Flagga fakturor över 100 000 SEK för manuell granskning',
    type: 'auto_approval',
    scope: 'global',
    enabled: true,
    priority: 5,
    conditions: [{ field: 'amount', operator: 'greater_than', value: 100000 }],
    actions: [{ type: 'flag' }, { type: 'notify', config: { recipients: ['finance@aifm.se'] } }],
    createdAt: '2024-01-02T09:00:00Z',
    updatedAt: '2024-01-02T09:00:00Z',
    createdBy: 'admin@aifm.se',
    matchCount: 12,
    lastMatchAt: '2024-01-07T16:45:00Z',
  },
  {
    id: '3',
    name: 'Nya leverantörer kräver godkännande',
    description: 'Alla fakturor från nya leverantörer måste godkännas manuellt',
    type: 'auto_approval',
    scope: 'global',
    enabled: true,
    priority: 1,
    conditions: [{ field: 'supplier.known', operator: 'equals', value: 'false' }],
    actions: [{ type: 'flag' }],
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
    createdBy: 'admin@aifm.se',
    matchCount: 45,
    lastMatchAt: '2024-01-08T09:15:00Z',
  },
  {
    id: '4',
    name: 'Nordic Fund - Striktare gränser',
    description: 'Lägre gräns för auto-godkännande för Nordic Fund Management',
    type: 'auto_approval',
    scope: 'company',
    companyId: 'company-2',
    companyName: 'Nordic Fund Management',
    enabled: true,
    priority: 15,
    conditions: [
      { field: 'amount', operator: 'less_than', value: 2000 },
      { field: 'supplier.known', operator: 'equals', value: 'true' },
    ],
    actions: [{ type: 'approve' }],
    createdAt: '2024-01-03T11:00:00Z',
    updatedAt: '2024-01-03T11:00:00Z',
    createdBy: 'admin@aifm.se',
    matchCount: 89,
    lastMatchAt: '2024-01-08T11:00:00Z',
  },
  {
    id: '5',
    name: 'Arkivera dokument äldre än 7 år',
    description: 'Automatiskt arkivera compliance-dokument efter 7 år',
    type: 'document_retention',
    scope: 'global',
    enabled: true,
    priority: 100,
    conditions: [{ field: 'age_years', operator: 'greater_than', value: 7 }],
    actions: [{ type: 'archive' }],
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
    createdBy: 'admin@aifm.se',
    matchCount: 0,
  },
  {
    id: '6',
    name: 'Notifiera vid compliance-varning',
    description: 'Skicka notis till compliance-teamet vid potentiella överträdelser',
    type: 'notification',
    scope: 'global',
    enabled: false,
    priority: 50,
    conditions: [{ field: 'compliance_risk', operator: 'greater_than', value: 0.7 }],
    actions: [{ type: 'notify', config: { recipients: ['compliance@aifm.se'], channel: 'email' } }],
    createdAt: '2024-01-04T15:00:00Z',
    updatedAt: '2024-01-06T10:00:00Z',
    createdBy: 'admin@aifm.se',
    matchCount: 3,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getPolicyTypeConfig(type: PolicyType) {
  const configs = {
    auto_approval: { label: 'Auto-godkännande', icon: Zap, color: 'bg-emerald-100 text-emerald-800' },
    document_retention: { label: 'Dokumentlagring', icon: FileText, color: 'bg-blue-100 text-blue-800' },
    access_control: { label: 'Åtkomstkontroll', icon: Shield, color: 'bg-purple-100 text-purple-800' },
    notification: { label: 'Notifieringar', icon: AlertCircle, color: 'bg-amber-100 text-amber-800' },
    compliance: { label: 'Compliance', icon: CheckCircle2, color: 'bg-red-100 text-red-800' },
  };
  return configs[type];
}

function getScopeConfig(scope: PolicyScope) {
  const configs = {
    global: { label: 'Global', icon: Settings, color: 'text-aifm-charcoal' },
    company: { label: 'Bolag', icon: Building2, color: 'text-blue-600' },
    user: { label: 'Användare', icon: Users, color: 'text-purple-600' },
  };
  return configs[scope];
}

function formatCondition(condition: PolicyCondition): string {
  const operators: Record<string, string> = {
    equals: '=',
    greater_than: '>',
    less_than: '<',
    contains: 'innehåller',
    in: 'i',
    not_in: 'inte i',
  };
  const value = Array.isArray(condition.value) ? condition.value.join(', ') : condition.value;
  return `${condition.field} ${operators[condition.operator]} ${value}`;
}

function formatDate(dateString?: string) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminPoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>(mockPolicies);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<PolicyType | 'all'>('all');
  const [scopeFilter, setScopeFilter] = useState<PolicyScope | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter policies
  const filteredPolicies = policies.filter((policy) => {
    const matchesSearch =
      searchQuery === '' ||
      policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || policy.type === typeFilter;
    const matchesScope = scopeFilter === 'all' || policy.scope === scopeFilter;

    return matchesSearch && matchesType && matchesScope;
  });

  // Sort by priority (lower = higher priority)
  const sortedPolicies = [...filteredPolicies].sort((a, b) => a.priority - b.priority);

  const handleToggleEnabled = (policyId: string) => {
    setPolicies((prev) =>
      prev.map((p) => (p.id === policyId ? { ...p, enabled: !p.enabled, updatedAt: new Date().toISOString() } : p))
    );
  };

  const handleDelete = (policyId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna policy?')) return;
    setPolicies((prev) => prev.filter((p) => p.id !== policyId));
  };

  const handleDuplicate = (policy: Policy) => {
    const newPolicy: Policy = {
      ...policy,
      id: `${Date.now()}`,
      name: `${policy.name} (kopia)`,
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      matchCount: 0,
      lastMatchAt: undefined,
    };
    setPolicies((prev) => [...prev, newPolicy]);
  };

  // Stats
  const stats = {
    total: policies.length,
    enabled: policies.filter((p) => p.enabled).length,
    autoApproval: policies.filter((p) => p.type === 'auto_approval').length,
    totalMatches: policies.reduce((sum, p) => sum + p.matchCount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-aifm-charcoal">Policies</h1>
          <p className="text-sm text-aifm-charcoal/50 mt-1">
            Konfigurera regler för auto-godkännande, notifieringar och compliance.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                     hover:bg-aifm-charcoal/90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Skapa policy
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-aifm-charcoal/50" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
              Totalt
            </span>
          </div>
          <p className="text-2xl font-semibold text-aifm-charcoal">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
              Aktiva
            </span>
          </div>
          <p className="text-2xl font-semibold text-emerald-600">{stats.enabled}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-aifm-gold" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
              Auto-godkännande
            </span>
          </div>
          <p className="text-2xl font-semibold text-aifm-charcoal">{stats.autoApproval}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
              Matchningar
            </span>
          </div>
          <p className="text-2xl font-semibold text-aifm-charcoal">{stats.totalMatches}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/30" />
            <input
              type="text"
              placeholder="Sök policy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm
                         focus:outline-none focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-all ${
              showFilters || typeFilter !== 'all' || scopeFilter !== 'all'
                ? 'border-aifm-gold bg-aifm-gold/5 text-aifm-gold'
                : 'border-gray-200 text-aifm-charcoal/70 hover:border-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-aifm-charcoal/50">Typ:</span>
              {(['all', 'auto_approval', 'document_retention', 'notification', 'compliance'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    typeFilter === type
                      ? 'bg-aifm-charcoal text-white'
                      : 'bg-gray-100 text-aifm-charcoal/70 hover:bg-gray-200'
                  }`}
                >
                  {type === 'all' ? 'Alla' : getPolicyTypeConfig(type as PolicyType).label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-aifm-charcoal/50">Scope:</span>
              {(['all', 'global', 'company', 'user'] as const).map((scope) => (
                <button
                  key={scope}
                  onClick={() => setScopeFilter(scope)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    scopeFilter === scope
                      ? 'bg-aifm-charcoal text-white'
                      : 'bg-gray-100 text-aifm-charcoal/70 hover:bg-gray-200'
                  }`}
                >
                  {scope === 'all' ? 'Alla' : getScopeConfig(scope as PolicyScope).label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Policies List */}
      <div className="space-y-3">
        {sortedPolicies.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
            <Shield className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
            <p className="text-sm text-aifm-charcoal/50">Inga policies matchar din sökning.</p>
          </div>
        ) : (
          sortedPolicies.map((policy) => {
            const typeConfig = getPolicyTypeConfig(policy.type);
            const scopeConfig = getScopeConfig(policy.scope);
            const TypeIcon = typeConfig.icon;
            const ScopeIcon = scopeConfig.icon;
            const isExpanded = expandedPolicy === policy.id;

            return (
              <div
                key={policy.id}
                className={`bg-white border rounded-2xl transition-all ${
                  policy.enabled ? 'border-gray-100' : 'border-gray-100 bg-gray-50/50'
                }`}
              >
                {/* Policy Header */}
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer"
                  onClick={() => setExpandedPolicy(isExpanded ? null : policy.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <TypeIcon className={`w-5 h-5 ${policy.enabled ? 'text-aifm-charcoal/70' : 'text-aifm-charcoal/30'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${policy.enabled ? 'text-aifm-charcoal' : 'text-aifm-charcoal/50'}`}>
                          {policy.name}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                        {policy.scope === 'company' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                            {policy.companyName}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${policy.enabled ? 'text-aifm-charcoal/50' : 'text-aifm-charcoal/30'}`}>
                        {policy.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium text-aifm-charcoal">{policy.matchCount}</p>
                      <p className="text-[10px] text-aifm-charcoal/40">matchningar</p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleEnabled(policy.id);
                      }}
                      className="flex-shrink-0"
                    >
                      {policy.enabled ? (
                        <ToggleRight className="w-8 h-8 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-gray-300" />
                      )}
                    </button>

                    <ChevronRight
                      className={`w-5 h-5 text-aifm-charcoal/30 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-0 border-t border-gray-100 mt-0">
                    <div className="pt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Conditions */}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40 mb-3">
                          Villkor
                        </p>
                        <div className="space-y-2">
                          {policy.conditions.map((condition, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                              <code className="text-xs text-aifm-charcoal/70 font-mono">
                                {formatCondition(condition)}
                              </code>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40 mb-3">
                          Åtgärder
                        </p>
                        <div className="space-y-2">
                          {policy.actions.map((action, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                              <span className="text-xs text-aifm-charcoal/70 capitalize">{action.type}</span>
                              {action.config && (
                                <span className="text-[10px] text-aifm-charcoal/40">
                                  {JSON.stringify(action.config)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-aifm-charcoal/40">
                      <span>Prioritet: {policy.priority}</span>
                      <span>Skapad: {formatDate(policy.createdAt)}</span>
                      <span>Uppdaterad: {formatDate(policy.updatedAt)}</span>
                      {policy.lastMatchAt && <span>Senaste match: {formatDate(policy.lastMatchAt)}</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aifm-charcoal/70 hover:text-aifm-charcoal hover:bg-gray-100 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                        Redigera
                      </button>
                      <button
                        onClick={() => handleDuplicate(policy)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aifm-charcoal/70 hover:text-aifm-charcoal hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Duplicera
                      </button>
                      <button
                        onClick={() => handleDelete(policy.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Ta bort
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Info Box */}
      <div className="bg-aifm-gold/5 border border-aifm-gold/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-aifm-gold flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-aifm-charcoal">Om policy-prioritet</p>
            <p className="text-xs text-aifm-charcoal/60 mt-1">
              Policies evalueras i prioritetsordning (lägre nummer = högre prioritet). 
              Den första matchande policyn tillämpas. Bolagsspecifika policies har 
              företräde över globala policies med samma prioritet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
