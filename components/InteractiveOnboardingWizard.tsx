'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ChevronRight, ChevronLeft, Check, Building2, Users, Calculator,
  FolderOpen, Scale, Bell, Settings, Sparkles, Rocket, CheckCircle2,
  ArrowRight, Globe, Link2, Mail, Phone, Briefcase, TrendingUp,
  Shield, FileText, CreditCard, Upload, AlertCircle, Loader2
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type WizardMode = 'overview' | 'setup-company';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  type: 'info' | 'form' | 'action' | 'complete';
  formFields?: FormField[];
}

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'select' | 'radio' | 'number' | 'textarea';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  helpText?: string;
}

interface CompanyData {
  // Basic Info
  companyName: string;
  shortName: string;
  orgNumber: string;
  fundType: string;
  // Structure
  registrationCountry: string;
  fundStructure: string;
  targetSize: string;
  currency: string;
  vintage: string;
  // Contact
  primaryContact: string;
  email: string;
  phone: string;
  address: string;
  // Integrations
  fortnoxConnected: boolean;
  bankConnected: boolean;
}

interface InteractiveOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: WizardMode;
}

// ============================================================================
// Wizard Steps Data
// ============================================================================

const overviewSteps: WizardStep[] = [
  {
    id: 'welcome',
    title: 'Välkommen till AIFM Platform!',
    description: 'Vi hjälper dig att komma igång. Denna guide tar dig igenom plattformens viktigaste funktioner och låter dig sätta upp ditt första bolag.',
    icon: Sparkles,
    type: 'info',
  },
  {
    id: 'pillars',
    title: 'Tre huvudpelare',
    description: 'AIFM är organiserat i tre delar:\n\n• **Bolag & Fonder** - Hantera NAV, portfölj, investerare och kapitalflöden\n• **CRM** - Hantera relationer, pipeline och kommunikation\n• **Compliance** - AI-driven regelverksassistent och dokumenthantering',
    icon: Building2,
    type: 'info',
  },
  {
    id: 'choose-path',
    title: 'Välj din väg',
    description: 'Vill du sätta upp ett nytt bolag nu, eller utforska plattformen först?',
    icon: Rocket,
    type: 'action',
  },
];

