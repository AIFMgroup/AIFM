'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, Key, Smartphone, Monitor, Globe, Clock,
  AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Lock, Unlock, Eye, EyeOff, Users, Settings,
  Fingerprint, Mail, Bell, History, MapPin, X,
  ChevronRight, Plus, Trash2
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  value?: number | string;
  category: 'authentication' | 'session' | 'access' | 'compliance';
}

interface ActiveSession {
  id: string;
  userId: string;
  userEmail: string;
  device: string;
  browser: string;
  os: string;
  ipAddress: string;
  location: string;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

interface SecurityEvent {
  id: string;
  type: 'login_success' | 'login_failed' | 'password_changed' | 'mfa_enabled' | 'session_terminated';
  userEmail: string;
  timestamp: string;
  ipAddress: string;
  details?: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockPolicies: SecurityPolicy[] = [
  { id: 'mfa', name: 'Tvåfaktorsautentisering (2FA)', description: 'Kräv 2FA för alla användare vid inloggning', enabled: true, category: 'authentication' },
  { id: 'password-expiry', name: 'Lösenordsutgång', description: 'Tvinga användare att byta lösenord regelbundet', enabled: false, value: 90, category: 'authentication' },
  { id: 'password-complexity', name: 'Lösenordskomplexitet', description: 'Minst 12 tecken med siffror och specialtecken', enabled: true, category: 'authentication' },
  { id: 'session-timeout', name: 'Session timeout', description: 'Automatisk utloggning efter inaktivitet', enabled: true, value: 15, category: 'session' },
  { id: 'concurrent-sessions', name: 'Samtidiga sessioner', description: 'Max antal aktiva sessioner per användare', enabled: true, value: 3, category: 'session' },
  { id: 'ip-whitelist', name: 'IP-begränsning', description: 'Begränsa åtkomst till specifika IP-adresser', enabled: false, category: 'access' },
  { id: 'geo-blocking', name: 'Geo-blockering', description: 'Blockera inloggningar från specifika länder', enabled: false, category: 'access' },
  { id: 'audit-logging', name: 'Fullständig audit-loggning', description: 'Logga alla användaraktiviteter', enabled: true, category: 'compliance' },
  { id: 'data-retention', name: 'Datalagring', description: 'Behåll audit-loggar i 7 år (Bokföringslagen)', enabled: true, value: 7, category: 'compliance' },
];

const mockSessions: ActiveSession[] = [
  { id: 's1', userId: 'u1', userEmail: 'anna.svensson@aifm.se', device: 'MacBook Pro', browser: 'Chrome 120', os: 'macOS 14.2', ipAddress: '192.168.1.100', location: 'Stockholm, SE', lastActive: new Date(Date.now() - 5 * 60000).toISOString(), createdAt: new Date(Date.now() - 3600000).toISOString(), isCurrent: true },
  { id: 's2', userId: 'u1', userEmail: 'anna.svensson@aifm.se', device: 'iPhone 15', browser: 'Safari 17', os: 'iOS 17.2', ipAddress: '192.168.1.101', location: 'Stockholm, SE', lastActive: new Date(Date.now() - 30 * 60000).toISOString(), createdAt: new Date(Date.now() - 7200000).toISOString(), isCurrent: false },
  { id: 's3', userId: 'u2', userEmail: 'erik.johansson@aifm.se', device: 'Windows PC', browser: 'Edge 120', os: 'Windows 11', ipAddress: '192.168.1.102', location: 'Göteborg, SE', lastActive: new Date(Date.now() - 15 * 60000).toISOString(), createdAt: new Date(Date.now() - 5400000).toISOString(), isCurrent: false },
  { id: 's4', userId: 'u3', userEmail: 'maria.lindgren@aifm.se', device: 'MacBook Air', browser: 'Firefox 121', os: 'macOS 14.1', ipAddress: '192.168.1.103', location: 'Malmö, SE', lastActive: new Date(Date.now() - 60 * 60000).toISOString(), createdAt: new Date(Date.now() - 10800000).toISOString(), isCurrent: false },
];

const mockEvents: SecurityEvent[] = [
  { id: 'e1', type: 'login_success', userEmail: 'anna.svensson@aifm.se', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), ipAddress: '192.168.1.100' },
  { id: 'e2', type: 'mfa_enabled', userEmail: 'erik.johansson@aifm.se', timestamp: new Date(Date.now() - 30 * 60000).toISOString(), ipAddress: '192.168.1.102' },
  { id: 'e3', type: 'login_failed', userEmail: 'unknown@external.com', timestamp: new Date(Date.now() - 45 * 60000).toISOString(), ipAddress: '45.67.89.10', details: 'Invalid credentials - 3 attempts' },
  { id: 'e4', type: 'password_changed', userEmail: 'maria.lindgren@aifm.se', timestamp: new Date(Date.now() - 60 * 60000).toISOString(), ipAddress: '192.168.1.103' },
  { id: 'e5', type: 'session_terminated', userEmail: 'carl.berg@aifm.se', timestamp: new Date(Date.now() - 90 * 60000).toISOString(), ipAddress: '192.168.1.104', details: 'Admin initiated' },
];

// ============================================================================
// Helper Components
// ============================================================================

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Just nu';
  if (minutes < 60) return `${minutes} min sedan`;
  if (hours < 24) return `${hours} tim sedan`;
  return date.toLocaleDateString('sv-SE');
}

