'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Settings, Building2, Users, Mail, Clock,
  Plus, Trash2, Save, CheckCircle2, AlertCircle, Globe,
  Database, Bell, Shield, FileText, RefreshCw, Loader2
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Fund {
  id: string;
  name: string;
  isin: string;
  currency: string;
  enabled: boolean;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  fundIds: string[];
  reportTypes: ('NAV' | 'NOTOR' | 'SUBRED' | 'PRICE_DATA' | 'OWNER_DATA')[];
}

interface ScheduleConfig {
  dataFetch: string;
  notor: string;
  navReports: string;
  priceData: string;
  ownerData: string;
  subRed: string;
}

interface SecuraConfig {
  host: string;
  port: string;
  username: string;
  connected: boolean;
}

interface SettingsOptions {
  uploadToWebsite: boolean;
  slackNotifications: boolean;
  fourEyesPrinciple: boolean;
}

interface NAVSettings {
  tenantId: string;
  funds: Fund[];
  recipients: Recipient[];
  schedule: ScheduleConfig;
  securaConfig: SecuraConfig;
  options: SettingsOptions;
  updatedAt: string;
  updatedBy?: string;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_FUNDS: Fund[] = [
  { id: 'f1', name: 'AUAG Essential Metals', isin: 'SE0019175563', currency: 'SEK', enabled: true },
  { id: 'f2', name: 'AuAg Gold Rush', isin: 'SE0020677946', currency: 'SEK', enabled: true },
  { id: 'f3', name: 'AuAg Precious Green', isin: 'SE0014808440', currency: 'SEK', enabled: true },
  { id: 'f4', name: 'AuAg Silver Bullet', isin: 'SE0013358181', currency: 'SEK', enabled: true },
];

const DEFAULT_SCHEDULE: ScheduleConfig = {
  dataFetch: '06:00',
  notor: '07:00',
  navReports: '08:30',
  priceData: '09:00',
  ownerData: '09:15',
  subRed: '15:00',
};

const DEFAULT_SECURA_CONFIG: SecuraConfig = {
  host: '194.62.154.68',
  port: '20023',
  username: 'RESTAPI_AIFM',
  connected: false,
};

const DEFAULT_OPTIONS: SettingsOptions = {
  uploadToWebsite: true,
  slackNotifications: true,
  fourEyesPrinciple: true,
};

// ============================================================================
// Components
// ============================================================================

function SectionCard({ 
  title, 
  description, 
  icon: Icon, 
  children 
}: { 
  title: string; 
  description: string; 
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="p-1.5 sm:p-2 bg-aifm-gold/10 rounded-lg flex-shrink-0">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-aifm-gold" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-sm sm:text-base text-aifm-charcoal truncate">{title}</h2>
          <p className="text-xs sm:text-sm text-aifm-charcoal/60 truncate">{description}</p>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function NAVSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [funds, setFunds] = useState<Fund[]>(DEFAULT_FUNDS);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [schedule, setSchedule] = useState<ScheduleConfig>(DEFAULT_SCHEDULE);
  const [securaConfig, setSecuraConfig] = useState<SecuraConfig>(DEFAULT_SECURA_CONFIG);
  const [options, setOptions] = useState<SettingsOptions>(DEFAULT_OPTIONS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [newRecipient, setNewRecipient] = useState({ name: '', email: '' });
  const [showAddRecipient, setShowAddRecipient] = useState(false);

  // Load settings from API on mount
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/nav-automation/settings');
      const data = await response.json();
      
      if (data.success && data.settings) {
        const settings: NAVSettings = data.settings;
        setFunds(settings.funds || DEFAULT_FUNDS);
        setRecipients(settings.recipients || []);
        setSchedule(settings.schedule || DEFAULT_SCHEDULE);
        setSecuraConfig(settings.securaConfig || DEFAULT_SECURA_CONFIG);
        setOptions(settings.options || DEFAULT_OPTIONS);
        if (settings.updatedAt) {
          setLastSaved(settings.updatedAt);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const response = await fetch('/api/nav-automation/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          funds,
          recipients,
          schedule,
          securaConfig,
          options,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSaveSuccess(true);
        setLastSaved(new Date().toISOString());
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(data.error || 'Ett fel uppstod vid sparande');
      }
    } catch (error) {
      setSaveError('Kunde inte spara inställningar');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleFund = (fundId: string) => {
    setFunds(funds.map(f => 
      f.id === fundId ? { ...f, enabled: !f.enabled } : f
    ));
  };

  const addRecipient = () => {
    if (newRecipient.name && newRecipient.email) {
      setRecipients([...recipients, {
        id: `r${Date.now()}`,
        name: newRecipient.name,
        email: newRecipient.email,
        fundIds: [],
        reportTypes: ['NAV'],
      }]);
      setNewRecipient({ name: '', email: '' });
      setShowAddRecipient(false);
    }
  };

  const removeRecipient = (id: string) => {
    setRecipients(recipients.filter(r => r.id !== id));
  };

  const testSecuraConnection = async () => {
    try {
      const response = await fetch('/api/nav-automation/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: securaConfig.host,
          port: parseInt(securaConfig.port),
          username: securaConfig.username,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSecuraConfig({ ...securaConfig, connected: true });
        alert('✅ Anslutning lyckades!');
      } else {
        setSecuraConfig({ ...securaConfig, connected: false });
        alert(`❌ Anslutning misslyckades: ${data.error || 'Okänt fel'}`);
      }
    } catch (error) {
      setSecuraConfig({ ...securaConfig, connected: false });
      alert('❌ Kunde inte testa anslutning. Kontrollera att IP är vitlistad.');
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-aifm-gold" />
          <p className="text-aifm-charcoal/60">Laddar inställningar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/nav-admin"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-aifm-charcoal/60" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-aifm-charcoal">NAV Inställningar</h1>
            <p className="text-sm sm:text-base text-aifm-charcoal/60 mt-0.5 sm:mt-1">
              Konfigurera fonder, mottagare och schemaläggning
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          {lastSaved && (
            <span className="text-xs sm:text-sm text-aifm-charcoal/50 text-center sm:text-left">
              Sparat: {new Date(lastSaved).toLocaleString('sv-SE')}
            </span>
          )}
          {saveError && (
            <span className="text-xs sm:text-sm text-red-600">{saveError}</span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-aifm-gold text-white rounded-xl hover:bg-aifm-gold/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saveSuccess ? 'Sparat!' : 'Spara'}</span>
          </button>
        </div>
      </div>

      {/* Secura Connection */}
      <SectionCard
        title="Secura-anslutning"
        description="Konfigurera anslutning till Secura Fund & Portfolio"
        icon={Database}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1">
                Host
              </label>
              <input
                type="text"
                value={securaConfig.host}
                onChange={(e) => setSecuraConfig({ ...securaConfig, host: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-aifm-gold/50 text-sm sm:text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1">
                Port
              </label>
              <input
                type="text"
                value={securaConfig.port}
                onChange={(e) => setSecuraConfig({ ...securaConfig, port: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-aifm-gold/50 text-sm sm:text-base"
              />
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1">
                Användarnamn
              </label>
              <input
                type="text"
                value={securaConfig.username}
                onChange={(e) => setSecuraConfig({ ...securaConfig, username: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-aifm-gold/50 text-sm sm:text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1">
                Lösenord
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-aifm-gold/50 text-sm sm:text-base"
              />
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {securaConfig.connected ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-emerald-600 font-medium">Ansluten</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-amber-600 font-medium">Väntar på vitlistning av IP: 16.170.89.155</span>
              </>
            )}
          </div>
          <button
            onClick={testSecuraConnection}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Testa anslutning
          </button>
        </div>
      </SectionCard>

      {/* Funds */}
      <SectionCard
        title="Fonder"
        description="Välj vilka fonder som ska ingå i NAV-automationen"
        icon={Building2}
      >
        <div className="space-y-3">
          {funds.map((fund) => (
            <div 
              key={fund.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                fund.enabled ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={fund.enabled}
                  onChange={() => toggleFund(fund.id)}
                  className="w-5 h-5 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold/20"
                />
                <div>
                  <p className="font-medium text-aifm-charcoal">{fund.name}</p>
                  <p className="text-sm text-aifm-charcoal/50">{fund.isin} • {fund.currency}</p>
                </div>
              </div>
              {fund.enabled && (
                <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                  Aktiv
                </span>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Recipients */}
      <SectionCard
        title="Mottagare"
        description="Konfigurera vem som får vilka rapporter"
        icon={Users}
      >
        <div className="space-y-4">
          {recipients.map((recipient) => (
            <div 
              key={recipient.id}
              className="p-4 bg-gray-50 rounded-xl"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-aifm-charcoal">{recipient.name}</p>
                  <p className="text-sm text-aifm-charcoal/50">{recipient.email}</p>
                </div>
                <button
                  onClick={() => removeRecipient(recipient.id)}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-aifm-charcoal/50 mb-2">Fonder</p>
                  <div className="flex flex-wrap gap-2">
                    {funds.filter(f => f.enabled).map((fund) => (
                      <label key={fund.id} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={recipient.fundIds.includes(fund.id)}
                          onChange={(e) => {
                            const newFundIds = e.target.checked
                              ? [...recipient.fundIds, fund.id]
                              : recipient.fundIds.filter(id => id !== fund.id);
                            setRecipients(recipients.map(r =>
                              r.id === recipient.id ? { ...r, fundIds: newFundIds } : r
                            ));
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold/20"
                        />
                        <span className="text-aifm-charcoal/70">{fund.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-aifm-charcoal/50 mb-2">Rapporttyper</p>
                  <div className="flex flex-wrap gap-2">
                    {(['NAV', 'NOTOR', 'SUBRED', 'PRICE_DATA', 'OWNER_DATA'] as const).map((type) => (
                      <label key={type} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={recipient.reportTypes.includes(type)}
                          onChange={(e) => {
                            const newTypes = e.target.checked
                              ? [...recipient.reportTypes, type]
                              : recipient.reportTypes.filter(t => t !== type);
                            setRecipients(recipients.map(r =>
                              r.id === recipient.id ? { ...r, reportTypes: newTypes } : r
                            ));
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold/20"
                        />
                        <span className="text-aifm-charcoal/70">
                          {type === 'NAV' ? 'NAV-rapporter' :
                           type === 'NOTOR' ? 'Notor' :
                           type === 'SUBRED' ? 'SubReds' :
                           type === 'PRICE_DATA' ? 'Prisdata' : 'Ägardata'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {showAddRecipient ? (
            <div className="p-4 border-2 border-dashed border-aifm-gold/30 rounded-xl bg-aifm-gold/5">
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Namn"
                  value={newRecipient.name}
                  onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-aifm-gold/50"
                />
                <input
                  type="email"
                  placeholder="E-post"
                  value={newRecipient.email}
                  onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-aifm-gold/50"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addRecipient}
                  className="px-4 py-2 bg-aifm-gold text-white rounded-lg hover:bg-aifm-gold/90 transition-colors text-sm font-medium"
                >
                  Lägg till
                </button>
                <button
                  onClick={() => setShowAddRecipient(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddRecipient(true)}
              className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-aifm-gold/30 hover:bg-aifm-gold/5 transition-colors flex items-center justify-center gap-2 text-aifm-charcoal/60"
            >
              <Plus className="w-5 h-5" />
              <span>Lägg till mottagare</span>
            </button>
          )}
        </div>
      </SectionCard>

      {/* Schedule */}
      <SectionCard
        title="Schemaläggning"
        description="Ställ in tider för automatiska körningar (vardagar)"
        icon={Clock}
      >
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { key: 'dataFetch', label: 'Hämta NAV-data', icon: Database },
            { key: 'notor', label: 'Notor utskick', icon: FileText },
            { key: 'navReports', label: 'NAV-rapporter', icon: Mail },
            { key: 'priceData', label: 'Prisdata', icon: Globe },
            { key: 'ownerData', label: 'Ägardata', icon: Users },
            { key: 'subRed', label: 'SubReds', icon: FileText },
          ].map(({ key, label, icon: ItemIcon }) => (
            <div key={key} className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <ItemIcon className="w-4 h-4 text-aifm-charcoal/40" />
                <span className="text-sm font-medium text-aifm-charcoal">{label}</span>
              </div>
              <input
                type="time"
                value={schedule[key as keyof ScheduleConfig]}
                onChange={(e) => setSchedule({ ...schedule, [key]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-aifm-gold/50 text-lg font-mono"
              />
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 rounded-xl flex items-start gap-3">
          <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">4-ögon-principen</p>
            <p className="text-sm text-blue-700 mt-1">
              NAV-rapporter skickas automatiskt <strong>efter manuellt godkännande</strong> kl 08:00-08:30. 
              En andra person måste godkänna innan distribution.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Additional Settings */}
      <SectionCard
        title="Övriga inställningar"
        description="Hemsida-integration och notifikationer"
        icon={Settings}
      >
        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-aifm-charcoal/40" />
              <div>
                <p className="font-medium text-aifm-charcoal">Uppdatera hemsidan automatiskt</p>
                <p className="text-sm text-aifm-charcoal/50">Ladda upp NAV-kurser till er webbplats</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={options.uploadToWebsite}
              onChange={(e) => setOptions({ ...options, uploadToWebsite: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold/20"
            />
          </label>
          
          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-aifm-charcoal/40" />
              <div>
                <p className="font-medium text-aifm-charcoal">Slack/Teams-notifikationer</p>
                <p className="text-sm text-aifm-charcoal/50">Få meddelanden vid fel eller varningar</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={options.slackNotifications}
              onChange={(e) => setOptions({ ...options, slackNotifications: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold/20"
            />
          </label>
          
          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-aifm-charcoal/40" />
              <div>
                <p className="font-medium text-aifm-charcoal">Kräv 4-ögon-godkännande</p>
                <p className="text-sm text-aifm-charcoal/50">Två olika personer måste godkänna NAV</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={options.fourEyesPrinciple}
              onChange={(e) => setOptions({ ...options, fourEyesPrinciple: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold/20"
            />
          </label>
        </div>
      </SectionCard>
    </div>
  );
}