const companySetupSteps: WizardStep[] = [
  {
    id: 'company-intro',
    title: 'Skapa nytt bolag',
    description: 'Låt oss sätta upp ditt bolag steg för steg. All information kan ändras senare.',
    icon: Building2,
    type: 'info',
  },
  {
    id: 'company-basic',
    title: 'Grundläggande information',
    description: 'Fyll i bolagets grundläggande uppgifter.',
    icon: FileText,
    type: 'form',
    formFields: [
      { id: 'companyName', label: 'Bolagsnamn', type: 'text', placeholder: 'Nordic Ventures I AB', required: true, helpText: 'Det fullständiga juridiska namnet' },
      { id: 'shortName', label: 'Kortnamn', type: 'text', placeholder: 'Nordic Ventures I', helpText: 'Visas i gränssnittet' },
      { id: 'orgNumber', label: 'Organisationsnummer', type: 'text', placeholder: '559XXX-XXXX', required: true },
      { id: 'fundType', label: 'Fondtyp', type: 'select', required: true, options: [
        { value: '', label: 'Välj fondtyp...' },
        { value: 'venture', label: 'Venture Capital' },
        { value: 'growth', label: 'Growth Equity' },
        { value: 'buyout', label: 'Buyout' },
        { value: 'real_estate', label: 'Real Estate' },
        { value: 'infrastructure', label: 'Infrastructure' },
        { value: 'credit', label: 'Private Credit' },
        { value: 'hedge', label: 'Hedgefond' },
      ]},
    ],
  },
  {
    id: 'company-structure',
    title: 'Fondstruktur',
    description: 'Ange information om fondens struktur och storlek.',
    icon: Briefcase,
    type: 'form',
    formFields: [
      { id: 'registrationCountry', label: 'Registreringsland', type: 'select', required: true, options: [
        { value: '', label: 'Välj land...' },
        { value: 'SE', label: 'Sverige' },
        { value: 'NO', label: 'Norge' },
        { value: 'DK', label: 'Danmark' },
        { value: 'FI', label: 'Finland' },
        { value: 'LU', label: 'Luxemburg' },
        { value: 'IE', label: 'Irland' },
      ]},
      { id: 'fundStructure', label: 'Juridisk struktur', type: 'select', required: true, options: [
        { value: '', label: 'Välj struktur...' },
        { value: 'kb', label: 'Kommanditbolag (KB)' },
        { value: 'ab', label: 'Aktiebolag (AB)' },
        { value: 'sicav', label: 'SICAV' },
        { value: 'raif', label: 'RAIF' },
        { value: 'lp', label: 'Limited Partnership' },
      ]},
      { id: 'targetSize', label: 'Målstorlek (MSEK)', type: 'number', placeholder: '500', helpText: 'Fondens målkapital' },
      { id: 'currency', label: 'Valuta', type: 'select', required: true, options: [
        { value: 'SEK', label: 'SEK' },
        { value: 'EUR', label: 'EUR' },
        { value: 'USD', label: 'USD' },
        { value: 'NOK', label: 'NOK' },
        { value: 'DKK', label: 'DKK' },
      ]},
      { id: 'vintage', label: 'Vintage år', type: 'select', options: [
        { value: '2026', label: '2026' },
        { value: '2025', label: '2025' },
        { value: '2024', label: '2024' },
        { value: '2023', label: '2023' },
      ]},
    ],
  },
  {
    id: 'company-contact',
    title: 'Kontaktuppgifter',
    description: 'Ange primär kontakt för bolaget.',
    icon: Users,
    type: 'form',
    formFields: [
      { id: 'primaryContact', label: 'Kontaktperson', type: 'text', placeholder: 'Anna Andersson', required: true },
      { id: 'email', label: 'E-post', type: 'email', placeholder: 'anna@bolag.se', required: true },
      { id: 'phone', label: 'Telefon', type: 'text', placeholder: '+46 70 123 45 67' },
      { id: 'address', label: 'Adress', type: 'textarea', placeholder: 'Storgatan 1\n111 23 Stockholm' },
    ],
  },
  {
    id: 'company-integrations',
    title: 'Integrationer',
    description: 'Koppla externa system för att komma igång direkt.',
    icon: Link2,
    type: 'info',
  },
  {
    id: 'company-complete',
    title: 'Bolaget är skapat!',
    description: 'Ditt bolag är nu redo att användas. Nästa steg är att utforska plattformen och börja arbeta.',
    icon: CheckCircle2,
    type: 'complete',
  },
];

// ============================================================================
// Form Input Component
// ============================================================================

