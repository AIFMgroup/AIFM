'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Calendar,
  Mail,
  MessageSquare,
  TrendingUp,
  FileText,
  Newspaper,
  Link2,
  Unlink,
  RefreshCw,
  Loader2,
  Settings,
  ExternalLink,
  ChevronRight,
  Zap,
  Shield,
  Users,
  Building2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface IntegrationStatus {
  configured: boolean;
  connected: boolean;
  user?: { displayName?: string; email?: string };
  team?: { name?: string };
  expiresAt?: number;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  category: 'productivity' | 'data' | 'communication' | 'storage';
  features: string[];
  setupInstructions: string[];
  envVars: string[];
}

// ============================================================================
// Integration Definitions
// ============================================================================

const INTEGRATIONS: Integration[] = [
  {
    id: 'microsoft365',
    name: 'Microsoft 365',
    description: 'Kalender, email och Teams-integration',
    icon: Calendar,
    color: 'from-blue-500 to-blue-600',
    category: 'productivity',
    features: [
      'Visa och skapa kalenderhändelser',
      'Läs och skicka email',
      'Kontrollera tillgänglighet',
      'Synka med Outlook',
    ],
    setupInstructions: [
      'Skapa en app i Azure AD Portal',
      'Lägg till redirect URI: /api/integrations/microsoft365/callback',
      'Aktivera Calendar.ReadWrite, Mail.ReadWrite, Mail.Send scopes',
    ],
    envVars: ['MS365_CLIENT_ID', 'MS365_CLIENT_SECRET', 'MS365_TENANT_ID'],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Meddelanden och notifieringar',
    icon: MessageSquare,
    color: 'from-purple-500 to-purple-600',
    category: 'communication',
    features: [
      'Skicka meddelanden till kanaler',
      'Direktmeddelanden till användare',
      'Läs kanalhistorik',
      'Användaruppslagning',
    ],
    setupInstructions: [
      'Skapa en app på api.slack.com/apps',
      'Lägg till redirect URI: /api/integrations/slack/callback',
      'Aktivera nödvändiga OAuth scopes',
    ],
    envVars: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'SLACK_SIGNING_SECRET'],
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Dokumentsynkronisering för kunskapsbasen',
    icon: Cloud,
    color: 'from-sky-500 to-sky-600',
    category: 'storage',
    features: [
      'Synka företagets dokument',
      'Automatisk indexering',
      'AI-sökbar kunskapsbas',
      'Stöd för PDF, Word, Excel m.m.',
    ],
    setupInstructions: [
      'Skapa en app på dropbox.com/developers',
      'Aktivera "Full Dropbox" access',
      'Kopiera App key och App secret',
    ],
    envVars: ['DROPBOX_CLIENT_ID', 'DROPBOX_CLIENT_SECRET'],
  },
  {
    id: 'market-data',
    name: 'Marknadsdata',
    description: 'Realtidspriser och finansnyheter',
    icon: TrendingUp,
    color: 'from-emerald-500 to-emerald-600',
    category: 'data',
    features: [
      'Guld- och silverpriser',
      'Valutakurser',
      'Finansnyheter',
      'Regulatoriska uppdateringar',
    ],
    setupInstructions: [
      'Valfritt: Skapa konto på newsapi.org',
      'Valfritt: Skapa konto på alphavantage.co',
      'Fungerar med demo-data utan API-nycklar',
    ],
    envVars: ['NEWS_API_KEY', 'ALPHA_VANTAGE_API_KEY'],
  },
];

// ============================================================================
// Main Component
// ============================================================================

