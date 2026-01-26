'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, AlertCircle, XCircle, RefreshCw, 
  ChevronUp, ExternalLink, Wifi, WifiOff, Clock,
  Database, Server, Cloud, Link2
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type IntegrationStatus = 'connected' | 'warning' | 'error' | 'disconnected' | 'checking';

interface Integration {
  id: string;
  name: string;
  icon: React.ElementType;
  status: IntegrationStatus;
  lastSync?: string;
  message?: string;
  href?: string;
}

interface SystemHealth {
  api: IntegrationStatus;
  database: IntegrationStatus;
  lastChecked: string;
}

// ============================================================================
// Mock Data - In production, fetch from /api/integrations/status
// ============================================================================

const mockIntegrations: Integration[] = [
  {
    id: 'fortnox',
    name: 'Fortnox',
    icon: Cloud,
    status: 'connected',
    lastSync: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    message: 'Senaste synk: 5 min sedan',
    href: '/accounting/settings',
  },
  {
    id: 'tink',
    name: 'Tink (Bank)',
    icon: Database,
    status: 'connected',
    lastSync: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    message: '3 konton kopplade',
    href: '/accounting/integrations',
  },
  {
    id: 'azure',
    name: 'Azure AD',
    icon: Server,
    status: 'connected',
    message: 'SSO aktivt',
    href: '/admin/security',
  },
  {
    id: 'email',
    name: 'E-post (SES)',
    icon: Cloud,
    status: 'connected',
    message: 'Operativt',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusColor(status: IntegrationStatus) {
  switch (status) {
    case 'connected':
      return 'text-emerald-500';
    case 'warning':
      return 'text-amber-500';
    case 'error':
      return 'text-red-500';
    case 'disconnected':
      return 'text-gray-400';
    case 'checking':
      return 'text-blue-400';
    default:
      return 'text-gray-400';
  }
}

function getStatusIcon(status: IntegrationStatus) {
  switch (status) {
    case 'connected':
      return CheckCircle2;
    case 'warning':
      return AlertCircle;
    case 'error':
    case 'disconnected':
      return XCircle;
    case 'checking':
      return RefreshCw;
    default:
      return AlertCircle;
  }
}

function getStatusBg(status: IntegrationStatus) {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500/10';
    case 'warning':
      return 'bg-amber-500/10';
    case 'error':
      return 'bg-red-500/10';
    default:
      return 'bg-gray-500/10';
  }
}

function formatLastChecked(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just nu';
  if (diffMins < 60) return `${diffMins} min sedan`;
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================================
// Integration Row Component
// ============================================================================

function IntegrationRow({ integration }: { integration: Integration }) {
  const StatusIcon = getStatusIcon(integration.status);
  const Icon = integration.icon;
  
  const content = (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
      integration.href ? 'hover:bg-white/5 cursor-pointer' : ''
    }`}>
      <div className={`w-8 h-8 rounded-lg ${getStatusBg(integration.status)} 
                      flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${getStatusColor(integration.status)}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'white' }}>{integration.name}</p>
        {integration.message && (
          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{integration.message}</p>
        )}
      </div>
      <StatusIcon className={`w-4 h-4 ${getStatusColor(integration.status)} ${
        integration.status === 'checking' ? 'animate-spin' : ''
      }`} />
    </div>
  );

  if (integration.href) {
    return <Link href={integration.href}>{content}</Link>;
  }
  return content;
}

// ============================================================================
// Main Component
// ============================================================================

export function SystemStatusIndicator() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>(mockIntegrations);
  const [isOnline, setIsOnline] = useState(true);
  const [lastChecked, setLastChecked] = useState(new Date().toISOString());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periodic status check (every 5 minutes)
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // In production, fetch from /api/integrations/status
        // const res = await fetch('/api/integrations/status');
        // const data = await res.json();
        // setIntegrations(data.integrations);
        setLastChecked(new Date().toISOString());
      } catch (e) {
        console.error('Failed to check status:', e);
      }
    };

    const interval = setInterval(checkStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLastChecked(new Date().toISOString());
    setIsRefreshing(false);
  }, []);

  // Calculate overall status
  const overallStatus: IntegrationStatus = !isOnline 
    ? 'disconnected'
    : integrations.some(i => i.status === 'error') 
      ? 'error'
      : integrations.some(i => i.status === 'warning')
        ? 'warning'
        : 'connected';

  const connectedCount = integrations.filter(i => i.status === 'connected').length;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="ml-[72px] sm:ml-56 transition-all duration-300">
        <div className="pointer-events-auto">
          {/* Expanded Panel */}
          <div className={`bg-aifm-charcoal border-t border-white/10 overflow-hidden transition-all duration-300 ${
            isExpanded ? 'max-h-96' : 'max-h-0'
          }`}>
            <div className="p-4 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'white' }}>Systemstatus</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <Clock className="w-3 h-3" />
                    Senast kontrollerat: {formatLastChecked(lastChecked)}
                  </span>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {integrations.map(integration => (
                  <IntegrationRow key={integration.id} integration={integration} />
                ))}
              </div>

              {/* Quick links */}
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <Link 
                  href="/admin/integrations"
                  className="text-xs hover:underline flex items-center gap-1"
                  style={{ color: '#c0a280' }}
                >
                  Hantera integrationer
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <Link 
                  href="/admin/dashboard"
                  className="text-xs hover:text-white transition-colors"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  Admin Dashboard →
                </Link>
              </div>
            </div>
          </div>

          {/* Collapsed Bar */}
          <div 
            className="bg-aifm-charcoal/95 backdrop-blur-sm border-t border-white/10 
                       px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-aifm-charcoal"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-4">
              {/* Online indicator */}
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-emerald-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" />
                )}
                <span className="text-xs" style={{ color: isOnline ? 'rgba(255,255,255,0.7)' : '#f87171' }}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Divider */}
              <div className="w-px h-4 bg-white/10" />

              {/* Integration status summary */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${getStatusBg(overallStatus)}`}>
                  {(() => {
                    const StatusIcon = getStatusIcon(overallStatus);
                    return <StatusIcon className={`w-3.5 h-3.5 ${getStatusColor(overallStatus)}`} />;
                  })()}
                  <span className={`text-xs font-medium ${getStatusColor(overallStatus)}`}>
                    {overallStatus === 'connected' ? 'Allt fungerar' :
                     overallStatus === 'warning' ? 'Varning' :
                     overallStatus === 'error' ? 'Problem' : 'Frånkopplad'}
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {connectedCount}/{integrations.length} integrationer
                </span>
              </div>
            </div>

            {/* Expand button */}
            <button className="flex items-center gap-1 text-xs hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {isExpanded ? 'Dölj' : 'Visa detaljer'}
              <ChevronUp className={`w-4 h-4 transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Compact version for sidebar footer
// ============================================================================

export function SystemStatusCompact() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Assume all connected for demo
  const allConnected = true;

  return (
    <Link 
      href="/admin/integrations"
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
    >
      <div className={`w-2 h-2 rounded-full ${
        !isOnline ? 'bg-red-500' : allConnected ? 'bg-emerald-500' : 'bg-amber-500'
      } animate-pulse`} />
      <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">
        {!isOnline ? 'Offline' : allConnected ? 'System OK' : 'Varning'}
      </span>
      <Link2 className="w-3 h-3 text-white/20 ml-auto group-hover:text-white/40 transition-colors" />
    </Link>
  );
}