function SecurityScoreCard({ score }: { score: number }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-emerald-600 bg-emerald-100';
    if (s >= 60) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return 'Utmärkt';
    if (s >= 60) return 'Bra';
    return 'Behöver förbättras';
  };

  return (
    <div className="bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-6 text-white">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-white/60 text-xs uppercase tracking-wider font-semibold">Säkerhetspoäng</p>
          <p className="text-4xl font-bold mt-2">{score}</p>
          <p className="text-white/60 text-sm">av 100</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${getScoreColor(score)}`}>
          {getScoreLabel(score)}
        </div>
      </div>
      <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-aifm-gold to-aifm-gold/80 rounded-full transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-white/50 text-xs mt-3">
        Aktivera fler säkerhetsfunktioner för att förbättra poängen
      </p>
    </div>
  );
}

function PolicyToggle({ 
  policy, 
  onToggle 
}: { 
  policy: SecurityPolicy; 
  onToggle: (id: string, enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-gradient-to-br from-gray-50 to-white 
                    rounded-xl border border-gray-100 hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
          policy.enabled ? 'bg-emerald-100' : 'bg-gray-100'
        }`}>
          {policy.enabled ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <XCircle className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <div>
          <p className="font-medium text-aifm-charcoal">{policy.name}</p>
          <p className="text-xs text-aifm-charcoal/50 mt-0.5">{policy.description}</p>
          {policy.value && (
            <p className="text-xs text-aifm-gold mt-1">
              {policy.id === 'session-timeout' ? `${policy.value} minuter` : 
               policy.id === 'concurrent-sessions' ? `Max ${policy.value} sessioner` :
               policy.id === 'password-expiry' ? `Var ${policy.value}:e dag` :
               policy.id === 'data-retention' ? `${policy.value} år` : policy.value}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={() => onToggle(policy.id, !policy.enabled)}
        className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
          policy.enabled ? 'bg-aifm-gold' : 'bg-gray-300'
        }`}
      >
        <span 
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
            policy.enabled ? 'left-6' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function SessionCard({ 
  session, 
  onTerminate 
}: { 
  session: ActiveSession; 
  onTerminate: (id: string) => void;
}) {
  const DeviceIcon = session.device.includes('iPhone') || session.device.includes('Android') 
    ? Smartphone 
    : Monitor;

  return (
    <div className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-lg ${
      session.isCurrent 
        ? 'bg-emerald-50 border-emerald-200' 
        : 'bg-white border-gray-100'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            session.isCurrent ? 'bg-emerald-100' : 'bg-gray-100'
          }`}>
            <DeviceIcon className={`w-5 h-5 ${session.isCurrent ? 'text-emerald-600' : 'text-gray-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-aifm-charcoal">{session.device}</p>
              {session.isCurrent && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                  Denna enhet
                </span>
              )}
            </div>
            <p className="text-sm text-aifm-charcoal/60 mt-0.5">{session.browser} • {session.os}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-aifm-charcoal/40">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {session.location}
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {session.ipAddress}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimestamp(session.lastActive)}
              </span>
            </div>
          </div>
        </div>
        {!session.isCurrent && (
          <button
            onClick={() => onTerminate(session.id)}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function SecurityEventRow({ event }: { event: SecurityEvent }) {
  const getEventConfig = (type: SecurityEvent['type']) => {
    switch (type) {
      case 'login_success': return { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600', label: 'Inloggning lyckad' };
      case 'login_failed': return { icon: XCircle, color: 'bg-red-100 text-red-600', label: 'Inloggning misslyckad' };
      case 'password_changed': return { icon: Key, color: 'bg-blue-100 text-blue-600', label: 'Lösenord ändrat' };
      case 'mfa_enabled': return { icon: Shield, color: 'bg-purple-100 text-purple-600', label: '2FA aktiverat' };
      case 'session_terminated': return { icon: Unlock, color: 'bg-amber-100 text-amber-600', label: 'Session avslutad' };
      default: return { icon: AlertTriangle, color: 'bg-gray-100 text-gray-600', label: type };
    }
  };

  const config = getEventConfig(event.type);
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-4 py-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-aifm-charcoal">{config.label}</span>
          <span className="text-xs text-aifm-charcoal/40">{event.userEmail}</span>
        </div>
        {event.details && (
          <p className="text-xs text-aifm-charcoal/50 mt-0.5">{event.details}</p>
        )}
      </div>
      <div className="text-right">
        <p className="text-xs text-aifm-charcoal/40">{formatTimestamp(event.timestamp)}</p>
        <p className="text-xs text-aifm-charcoal/30">{event.ipAddress}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Tab Navigation
// ============================================================================

type SecurityTab = 'overview' | 'policies' | 'sessions' | 'events';

function TabNav({ activeTab, onTabChange }: { activeTab: SecurityTab; onTabChange: (tab: SecurityTab) => void }) {
  const tabs: { id: SecurityTab; label: string; icon: typeof Shield }[] = [
    { id: 'overview', label: 'Översikt', icon: Shield },
    { id: 'policies', label: 'Policies', icon: Settings },
    { id: 'sessions', label: 'Sessioner', icon: Monitor },
    { id: 'events', label: 'Händelser', icon: History },
  ];

  return (
    <div className="bg-gray-100/80 rounded-xl p-1 inline-flex mb-8">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white text-aifm-charcoal shadow-sm'
                : 'text-aifm-charcoal/50 hover:text-aifm-charcoal'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function SecurityCenterPage() {
  const [activeTab, setActiveTab] = useState<SecurityTab>('overview');
  const [policies, setPolicies] = useState<SecurityPolicy[]>(mockPolicies);
  const [sessions, setSessions] = useState<ActiveSession[]>(mockSessions);
  const [events] = useState<SecurityEvent[]>(mockEvents);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate security score
  const securityScore = policies.reduce((score, policy) => {
    if (!policy.enabled) return score;
    switch (policy.id) {
      case 'mfa': return score + 25;
      case 'password-complexity': return score + 15;
      case 'session-timeout': return score + 15;
      case 'audit-logging': return score + 20;
      case 'concurrent-sessions': return score + 10;
      case 'password-expiry': return score + 10;
      case 'ip-whitelist': return score + 5;
      default: return score;
    }
  }, 0);

  const handlePolicyToggle = (id: string, enabled: boolean) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, enabled } : p));
  };

  const handleTerminateSession = (sessionId: string) => {
    if (confirm('Är du säker på att du vill avsluta denna session?')) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    }
  };

  const handleTerminateAllSessions = () => {
    if (confirm('Är du säker på att du vill avsluta alla sessioner utom din egen?')) {
      setSessions(prev => prev.filter(s => s.isCurrent));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 
                          flex items-center justify-center shadow-lg shadow-aifm-charcoal/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">Säkerhetscenter</h1>
            <p className="text-sm text-aifm-charcoal/50">Hantera säkerhetspolicies och övervakning</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLoading(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl
                       text-sm font-medium hover:bg-aifm-charcoal/90 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Uppdatera
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Security Score */}
          <div className="lg:col-span-1">
            <SecurityScoreCard score={securityScore} />
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider">Aktiva sessioner</p>
                <p className="text-2xl font-semibold text-aifm-charcoal mt-1">{sessions.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider">Policies aktiva</p>
                <p className="text-2xl font-semibold text-aifm-charcoal mt-1">
                  {policies.filter(p => p.enabled).length}/{policies.length}
                </p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-4">
              Rekommendationer
            </h2>
            <div className="space-y-3">
              {!policies.find(p => p.id === 'password-expiry')?.enabled && (
                <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-aifm-charcoal">Aktivera lösenordsutgång</p>
                    <p className="text-xs text-aifm-charcoal/50 mt-0.5">Tvinga användare att byta lösenord regelbundet för ökad säkerhet</p>
                  </div>
                  <button 
                    onClick={() => handlePolicyToggle('password-expiry', true)}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                  >
                    Aktivera
                  </button>
                </div>
              )}
              {!policies.find(p => p.id === 'ip-whitelist')?.enabled && (
                <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Globe className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-aifm-charcoal">Överväg IP-begränsning</p>
                    <p className="text-xs text-aifm-charcoal/50 mt-0.5">Begränsa åtkomst till kända IP-adresser för extra skydd</p>
                  </div>
                  <button 
                    onClick={() => handlePolicyToggle('ip-whitelist', true)}
                    className="px-4 py-2 border border-blue-200 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    Konfigurera
                  </button>
                </div>
              )}
              {policies.filter(p => p.enabled).length >= 6 && (
                <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-aifm-charcoal">Bra säkerhetsnivå!</p>
                    <p className="text-xs text-aifm-charcoal/50 mt-0.5">Du har aktiverat de viktigaste säkerhetsfunktionerna</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Events */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                Senaste säkerhetshändelser
              </h2>
              <button 
                onClick={() => setActiveTab('events')}
                className="text-xs text-aifm-gold hover:underline flex items-center gap-1"
              >
                Visa alla
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {events.slice(0, 5).map(event => (
                <SecurityEventRow key={event.id} event={event} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Policies Tab */}
      {activeTab === 'policies' && (
        <div className="space-y-6">
          {(['authentication', 'session', 'access', 'compliance'] as const).map(category => (
            <div key={category} className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-4 flex items-center gap-2">
                {category === 'authentication' && <Key className="w-4 h-4" />}
                {category === 'session' && <Clock className="w-4 h-4" />}
                {category === 'access' && <Lock className="w-4 h-4" />}
                {category === 'compliance' && <Shield className="w-4 h-4" />}
                {category === 'authentication' ? 'Autentisering' :
                 category === 'session' ? 'Sessionshantering' :
                 category === 'access' ? 'Åtkomstkontroll' : 'Compliance'}
              </h2>
              <div className="space-y-3">
                {policies
                  .filter(p => p.category === category)
                  .map(policy => (
                    <PolicyToggle 
                      key={policy.id} 
                      policy={policy} 
                      onToggle={handlePolicyToggle}
                    />
                  ))
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-aifm-charcoal/50">
              {sessions.length} aktiva sessioner
            </p>
            <button
              onClick={handleTerminateAllSessions}
              className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 
                         rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Avsluta alla andra
            </button>
          </div>
          <div className="space-y-3">
            {sessions.map(session => (
              <SessionCard 
                key={session.id} 
                session={session} 
                onTerminate={handleTerminateSession}
              />
            ))}
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="divide-y divide-gray-50">
            {events.map(event => (
              <SecurityEventRow key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


