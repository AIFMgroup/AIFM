'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { 
  Settings, Key, Building2, Bell, Shield, Link2, 
  Users, Globe, Check, X, Eye, EyeOff,
  RefreshCw, Trash2, Plus, AlertCircle, CheckCircle2,
  BarChart3, Fingerprint, Landmark, CreditCard, MessageSquare,
  FileSpreadsheet, ChevronRight, Lock, Mail, Phone, MapPin,
  Smartphone, Monitor, Clock, Camera, User, Upload
} from 'lucide-react';

import { useUserProfile } from '@/components/UserProfileContext';

type SettingsTab = 'profile' | 'account' | 'company' | 'integrations' | 'notifications' | 'security' | 'team';

// Loading fallback
function SettingsLoadingFallback() {
  return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-aifm-gold animate-spin mx-auto mb-4" />
          <p className="text-sm text-aifm-charcoal/50">Laddar inställningar...</p>
        </div>
      </div>
  );
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  connected: boolean;
  status?: 'active' | 'error' | 'pending';
}

const mockIntegrations: Integration[] = [
  { id: 'fortnox', name: 'Fortnox', description: 'Bokföring och fakturering', icon: FileSpreadsheet, connected: true, status: 'active' },
  { id: 'bankid', name: 'BankID', description: 'Digital signering och identifiering', icon: Fingerprint, connected: true, status: 'active' },
  { id: 'seb', name: 'SEB Bank', description: 'Bankkoppling för transaktioner', icon: Landmark, connected: false },
  { id: 'handelsbanken', name: 'Handelsbanken', description: 'Bankkoppling för transaktioner', icon: Landmark, connected: false },
  { id: 'bolagsverket', name: 'Bolagsverket', description: 'Automatisk bolagsinformation', icon: Building2, connected: true, status: 'active' },
  { id: 'skatteverket', name: 'Skatteverket', description: 'Skatteuppgifter och rapportering', icon: BarChart3, connected: false },
  { id: 'stripe', name: 'Stripe', description: 'Betalningar och korthantering', icon: CreditCard, connected: false },
  { id: 'slack', name: 'Slack', description: 'Notifieringar och kommunikation', icon: MessageSquare, connected: true, status: 'active' },
];

// Animated Tab Button
function TabButton({ 
  isActive, 
  icon: Icon, 
  label, 
  onClick 
}: { 
  isActive: boolean; 
  icon: React.ElementType; 
  label: string; 
  onClick: () => void; 
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium 
                  transition-all duration-300 group relative overflow-hidden ${
        isActive
          ? 'bg-aifm-charcoal text-white shadow-lg shadow-aifm-charcoal/20'
          : 'text-aifm-charcoal/60 hover:bg-gray-100 hover:text-aifm-charcoal'
      }`}
    >
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent" />
      )}
      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 flex-shrink-0 ${isActive ? '' : 'group-hover:scale-110'}`} />
      <span className="relative truncate">{label}</span>
      {isActive && (
        <ChevronRight className="w-4 h-4 ml-auto opacity-50 hidden sm:block" />
      )}
    </button>
  );
}

// Section Header
function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 sm:mb-8">
      <h2 className="text-lg sm:text-xl font-semibold text-aifm-charcoal tracking-tight">{title}</h2>
      <p className="text-xs sm:text-sm text-aifm-charcoal/50 mt-0.5 sm:mt-1">{description}</p>
    </div>
  );
}