function FormInput({ 
  field, 
  value, 
  onChange 
}: { 
  field: FormField; 
  value: string; 
  onChange: (value: string) => void;
}) {
  const baseClasses = "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#c0a280] focus:ring-1 focus:ring-[#c0a280]/20 transition-all";
  
  if (field.type === 'select') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseClasses} appearance-none cursor-pointer`}
        required={field.required}
      >
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#1a1a1a] text-white">
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className={baseClasses}
        required={field.required}
      />
    );
  }

  return (
    <input
      type={field.type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={baseClasses}
      required={field.required}
    />
  );
}

// ============================================================================
// Progress Indicator
// ============================================================================

function WizardProgress({ 
  currentStep, 
  totalSteps,
  steps
}: { 
  currentStep: number; 
  totalSteps: number;
  steps: WizardStep[];
}) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              isActive 
                ? 'bg-[#c0a280] text-white' 
                : isCompleted 
                  ? 'bg-[#c0a280]/20 text-[#c0a280]' 
                  : 'bg-white/5 text-white/30'
            }`}>
              {isCompleted ? (
                <Check className="w-4 h-4" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
            </div>
            {index < totalSteps - 1 && (
              <div className={`w-8 h-0.5 transition-all ${
                isCompleted ? 'bg-[#c0a280]/50' : 'bg-white/10'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function InteractiveOnboardingWizard({ 
  isOpen, 
  onClose, 
  initialMode = 'overview' 
}: InteractiveOnboardingWizardProps) {
  const [mode, setMode] = useState<WizardMode>(initialMode);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [companyData, setCompanyData] = useState<CompanyData>({
    companyName: '',
    shortName: '',
    orgNumber: '',
    fundType: '',
    registrationCountry: '',
    fundStructure: '',
    targetSize: '',
    currency: 'SEK',
    vintage: '2026',
    primaryContact: '',
    email: '',
    phone: '',
    address: '',
    fortnoxConnected: false,
    bankConnected: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const steps = mode === 'overview' ? overviewSteps : companySetupSteps;
  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const updateFormData = (fieldId: string, value: string) => {
    setCompanyData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleNext = useCallback(async () => {
    if (isLastStep) {
      if (mode === 'setup-company') {
        // Simulate creating company
        setIsCreating(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsCreating(false);
        
        // Mark onboarding complete and close
        localStorage.setItem('aifm-onboarding-completed', 'true');
        onClose();
        // Redirect to overview
        window.location.href = '/overview';
        return;
      }
      onClose();
      return;
    }
    
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
      setIsAnimating(false);
    }, 150);
  }, [isLastStep, mode, onClose]);

  const handlePrev = useCallback(() => {
    if (isFirstStep) {
      if (mode === 'setup-company') {
        // Go back to overview mode
        setMode('overview');
        setCurrentStep(overviewSteps.length - 1);
        return;
      }
      return;
    }
    
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev - 1);
      setIsAnimating(false);
    }, 150);
  }, [isFirstStep, mode]);

  const handleStartSetup = () => {
    setMode('setup-company');
    setCurrentStep(0);
  };

  const handleSkipToExplore = () => {
    localStorage.setItem('aifm-onboarding-completed', 'true');
    onClose();
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const content = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Modal */}
      <div 
        className={`relative w-full max-w-2xl max-h-[90vh] sm:max-h-none overflow-y-auto bg-gradient-to-br from-[#1a1a1a] via-[#1a1a1a] to-[#252525] 
                    rounded-t-3xl sm:rounded-3xl shadow-2xl transition-all duration-300 ${
                      isAnimating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
                    }`}
      >
        {/* Decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#c0a280] via-amber-400 to-[#c0a280]" />
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress */}
        <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4">
          <WizardProgress 
            currentStep={currentStep} 
            totalSteps={steps.length}
            steps={steps}
          />
        </div>

        {/* Content */}
        <div className="px-4 sm:px-8 pb-6 sm:pb-8">
          {/* Icon */}
          <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#c0a280] to-amber-600 
                          flex items-center justify-center mb-4 sm:mb-6 shadow-lg shadow-[#c0a280]/20`}>
            <step.icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-semibold text-white mb-2 sm:mb-3">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-sm sm:text-base text-white/60 leading-relaxed whitespace-pre-line mb-4 sm:mb-6">
            {step.description}
          </p>

          {/* Form Fields */}
          {step.type === 'form' && step.formFields && (
            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              {step.formFields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-white/70 mb-1.5 sm:mb-2">
                    {field.label}
                    {field.required && <span className="text-[#c0a280] ml-1">*</span>}
                  </label>
                  <FormInput
                    field={field}
                    value={(companyData as any)[field.id] || ''}
                    onChange={(value) => updateFormData(field.id, value)}
                  />
                  {field.helpText && (
                    <p className="text-xs text-white/40 mt-1.5">{field.helpText}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Action Step (Choose Path) */}
          {step.id === 'choose-path' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <button
                onClick={handleStartSetup}
                className="group p-4 sm:p-5 bg-[#c0a280]/10 border border-[#c0a280]/30 rounded-xl sm:rounded-2xl 
                          hover:bg-[#c0a280]/20 hover:border-[#c0a280]/50 transition-all text-left"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-[#c0a280] flex items-center justify-center mb-3 sm:mb-4 
                               group-hover:scale-110 transition-transform">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-1 text-sm sm:text-base">Sätt upp bolag</h3>
                <p className="text-xs sm:text-sm text-white/50">Guidad setup steg för steg</p>
              </button>
              
              <button
                onClick={handleSkipToExplore}
                className="group p-4 sm:p-5 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl 
                          hover:bg-white/10 hover:border-white/20 transition-all text-left"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-white/10 flex items-center justify-center mb-3 sm:mb-4 
                               group-hover:scale-110 transition-transform">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white/60" />
                </div>
                <h3 className="text-white font-semibold mb-1 text-sm sm:text-base">Utforska först</h3>
                <p className="text-xs sm:text-sm text-white/50">Titta runt utan att skapa bolag</p>
              </button>
            </div>
          )}

          {/* Integrations Step */}
          {step.id === 'company-integrations' && (
            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              <button className="w-full flex items-center justify-between p-3 sm:p-4 bg-white/5 border border-white/10 
                                rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-white/20 transition-all group">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-white font-medium text-sm sm:text-base">Fortnox</h4>
                    <p className="text-xs sm:text-sm text-white/50">Koppla bokföring och fakturor</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-white/30 group-hover:text-white/60 transition-colors" />
              </button>
              
              <button className="w-full flex items-center justify-between p-3 sm:p-4 bg-white/5 border border-white/10 
                                rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-white/20 transition-all group">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-white font-medium text-sm sm:text-base">Bank (Tink)</h4>
                    <p className="text-xs sm:text-sm text-white/50">Automatisk import av transaktioner</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-white/30 group-hover:text-white/60 transition-colors" />
              </button>

              <p className="text-sm text-white/40 text-center pt-2">
                Du kan hoppa över detta och koppla integrationer senare
              </p>
            </div>
          )}

          {/* Complete Step */}
          {step.type === 'complete' && (
            <div className="space-y-4 mb-6">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-emerald-400 font-medium">Bolaget är skapat</h4>
                    <p className="text-sm text-emerald-400/70 mt-1">
                      {companyData.companyName || 'Ditt bolag'} är nu redo att användas
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-white/50 space-y-2">
                <p className="font-medium text-white/70">Nästa steg:</p>
                <ul className="space-y-1 pl-4">
                  <li className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 text-[#c0a280]" />
                    Ladda upp första fakturan
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 text-[#c0a280]" />
                    Lägg till investerare
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 text-[#c0a280]" />
                    Konfigrera NAV-beräkning
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation */}
          {step.id !== 'choose-path' && (
            <div className="flex items-center justify-between pt-6 border-t border-white/10">
              <div className="text-sm text-white/40">
                {currentStep + 1} / {steps.length}
              </div>

              <div className="flex items-center gap-3">
                {(!isFirstStep || mode === 'setup-company') && (
                  <button
                    onClick={handlePrev}
                    className="flex items-center gap-1 px-4 py-2 text-white/60 hover:text-white 
                              hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Tillbaka
                  </button>
                )}
                
                <button
                  onClick={handleNext}
                  disabled={isCreating}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#c0a280] hover:bg-[#c0a280]/90 
                            text-[#1a1a1a] font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Skapar...
                    </>
                  ) : isLastStep ? (
                    mode === 'setup-company' ? 'Skapa bolag' : 'Kom igång'
                  ) : (
                    <>
                      Nästa
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ============================================================================
// Hook for managing wizard state
// ============================================================================

const ONBOARDING_KEY = 'aifm-onboarding-completed';

export function useInteractiveOnboarding() {
  const [showWizard, setShowWizard] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // Small delay to let the page load
      const timer = setTimeout(() => setShowWizard(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowWizard(false);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY);
    setShowWizard(true);
  }, []);

  const closeWizard = useCallback(() => {
    setShowWizard(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }, []);

  return {
    showWizard: mounted && showWizard,
    completeOnboarding,
    resetOnboarding,
    closeWizard,
    startWizard: () => setShowWizard(true),
  };
}

export default InteractiveOnboardingWizard;
