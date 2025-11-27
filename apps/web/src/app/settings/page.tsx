'use client';

import { useState } from 'react';
import { 
  Settings, Key, Building2, Bell, Shield, Link2, 
  Users, Globe, Check, X, Eye, EyeOff,
  RefreshCw, Trash2, Plus, AlertCircle, CheckCircle2
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

type SettingsTab = 'account' | 'company' | 'integrations' | 'notifications' | 'security' | 'team';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  status?: 'active' | 'error' | 'pending';
}

const mockIntegrations: Integration[] = [
  { id: 'fortnox', name: 'Fortnox', description: 'Bokföring och fakturering', icon: '📊', connected: true, status: 'active' },
  { id: 'bankid', name: 'BankID', description: 'Digital signering och identifiering', icon: '🔐', connected: true, status: 'active' },
  { id: 'seb', name: 'SEB Bank', description: 'Bankkoppling för transaktioner', icon: '🏦', connected: false },
  { id: 'handelsbanken', name: 'Handelsbanken', description: 'Bankkoppling för transaktioner', icon: '🏦', connected: false },
  { id: 'bolagsverket', name: 'Bolagsverket', description: 'Automatisk bolagsinformation', icon: '📋', connected: true, status: 'active' },
  { id: 'skatteverket', name: 'Skatteverket', description: 'Skatteuppgifter och rapportering', icon: '🏛️', connected: false },
  { id: 'stripe', name: 'Stripe', description: 'Betalningar och korthantering', icon: '💳', connected: false },
  { id: 'slack', name: 'Slack', description: 'Notifieringar och kommunikation', icon: '💬', connected: true, status: 'active' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const tabs = [
    { id: 'account' as SettingsTab, label: 'Konto', icon: Settings },
    { id: 'company' as SettingsTab, label: 'Företag', icon: Building2 },
    { id: 'integrations' as SettingsTab, label: 'Integrationer', icon: Link2 },
    { id: 'notifications' as SettingsTab, label: 'Notiser', icon: Bell },
    { id: 'security' as SettingsTab, label: 'Säkerhet', icon: Shield },
    { id: 'team' as SettingsTab, label: 'Team', icon: Users },
  ];

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      alert('Inställningar sparade!');
    }, 1000);
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider mb-2">Inställningar</h1>
        <p className="text-aifm-charcoal/60">Hantera ditt konto, integrationer och företagsinställningar</p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex">
          {/* Sidebar Tabs */}
          <div className="w-64 border-r border-gray-100 bg-gray-50/50">
            <nav className="p-4 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-aifm-charcoal text-white'
                        : 'text-aifm-charcoal/70 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-8">
            {/* Account Settings */}
            {activeTab === 'account' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-medium text-aifm-charcoal mb-1">Kontoinställningar</h2>
                  <p className="text-sm text-aifm-charcoal/60">Hantera din personliga information och lösenord</p>
                </div>

                {/* Profile Info */}
                <div className="space-y-6">
                  <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Profil</h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Förnamn</label>
                      <input
                        type="text"
                        defaultValue="Anna"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Efternamn</label>
                      <input
                        type="text"
                        defaultValue="Andersson"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">E-post</label>
                      <input
                        type="email"
                        defaultValue="anna@aifm.se"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Telefon</label>
                      <input
                        type="tel"
                        defaultValue="+46 70 123 45 67"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Change Password */}
                <div className="space-y-6 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Byt lösenord</h3>
                  
                  <div className="max-w-md space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Nuvarande lösenord</label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-aifm-charcoal/40 hover:text-aifm-charcoal"
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Nytt lösenord</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-aifm-charcoal/40 hover:text-aifm-charcoal"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Bekräfta nytt lösenord</label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                    <button className="btn-outline py-2.5 px-4 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Uppdatera lösenord
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-gray-100">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn-primary py-2.5 px-6 flex items-center gap-2"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {isSaving ? 'Sparar...' : 'Spara ändringar'}
                  </button>
                </div>
              </div>
            )}

            {/* Company Settings */}
            {activeTab === 'company' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-medium text-aifm-charcoal mb-1">Företagsinställningar</h2>
                  <p className="text-sm text-aifm-charcoal/60">Hantera företagsinformation och adresser</p>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Företagsinformation</h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Företagsnamn</label>
                      <input
                        type="text"
                        defaultValue="AIFM Group AB"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Organisationsnummer</label>
                      <input
                        type="text"
                        defaultValue="559123-4567"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Momsregistreringsnummer</label>
                      <input
                        type="text"
                        defaultValue="SE559123456701"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Webbplats</label>
                      <input
                        type="url"
                        defaultValue="https://aifm.se"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Fakturaadress</h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Gatuadress</label>
                      <input
                        type="text"
                        defaultValue="Storgatan 1"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Postnummer</label>
                      <input
                        type="text"
                        defaultValue="111 22"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Ort</label>
                      <input
                        type="text"
                        defaultValue="Stockholm"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Land</label>
                      <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all">
                        <option>Sverige</option>
                        <option>Norge</option>
                        <option>Danmark</option>
                        <option>Finland</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide mb-2">Faktura-e-post</label>
                      <input
                        type="email"
                        defaultValue="faktura@aifm.se"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-gray-100">
                  <button onClick={handleSave} className="btn-primary py-2.5 px-6 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Spara ändringar
                  </button>
                </div>
              </div>
            )}

            {/* Integrations */}
            {activeTab === 'integrations' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-medium text-aifm-charcoal mb-1">Integrationer & API:er</h2>
                  <p className="text-sm text-aifm-charcoal/60">Koppla externa tjänster för automatiserad datahantering</p>
                </div>

                {/* API Keys Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">API-nycklar</h3>
                    <button className="btn-outline py-2 px-3 text-sm flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Ny API-nyckel
                    </button>
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-aifm-charcoal">Produktions-API</p>
                        <p className="text-xs text-aifm-charcoal/50 font-mono mt-1">aifm_live_sk_****************************</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-gray-200 rounded-lg text-aifm-charcoal/60 hover:text-aifm-charcoal">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-red-50 rounded-lg text-aifm-charcoal/60 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Integrations Grid */}
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Tillgängliga integrationer</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {mockIntegrations.map((integration) => (
                      <div 
                        key={integration.id}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          integration.connected 
                            ? 'border-green-200 bg-green-50/50' 
                            : 'border-gray-100 bg-white hover:border-aifm-gold/30'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{integration.icon}</span>
                            <div>
                              <p className="font-medium text-aifm-charcoal">{integration.name}</p>
                              <p className="text-xs text-aifm-charcoal/60">{integration.description}</p>
                            </div>
                          </div>
                          {integration.connected ? (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                Ansluten
                              </span>
                              <button className="text-aifm-charcoal/40 hover:text-aifm-charcoal">
                                <Settings className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button className="btn-outline py-1.5 px-3 text-xs">
                              Anslut
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-medium text-aifm-charcoal mb-1">Notifieringsinställningar</h2>
                  <p className="text-sm text-aifm-charcoal/60">Välj vilka notifieringar du vill ta emot</p>
                </div>

                <div className="space-y-6">
                  {[
                    { category: 'Kapitalanrop', items: ['Nya kapitalanrop', 'Påminnelser', 'Betalningar mottagna'] },
                    { category: 'Investerare', items: ['Nya investerare', 'KYC-uppdateringar', 'Dokumentsigneringar'] },
                    { category: 'Dokument', items: ['Nya dokument uppladdade', 'Dokument som behöver granskning', 'Utgångna dokument'] },
                    { category: 'System', items: ['Säkerhetsvarningar', 'Integrationsfel', 'Systemunderhåll'] },
                  ].map((section) => (
                    <div key={section.category} className="space-y-4">
                      <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">{section.category}</h3>
                      <div className="space-y-3">
                        {section.items.map((item) => (
                          <div key={item} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <span className="text-sm text-aifm-charcoal">{item}</span>
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold" />
                                <span className="text-xs text-aifm-charcoal/60">E-post</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold" />
                                <span className="text-xs text-aifm-charcoal/60">Push</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-6 border-t border-gray-100">
                  <button onClick={handleSave} className="btn-primary py-2.5 px-6 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Spara ändringar
                  </button>
                </div>
              </div>
            )}

            {/* Security */}
            {activeTab === 'security' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-medium text-aifm-charcoal mb-1">Säkerhetsinställningar</h2>
                  <p className="text-sm text-aifm-charcoal/60">Hantera tvåfaktorsautentisering och sessioner</p>
                </div>

                {/* 2FA */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Tvåfaktorsautentisering</h3>
                  
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                        <Shield className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-aifm-charcoal">2FA är aktiverat</p>
                        <p className="text-xs text-aifm-charcoal/60">Använder BankID för verifiering</p>
                      </div>
                    </div>
                    <button className="btn-outline py-2 px-4 text-sm">
                      Konfigurera
                    </button>
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Aktiva sessioner</h3>
                    <button className="text-sm text-red-500 hover:underline">Logga ut alla</button>
                  </div>
                  
                  <div className="space-y-2">
                    {[
                      { device: 'MacBook Pro - Chrome', location: 'Stockholm, Sverige', current: true, time: 'Just nu' },
                      { device: 'iPhone 15 - Safari', location: 'Stockholm, Sverige', current: false, time: '2 timmar sedan' },
                    ].map((session, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-4">
                          <Globe className="w-5 h-5 text-aifm-charcoal/40" />
                          <div>
                            <p className="text-sm font-medium text-aifm-charcoal">{session.device}</p>
                            <p className="text-xs text-aifm-charcoal/50">{session.location} • {session.time}</p>
                          </div>
                        </div>
                        {session.current ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Denna enhet</span>
                        ) : (
                          <button className="text-sm text-red-500 hover:underline">Logga ut</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Login History */}
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Inloggningshistorik</h3>
                  
                  <div className="space-y-2">
                    {[
                      { time: '27 nov 2024, 14:32', status: 'success', location: 'Stockholm' },
                      { time: '26 nov 2024, 09:15', status: 'success', location: 'Stockholm' },
                      { time: '25 nov 2024, 18:44', status: 'failed', location: 'Oslo' },
                    ].map((login, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-4">
                          {login.status === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          )}
                          <div>
                            <p className="text-sm text-aifm-charcoal">{login.time}</p>
                            <p className="text-xs text-aifm-charcoal/50">{login.location}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          login.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {login.status === 'success' ? 'Lyckad' : 'Misslyckad'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Team */}
            {activeTab === 'team' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-aifm-charcoal mb-1">Teamhantering</h2>
                    <p className="text-sm text-aifm-charcoal/60">Bjud in och hantera teammedlemmar</p>
                  </div>
                  <button className="btn-primary py-2.5 px-4 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Bjud in medlem
                  </button>
                </div>

                {/* Team Members */}
                <div className="space-y-3">
                  {[
                    { name: 'Anna Andersson', email: 'anna@aifm.se', role: 'Admin', avatar: 'AA', status: 'active' },
                    { name: 'Erik Eriksson', email: 'erik@aifm.se', role: 'Manager', avatar: 'EE', status: 'active' },
                    { name: 'Maria Karlsson', email: 'maria@aifm.se', role: 'Analyst', avatar: 'MK', status: 'active' },
                    { name: 'johan@aifm.se', email: 'johan@aifm.se', role: 'Viewer', avatar: 'JO', status: 'pending' },
                  ].map((member, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-aifm-gold/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-aifm-gold">{member.avatar}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-aifm-charcoal">{member.name}</p>
                          <p className="text-xs text-aifm-charcoal/50">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <select 
                          defaultValue={member.role}
                          className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20"
                        >
                          <option>Admin</option>
                          <option>Manager</option>
                          <option>Analyst</option>
                          <option>Viewer</option>
                        </select>
                        {member.status === 'pending' && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Väntande</span>
                        )}
                        <button className="p-2 hover:bg-red-50 rounded-lg text-aifm-charcoal/40 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Role Descriptions */}
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Rollbeskrivningar</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { role: 'Admin', desc: 'Full åtkomst till alla funktioner och inställningar' },
                      { role: 'Manager', desc: 'Kan hantera fonder, investerare och godkännanden' },
                      { role: 'Analyst', desc: 'Kan visa och analysera data, men inte göra ändringar' },
                      { role: 'Viewer', desc: 'Endast läsbehörighet till utvalda rapporter' },
                    ].map((item) => (
                      <div key={item.role} className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-sm font-medium text-aifm-charcoal">{item.role}</p>
                        <p className="text-xs text-aifm-charcoal/60 mt-1">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