// Input Field with animation
function InputField({ 
  label, 
  type = 'text', 
  defaultValue, 
  icon: Icon,
  placeholder
}: { 
  label: string; 
  type?: string; 
  defaultValue?: string;
  icon?: React.ElementType;
  placeholder?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
        {label}
      </label>
      <div className={`relative transition-all duration-300 ${isFocused ? 'scale-[1.01]' : ''}`}>
        {Icon && (
          <Icon className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-300 ${
            isFocused ? 'text-aifm-gold' : 'text-aifm-charcoal/30'
          }`} />
        )}
        <input
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-full py-3.5 bg-white border rounded-xl text-sm 
                     transition-all duration-300 ${Icon ? 'pl-11 pr-4' : 'px-4'}
                     ${isFocused 
                       ? 'border-aifm-gold ring-4 ring-aifm-gold/10 shadow-lg shadow-aifm-gold/5' 
                       : 'border-gray-200 hover:border-gray-300'
                     }`}
        />
      </div>
    </div>
  );
}

// Toggle Switch
function ToggleSwitch({ enabled, onChange, label }: { enabled: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-3 group"
    >
      <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
        enabled ? 'bg-aifm-gold' : 'bg-gray-200'
      }`}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${
          enabled ? 'left-6' : 'left-1'
        }`} />
      </div>
      <span className="text-xs text-aifm-charcoal/60 group-hover:text-aifm-charcoal transition-colors">
        {label}
      </span>
    </button>
  );
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'profile';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile, avatarSrc, refresh: refreshProfile } = useUserProfile();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsVisible(true);
  }, []);

  // Update tab when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab') as SettingsTab;
    if (tab && ['profile', 'account', 'company', 'integrations', 'notifications', 'security', 'team'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Vänligen välj en bildfil');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Bilden får max vara 5MB');
        return;
      }
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setAvatarFile(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', avatarFile);

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Upload failed');
      }

      await refreshProfile();
      setAvatarPreview(null);
      setAvatarFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert('Profilbild sparad!');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const tabs = [
    { id: 'profile' as SettingsTab, label: 'Profil', icon: User },
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
    <>
      {/* Page Header */}
      <div className={`mb-6 sm:mb-10 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 
                          flex items-center justify-center shadow-lg shadow-aifm-charcoal/20">
            <Settings className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-aifm-charcoal tracking-tight">Inställningar</h1>
            <p className="text-xs sm:text-sm text-aifm-charcoal/50">Hantera konto och säkerhet</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`bg-white rounded-2xl border border-gray-100/50 shadow-sm overflow-hidden
                       transition-all duration-700 delay-100 hover:shadow-xl hover:shadow-gray-200/50
                       ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="flex flex-col md:flex-row min-h-[600px] md:min-h-[700px]">
          {/* Mobile Tab Bar */}
          <div className="md:hidden overflow-x-auto border-b border-gray-100 bg-gray-50/80">
            <div className="flex p-2 gap-1 min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-aifm-charcoal text-white'
                      : 'text-aifm-charcoal/60 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Sidebar Tabs */}
          <div className="hidden md:block w-64 border-r border-gray-100 bg-gradient-to-b from-gray-50/80 to-white p-4">
            <nav className="space-y-1.5">
              {tabs.map((tab, index) => (
                <div 
                  key={tab.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                >
                  <TabButton
                    isActive={activeTab === tab.id}
                    icon={tab.icon}
                    label={tab.label}
                    onClick={() => setActiveTab(tab.id)}
                  />
                </div>
              ))}
            </nav>

            {/* Sidebar Footer */}
            <div className="mt-8 p-4 bg-aifm-charcoal/5 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <Lock className="w-4 h-4 text-aifm-charcoal/40" />
                <span className="text-xs font-medium text-aifm-charcoal/60">Säkerhetsinfo</span>
              </div>
              <p className="text-xs text-aifm-charcoal/40 leading-relaxed">
                All data är krypterad och lagras säkert i enlighet med GDPR.
              </p>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
            {/* Profile Settings */}
            {activeTab === 'profile' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <SectionHeader 
                  title="Min Profil" 
                  description="Hantera din profilbild och personliga information"
                />

                {/* Avatar Section */}
                <div className="space-y-6">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Profilbild
                  </h3>
                  
                  <div className="flex items-center gap-8">
                    {/* Avatar Preview */}
                    <div className="relative group">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-aifm-gold/20 to-aifm-gold/5 
                                    border-4 border-white shadow-xl shadow-aifm-gold/10 ring-2 ring-aifm-gold/20">
                        {avatarPreview ? (
                          <Image
                            src={avatarPreview}
                            alt="Profile Preview"
                            width={128}
                            height={128}
                            className="w-full h-full object-cover"
                          />
                        ) : avatarSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-4xl font-semibold text-aifm-gold">
                              {(profile?.displayName || profile?.email || 'A').slice(0, 1).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Hover overlay */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 
                                 transition-all duration-300 flex items-center justify-center cursor-pointer"
                      >
                        <div className="text-center text-white">
                          <Camera className="w-8 h-8 mx-auto mb-1" />
                          <span className="text-xs font-medium">Ändra bild</span>
                        </div>
                      </button>
                      
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </div>

                    {/* Upload Instructions */}
                    <div className="flex-1 space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-aifm-charcoal mb-1">Ladda upp ny profilbild</h4>
                        <p className="text-xs text-aifm-charcoal/50">
                          JPG, PNG eller GIF. Max 5MB. Rekommenderad storlek 256x256 px.
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium
                                    text-aifm-charcoal hover:bg-gray-50 transition-all flex items-center gap-2
                                    hover:border-aifm-gold hover:shadow-lg hover:shadow-aifm-gold/10"
                        >
                          <Upload className="w-4 h-4" />
                          Välj fil
                        </button>
                        
                        {(avatarPreview || avatarSrc) && (
                          <>
                            <button
                              onClick={handleAvatarUpload}
                              disabled={isUploadingAvatar}
                              className="py-2.5 px-4 bg-aifm-gold text-white rounded-xl text-sm font-medium
                                        hover:bg-aifm-gold/90 transition-all flex items-center gap-2
                                        shadow-lg shadow-aifm-gold/20 disabled:opacity-50"
                            >
                              {isUploadingAvatar ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              {isUploadingAvatar ? 'Sparar...' : 'Spara bild'}
                            </button>
                            <button
                              onClick={() => {
                                setAvatarPreview(null);
                                setAvatarFile(null);
                                if (fileInputRef.current) fileInputRef.current.value = '';
                              }}
                              className="p-2.5 text-aifm-charcoal/40 hover:text-red-500 hover:bg-red-50 
                                       rounded-xl transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personal Info */}
                <div className="space-y-6 pt-8 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Personlig information
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <InputField label="Förnamn" defaultValue={(profile?.displayName || 'Anna').split(' ')[0]} />
                    <InputField label="Efternamn" defaultValue={(profile?.displayName || 'Anna Andersson').split(' ').slice(1).join(' ') || 'Andersson'} />
                    <InputField label="E-post" type="email" defaultValue={profile?.email || 'anna@aifm.se'} icon={Mail} />
                    <InputField label="Telefon" type="tel" defaultValue="+46 70 123 45 67" icon={Phone} />
                    <InputField label="Titel/Roll" defaultValue={profile?.title || 'CFO'} />
                    <InputField label="Avdelning" defaultValue="Ekonomi" />
                  </div>
                </div>

                {/* Preferences */}
                <div className="space-y-6 pt-8 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Preferenser
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                        Språk
                      </label>
                      <select className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm 
                                       focus:border-aifm-gold focus:ring-4 focus:ring-aifm-gold/10 transition-all">
                        <option value="sv">Svenska</option>
                        <option value="en">English</option>
                        <option value="no">Norsk</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                        Tidszon
                      </label>
                      <select className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm 
                                       focus:border-aifm-gold focus:ring-4 focus:ring-aifm-gold/10 transition-all">
                        <option value="Europe/Stockholm">Europa/Stockholm (CET)</option>
                        <option value="Europe/London">Europa/London (GMT)</option>
                        <option value="America/New_York">Amerika/New York (EST)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="space-y-4 pt-8 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                    Snabblänkar
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <button 
                      onClick={() => setActiveTab('security')}
                      className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100
                               hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-aifm-charcoal/5 flex items-center justify-center
                                      group-hover:bg-aifm-gold/10 transition-colors">
                          <Key className="w-5 h-5 text-aifm-charcoal/60 group-hover:text-aifm-gold" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-aifm-charcoal">Byt lösenord</p>
                          <p className="text-xs text-aifm-charcoal/40">Uppdatera ditt lösenord</p>
                        </div>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => setActiveTab('notifications')}
                      className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100
                               hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-aifm-charcoal/5 flex items-center justify-center
                                      group-hover:bg-aifm-gold/10 transition-colors">
                          <Bell className="w-5 h-5 text-aifm-charcoal/60 group-hover:text-aifm-gold" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-aifm-charcoal">Notifieringar</p>
                          <p className="text-xs text-aifm-charcoal/40">Hantera aviseringar</p>
                        </div>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => setActiveTab('security')}
                      className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100
                               hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-aifm-charcoal/5 flex items-center justify-center
                                      group-hover:bg-aifm-gold/10 transition-colors">
                          <Shield className="w-5 h-5 text-aifm-charcoal/60 group-hover:text-aifm-gold" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-aifm-charcoal">Tvåfaktorsautentisering</p>
                          <p className="text-xs text-aifm-charcoal/40">Aktivera 2FA för extra säkerhet</p>
                        </div>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => window.location.href = '/auth/logout'}
                      className="p-4 bg-gradient-to-br from-red-50 to-white rounded-xl border border-red-100
                               hover:shadow-lg hover:shadow-red-100/50 transition-all duration-300 text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                          <X className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-red-600">Logga ut</p>
                          <p className="text-xs text-red-400">Avsluta din session</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-8 border-t border-gray-100">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="py-3 px-6 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                             hover:bg-aifm-charcoal/90 transition-all flex items-center gap-2
                             shadow-lg shadow-aifm-charcoal/20 hover:shadow-xl
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {isSaving ? 'Sparar...' : 'Spara ändringar'}
                  </button>
                </div>
              </div>
            )}

            {/* Account Settings */}
            {activeTab === 'account' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <SectionHeader 
                  title="Kontoinställningar" 
                  description="Hantera din personliga information och lösenord"
                />

                {/* Profile Info */}
                <div className="space-y-6">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Profil
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <InputField label="Förnamn" defaultValue="Anna" />
                    <InputField label="Efternamn" defaultValue="Andersson" />
                    <InputField label="E-post" type="email" defaultValue="anna@aifm.se" icon={Mail} />
                    <InputField label="Telefon" type="tel" defaultValue="+46 70 123 45 67" icon={Phone} />
                  </div>
                </div>

                {/* Change Password */}
                <div className="space-y-6 pt-8 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Byt lösenord
                  </h3>
                  
                  <div className="max-w-md space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                        Nuvarande lösenord
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/30" />
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          className="w-full pl-11 pr-12 py-3.5 bg-white border border-gray-200 rounded-xl text-sm 
                                   focus:border-aifm-gold focus:ring-4 focus:ring-aifm-gold/10 transition-all"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-aifm-charcoal/40 
                                   hover:text-aifm-charcoal transition-colors"
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                        Nytt lösenord
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/30" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          className="w-full pl-11 pr-12 py-3.5 bg-white border border-gray-200 rounded-xl text-sm 
                                   focus:border-aifm-gold focus:ring-4 focus:ring-aifm-gold/10 transition-all"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-aifm-charcoal/40 
                                   hover:text-aifm-charcoal transition-colors"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <InputField label="Bekräfta nytt lösenord" type="password" />

                    <button className="py-3 px-5 border border-gray-200 rounded-xl text-sm font-medium
                                      text-aifm-charcoal hover:bg-gray-50 transition-all flex items-center gap-2
                                      hover:border-aifm-gold hover:shadow-lg hover:shadow-aifm-gold/10">
                      <Key className="w-4 h-4" />
                      Uppdatera lösenord
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-8 border-t border-gray-100">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="py-3 px-6 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                             hover:bg-aifm-charcoal/90 transition-all flex items-center gap-2
                             shadow-lg shadow-aifm-charcoal/20 hover:shadow-xl
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {isSaving ? 'Sparar...' : 'Spara ändringar'}
                  </button>
                </div>
              </div>
            )}

            {/* Company Settings */}
            {activeTab === 'company' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <SectionHeader 
                  title="Företagsinställningar" 
                  description="Hantera företagsinformation och adresser"
                />

                <div className="space-y-6">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Företagsinformation
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <InputField label="Företagsnamn" defaultValue="AIFM Group AB" icon={Building2} />
                    <InputField label="Organisationsnummer" defaultValue="559123-4567" />
                    <InputField label="Momsregistreringsnummer" defaultValue="SE559123456701" />
                    <InputField label="Webbplats" type="url" defaultValue="https://aifm.se" icon={Globe} />
                  </div>
                </div>

                <div className="space-y-6 pt-8 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Adress
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <InputField label="Gatuadress" defaultValue="Storgatan 1" icon={MapPin} />
                    </div>
                    <InputField label="Postnummer" defaultValue="111 22" />
                    <InputField label="Ort" defaultValue="Stockholm" />
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                        Land
                      </label>
                      <select className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm 
                                       focus:border-aifm-gold focus:ring-4 focus:ring-aifm-gold/10 transition-all">
                        <option>Sverige</option>
                        <option>Norge</option>
                        <option>Danmark</option>
                        <option>Finland</option>
                      </select>
                    </div>
                    <InputField label="Faktura-e-post" type="email" defaultValue="faktura@aifm.se" icon={Mail} />
                  </div>
                </div>

                <div className="flex justify-end pt-8 border-t border-gray-100">
                  <button 
                    onClick={handleSave}
                    className="py-3 px-6 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                             hover:bg-aifm-charcoal/90 transition-all flex items-center gap-2
                             shadow-lg shadow-aifm-charcoal/20"
                  >
                    <Check className="w-4 h-4" />
                    Spara ändringar
                  </button>
                </div>
              </div>
            )}

            {/* Integrations */}
            {activeTab === 'integrations' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <SectionHeader 
                  title="Integrationer & API:er" 
                  description="Koppla externa tjänster för automatiserad datahantering"
                />

                {/* API Keys Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      API-nycklar
                    </h3>
                    <button className="py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium
                                      text-aifm-charcoal hover:bg-gray-50 transition-all flex items-center gap-2
                                      hover:border-aifm-gold hover:shadow-lg hover:shadow-aifm-gold/10">
                      <Plus className="w-4 h-4" />
                      Ny API-nyckel
                    </button>
                  </div>
                  
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 border border-gray-100
                                hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-aifm-charcoal/5 flex items-center justify-center">
                          <Key className="w-5 h-5 text-aifm-charcoal/60" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-aifm-charcoal">Produktions-API</p>
                          <p className="text-xs text-aifm-charcoal/40 font-mono mt-0.5">aifm_live_sk_****************************</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2.5 hover:bg-gray-100 rounded-xl text-aifm-charcoal/50 hover:text-aifm-charcoal transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-2.5 hover:bg-red-50 rounded-xl text-aifm-charcoal/50 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Integrations Grid */}
                <div className="space-y-4 pt-8 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    Tillgängliga integrationer
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {mockIntegrations.map((integration, index) => {
                      const Icon = integration.icon;
                      return (
                        <div 
                          key={integration.id}
                          style={{ animationDelay: `${index * 50}ms` }}
                          className={`p-5 rounded-xl border-2 transition-all duration-300 group
                                    hover:shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
                            integration.connected 
                              ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white' 
                              : 'border-gray-100 bg-white hover:border-aifm-gold/30 hover:shadow-aifm-gold/10'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
                                            group-hover:scale-110 ${
                                integration.connected 
                                  ? 'bg-emerald-100' 
                                  : 'bg-aifm-charcoal/5 group-hover:bg-aifm-gold/10'
                              }`}>
                                <Icon className={`w-6 h-6 ${
                                  integration.connected 
                                    ? 'text-emerald-600' 
                                    : 'text-aifm-charcoal/60 group-hover:text-aifm-gold'
                                }`} />
                              </div>
                              <div>
                                <p className="font-medium text-aifm-charcoal">{integration.name}</p>
                                <p className="text-xs text-aifm-charcoal/50 mt-0.5">{integration.description}</p>
                              </div>
                            </div>
                            {integration.connected ? (
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 text-xs text-emerald-600 
                                               bg-emerald-100 px-3 py-1.5 rounded-full font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Ansluten
                                </span>
                                <button className="p-2 hover:bg-emerald-100 rounded-lg text-emerald-600/50 
                                                 hover:text-emerald-600 transition-colors">
                                  <Settings className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button className="py-2 px-4 border border-gray-200 rounded-xl text-xs font-medium
                                              text-aifm-charcoal hover:bg-aifm-gold hover:text-white 
                                              hover:border-aifm-gold transition-all">
                                Anslut
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <SectionHeader 
                  title="Notifieringsinställningar" 
                  description="Välj vilka notifieringar du vill ta emot"
                />

                <div className="space-y-8">
                  {[
                    { category: 'Kapitalanrop', icon: Landmark, items: ['Nya kapitalanrop', 'Påminnelser', 'Betalningar mottagna'] },
                    { category: 'Investerare', icon: Users, items: ['Nya investerare', 'KYC-uppdateringar', 'Dokumentsigneringar'] },
                    { category: 'Dokument', icon: FileSpreadsheet, items: ['Nya dokument uppladdade', 'Dokument som behöver granskning', 'Utgångna dokument'] },
                    { category: 'System', icon: Settings, items: ['Säkerhetsvarningar', 'Integrationsfel', 'Systemunderhåll'] },
                  ].map((section, sectionIndex) => {
                    const SectionIcon = section.icon;
                    return (
                      <div 
                        key={section.category} 
                        className="space-y-4"
                        style={{ animationDelay: `${sectionIndex * 100}ms` }}
                      >
                        <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                          <SectionIcon className="w-4 h-4" />
                          {section.category}
                        </h3>
                        <div className="space-y-2">
                          {section.items.map((item, itemIndex) => (
                            <div 
                              key={item} 
                              className="flex items-center justify-between p-4 bg-gradient-to-br from-gray-50 to-white 
                                       rounded-xl border border-gray-100 hover:shadow-lg hover:shadow-gray-200/50
                                       transition-all duration-300 group"
                              style={{ animationDelay: `${(sectionIndex * 3 + itemIndex) * 30}ms` }}
                            >
                              <span className="text-sm text-aifm-charcoal group-hover:text-aifm-charcoal/80">{item}</span>
                              <div className="flex items-center gap-6">
                                <ToggleSwitch enabled={true} onChange={() => {}} label="E-post" />
                                <ToggleSwitch enabled={true} onChange={() => {}} label="Push" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-8 border-t border-gray-100">
                  <button 
                    onClick={handleSave}
                    className="py-3 px-6 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                             hover:bg-aifm-charcoal/90 transition-all flex items-center gap-2
                             shadow-lg shadow-aifm-charcoal/20"
                  >
                    <Check className="w-4 h-4" />
                    Spara ändringar
                  </button>
                </div>
              </div>
            )}

            {/* Security */}
            {activeTab === 'security' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <SectionHeader 
                  title="Säkerhetsinställningar" 
                  description="Hantera tvåfaktorsautentisering och sessioner"
                />

                {/* 2FA */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                    <Fingerprint className="w-4 h-4" />
                    Tvåfaktorsautentisering
                  </h3>
                  
                  <div className="bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-200 
                                rounded-xl p-5 flex items-center justify-between
                                hover:shadow-lg hover:shadow-emerald-100 transition-all duration-300">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Shield className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-aifm-charcoal">2FA är aktiverat</p>
                        <p className="text-xs text-aifm-charcoal/50 mt-0.5">Använder BankID för verifiering</p>
                      </div>
                    </div>
                    <button className="py-2.5 px-4 border border-emerald-200 rounded-xl text-sm font-medium
                                      text-emerald-700 hover:bg-emerald-100 transition-all">
                      Konfigurera
                    </button>
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="space-y-4 pt-8 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      Aktiva sessioner
                    </h3>
                    <button className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors">
                      Logga ut alla
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {[
                      { device: 'MacBook Pro - Chrome', icon: Monitor, location: 'Stockholm, Sverige', current: true, time: 'Just nu' },
                      { device: 'iPhone 15 - Safari', icon: Smartphone, location: 'Stockholm, Sverige', current: false, time: '2 timmar sedan' },
                    ].map((session, i) => {
                      const DeviceIcon = session.icon;
                      return (
                        <div 
                          key={i} 
                          className="flex items-center justify-between p-4 bg-gradient-to-br from-gray-50 to-white 
                                   rounded-xl border border-gray-100 hover:shadow-lg transition-all duration-300"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              session.current ? 'bg-emerald-100' : 'bg-gray-100'
                            }`}>
                              <DeviceIcon className={`w-5 h-5 ${
                                session.current ? 'text-emerald-600' : 'text-aifm-charcoal/50'
                              }`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-aifm-charcoal">{session.device}</p>
                              <p className="text-xs text-aifm-charcoal/40 mt-0.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {session.location} • {session.time}
                              </p>
                            </div>
                          </div>
                          {session.current ? (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-medium">
                              Denna enhet
                            </span>
                          ) : (
                            <button className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors">
                              Logga ut
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Login History */}
                <div className="space-y-4 pt-8 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Inloggningshistorik
                  </h3>
                  
                  <div className="space-y-2">
                    {[
                      { time: '27 nov 2024, 14:32', status: 'success', location: 'Stockholm' },
                      { time: '26 nov 2024, 09:15', status: 'success', location: 'Stockholm' },
                      { time: '25 nov 2024, 18:44', status: 'failed', location: 'Oslo' },
                    ].map((login, i) => (
                      <div 
                        key={i} 
                        className="flex items-center justify-between p-4 bg-gradient-to-br from-gray-50 to-white 
                                 rounded-xl border border-gray-100 hover:shadow-lg transition-all duration-300"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            login.status === 'success' ? 'bg-emerald-100' : 'bg-red-100'
                          }`}>
                            {login.status === 'success' ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-aifm-charcoal">{login.time}</p>
                            <p className="text-xs text-aifm-charcoal/40 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {login.location}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                          login.status === 'success' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-red-100 text-red-700'
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
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between">
                  <SectionHeader 
                    title="Teamhantering" 
                    description="Bjud in och hantera teammedlemmar"
                  />
                  <button className="py-3 px-5 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                                   hover:bg-aifm-charcoal/90 transition-all flex items-center gap-2
                                   shadow-lg shadow-aifm-charcoal/20">
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
                    <div 
                      key={i} 
                      className="flex items-center justify-between p-5 bg-gradient-to-br from-gray-50 to-white 
                               rounded-xl border border-gray-100 hover:shadow-lg hover:shadow-gray-200/50
                               transition-all duration-300 group"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-aifm-gold/20 to-aifm-gold/10 
                                      rounded-xl flex items-center justify-center
                                      group-hover:scale-110 transition-transform duration-300">
                          <span className="text-sm font-semibold text-aifm-gold">{member.avatar}</span>
                        </div>
                        <div>
                          <p className="font-medium text-aifm-charcoal">{member.name}</p>
                          <p className="text-xs text-aifm-charcoal/40 mt-0.5">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <select 
                          defaultValue={member.role}
                          className="text-sm bg-white border border-gray-200 rounded-xl px-4 py-2 
                                   focus:border-aifm-gold focus:ring-4 focus:ring-aifm-gold/10 transition-all"
                        >
                          <option>Admin</option>
                          <option>Manager</option>
                          <option>Analyst</option>
                          <option>Viewer</option>
                        </select>
                        {member.status === 'pending' && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full font-medium">
                            Väntande
                          </span>
                        )}
                        <button className="p-2.5 hover:bg-red-50 rounded-xl text-aifm-charcoal/40 
                                         hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Role Descriptions */}
                <div className="space-y-4 pt-8 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Rollbeskrivningar
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { role: 'Admin', icon: Shield, desc: 'Full åtkomst till alla funktioner och inställningar' },
                      { role: 'Manager', icon: Users, desc: 'Kan hantera fonder, investerare och godkännanden' },
                      { role: 'Analyst', icon: BarChart3, desc: 'Kan visa och analysera data, men inte göra ändringar' },
                      { role: 'Viewer', icon: Eye, desc: 'Endast läsbehörighet till utvalda rapporter' },
                    ].map((item, index) => {
                      const RoleIcon = item.icon;
                      return (
                        <div 
                          key={item.role} 
                          className="p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100
                                   hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 group"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-aifm-charcoal/5 flex items-center justify-center
                                          group-hover:bg-aifm-gold/10 transition-colors">
                              <RoleIcon className="w-4 h-4 text-aifm-charcoal/60 group-hover:text-aifm-gold transition-colors" />
                            </div>
                            <p className="font-medium text-aifm-charcoal">{item.role}</p>
                          </div>
                          <p className="text-xs text-aifm-charcoal/50 leading-relaxed">{item.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Export with Suspense boundary for useSearchParams
export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoadingFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}