export default function AdminIntegrationsPage() {
  const searchParams = useSearchParams();
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const connected = searchParams.get('connected');
  const error = searchParams.get('error');

  // Load all integration statuses
  const loadStatuses = useCallback(async () => {
    setIsLoading(true);
    const newStatuses: Record<string, IntegrationStatus> = {};

    // Load MS365 status
    try {
      const res = await fetch('/api/integrations/microsoft365?action=status');
      if (res.ok) newStatuses.microsoft365 = await res.json();
    } catch (e) {
      newStatuses.microsoft365 = { configured: false, connected: false };
    }

    // Load Slack status
    try {
      const res = await fetch('/api/integrations/slack?action=status');
      if (res.ok) newStatuses.slack = await res.json();
    } catch (e) {
      newStatuses.slack = { configured: false, connected: false };
    }

    // Load Dropbox status
    try {
      const res = await fetch('/api/integrations/dropbox?action=status');
      if (res.ok) newStatuses.dropbox = await res.json();
    } catch (e) {
      newStatuses.dropbox = { configured: false, connected: false };
    }

    // Market data is always "configured"
    newStatuses['market-data'] = { configured: true, connected: true };

    setStatuses(newStatuses);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  // Connect to integration
  const handleConnect = async (integrationId: string) => {
    setConnectingId(integrationId);
    try {
      let authUrl = '';

      if (integrationId === 'microsoft365') {
        const res = await fetch('/api/integrations/microsoft365?action=auth-url');
        const data = await res.json();
        authUrl = data.authUrl;
      } else if (integrationId === 'slack') {
        const res = await fetch('/api/integrations/slack?action=auth-url');
        const data = await res.json();
        authUrl = data.authUrl;
      } else if (integrationId === 'dropbox') {
        const res = await fetch('/api/integrations/dropbox?action=auth-url');
        const data = await res.json();
        authUrl = data.authUrl;
      }

      if (authUrl) {
        window.location.href = authUrl;
      }
    } catch (error) {
      alert('Kunde inte starta anslutning');
      setConnectingId(null);
    }
  };

  // Disconnect from integration
  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Är du säker på att du vill koppla bort?')) return;

    try {
      let endpoint = '';
      if (integrationId === 'microsoft365') {
        endpoint = '/api/integrations/microsoft365';
      } else if (integrationId === 'slack') {
        endpoint = '/api/integrations/slack';
      } else if (integrationId === 'dropbox') {
        endpoint = '/api/integrations/dropbox';
      }

      if (endpoint) {
        await fetch(endpoint, { method: 'DELETE' });
        loadStatuses();
      }
    } catch (error) {
      alert('Kunde inte koppla bort');
    }
  };

  // Group integrations by category
  const groupedIntegrations = {
    productivity: INTEGRATIONS.filter(i => i.category === 'productivity'),
    communication: INTEGRATIONS.filter(i => i.category === 'communication'),
    storage: INTEGRATIONS.filter(i => i.category === 'storage'),
    data: INTEGRATIONS.filter(i => i.category === 'data'),
  };

  const categoryLabels = {
    productivity: { label: 'Produktivitet', icon: Calendar },
    communication: { label: 'Kommunikation', icon: MessageSquare },
    storage: { label: 'Lagring & Dokument', icon: Cloud },
    data: { label: 'Data & Nyheter', icon: TrendingUp },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-aifm-gold" />
          <p className="text-aifm-charcoal/60">Laddar integrationer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-aifm-charcoal/60" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-aifm-charcoal">Integrationer</h1>
            <p className="text-aifm-charcoal/60 mt-1">
              Koppla externa tjänster för att utöka AI-assistentens kapacitet
            </p>
          </div>
        </div>

        <button
          onClick={loadStatuses}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Uppdatera
        </button>
      </div>

      {/* Success/Error Messages */}
      {connected && (
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <p className="text-emerald-700">
            {connected === 'microsoft365' && 'Microsoft 365 kopplat!'}
            {connected === 'slack' && 'Slack kopplat!'}
            {connected === 'dropbox' && 'Dropbox kopplat!'}
            {!['microsoft365', 'slack', 'dropbox'].includes(connected) && 'Integration kopplad!'}
          </p>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{decodeURIComponent(error)}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          icon={Zap}
          label="Aktiva integrationer"
          value={Object.values(statuses).filter(s => s.connected).length}
          total={INTEGRATIONS.length}
          color="emerald"
        />
        <SummaryCard
          icon={Settings}
          label="Konfigurerade"
          value={Object.values(statuses).filter(s => s.configured).length}
          total={INTEGRATIONS.length}
          color="blue"
        />
        <SummaryCard
          icon={Shield}
          label="OAuth-anslutningar"
          value={Object.values(statuses).filter(s => s.connected && s.user).length}
          total={3}
          color="purple"
        />
        <SummaryCard
          icon={Users}
          label="AI-funktioner"
          value={8}
          total={8}
          color="amber"
        />
      </div>

      {/* Integrations by Category */}
      {Object.entries(groupedIntegrations).map(([category, integrations]) => {
        const { label, icon: CategoryIcon } = categoryLabels[category as keyof typeof categoryLabels];
        
        return (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-2">
              <CategoryIcon className="w-5 h-5 text-aifm-charcoal/60" />
              <h2 className="text-lg font-semibold text-aifm-charcoal">{label}</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {integrations.map(integration => {
                const status = statuses[integration.id] || { configured: false, connected: false };
                const Icon = integration.icon;

                return (
                  <div
                    key={integration.id}
                    className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                  >
                    {/* Header */}
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${integration.color} flex items-center justify-center`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-aifm-charcoal">{integration.name}</h3>
                            <p className="text-sm text-aifm-charcoal/60 mt-0.5">{integration.description}</p>
                          </div>
                        </div>
                        <StatusBadge connected={status.connected} configured={status.configured} />
                      </div>

                      {/* User info if connected */}
                      {status.connected && (status.user || status.team) && (
                        <div className="mt-3 p-2.5 bg-gray-50 rounded-lg flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-aifm-charcoal/70">
                            {status.user?.displayName || status.user?.email || status.team?.name || 'Ansluten'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div className="p-5 bg-gray-50/50">
                      <h4 className="text-xs font-medium text-aifm-charcoal/50 uppercase tracking-wider mb-2">
                        Funktioner
                      </h4>
                      <ul className="space-y-1.5">
                        {integration.features.slice(0, 3).map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-aifm-charcoal/70">
                            <ChevronRight className="w-3.5 h-3.5 text-aifm-gold" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Actions */}
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                      {!status.configured ? (
                        <div className="flex items-center gap-2 text-sm text-amber-600">
                          <AlertCircle className="w-4 h-4" />
                          <span>Miljövariabler saknas</span>
                        </div>
                      ) : status.connected ? (
                        <button
                          onClick={() => handleDisconnect(integration.id)}
                          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Unlink className="w-4 h-4" />
                          Koppla bort
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnect(integration.id)}
                          disabled={connectingId === integration.id || integration.id === 'market-data'}
                          className="flex items-center gap-2 px-4 py-2 bg-aifm-gold text-white rounded-lg hover:bg-aifm-gold/90 transition-colors disabled:opacity-50"
                        >
                          {connectingId === integration.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Ansluter...
                            </>
                          ) : (
                            <>
                              <Link2 className="w-4 h-4" />
                              Anslut
                            </>
                          )}
                        </button>
                      )}

                      {integration.id === 'dropbox' && status.connected && (
                        <Link
                          href="/admin/dropbox"
                          className="flex items-center gap-2 text-sm text-aifm-gold hover:underline"
                        >
                          Hantera <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Setup Instructions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-aifm-charcoal mb-4">Miljövariabler</h3>
        <p className="text-sm text-aifm-charcoal/60 mb-4">
          Lägg till följande miljövariabler i ECS Task Definition för att aktivera integrationer:
        </p>
        <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
          <pre className="text-sm text-gray-300 font-mono">
{`# Microsoft 365
MS365_CLIENT_ID=xxx
MS365_CLIENT_SECRET=xxx
MS365_TENANT_ID=xxx (valfritt, "common" används annars)

# Slack
SLACK_CLIENT_ID=xxx
SLACK_CLIENT_SECRET=xxx
SLACK_SIGNING_SECRET=xxx

# Dropbox
DROPBOX_CLIENT_ID=xxx
DROPBOX_CLIENT_SECRET=xxx

# Marknadsdata (valfritt)
NEWS_API_KEY=xxx
ALPHA_VANTAGE_API_KEY=xxx

# Viktigt
NEXT_PUBLIC_APP_URL=https://d31zvrvfawczta.cloudfront.net`}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub Components
// ============================================================================

function SummaryCard({
  icon: Icon,
  label,
  value,
  total,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  total: number;
  color: 'emerald' | 'blue' | 'purple' | 'amber';
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <p className="text-2xl font-bold">
        {value}<span className="text-sm font-normal opacity-60">/{total}</span>
      </p>
    </div>
  );
}

function StatusBadge({ connected, configured }: { connected: boolean; configured: boolean }) {
  if (connected) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Ansluten
      </span>
    );
  }
  
  if (configured) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
        Ej ansluten
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
      <AlertCircle className="w-3.5 h-3.5" />
      Saknar config
    </span>
  );
}
