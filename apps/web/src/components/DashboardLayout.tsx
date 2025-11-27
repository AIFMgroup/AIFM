'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { 
  Bell, Building2, ChevronDown, Search, Check, Plus, X,
  HelpCircle, Users, FileText, Briefcase, Shield, ArrowRight, ArrowLeft,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { DashboardSidebar } from './DashboardSidebar';
import { mockCompanies, Company } from '@/lib/companyData';

interface DashboardLayoutProps {
  children: ReactNode;
  showCompanySelector?: boolean;
  selectedCompany?: Company;
  onCompanyChange?: (company: Company) => void;
}

// Help Tooltip Component
function HelpTooltip({ text }: { text: string }) {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.preventDefault();
          setIsVisible(!isVisible);
        }}
        className="w-5 h-5 rounded-full bg-aifm-charcoal/10 hover:bg-aifm-gold/20 
                   flex items-center justify-center transition-colors group"
      >
        <HelpCircle className="w-3.5 h-3.5 text-aifm-charcoal/50 group-hover:text-aifm-gold" />
      </button>
      {isVisible && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 w-64
                        bg-aifm-charcoal text-white text-xs rounded-lg p-3 shadow-xl
                        animate-in fade-in slide-in-from-left-2 duration-200">
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 
                          w-2 h-2 bg-aifm-charcoal rotate-45" />
          {text}
        </div>
      )}
    </div>
  );
}

// Onboarding Wizard Modal
function OnboardingWizard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    companyName: '',
    shortName: '',
    orgNumber: '',
    fundType: '',
    // Step 2: Legal & Compliance
    registrationCountry: '',
    regulatoryStatus: '',
    aifmLicense: '',
    fundStructure: '',
    // Step 3: Fund Details
    targetSize: '',
    currency: 'SEK',
    vintageYear: new Date().getFullYear().toString(),
    investmentStrategy: '',
    // Step 4: Contact & Access
    primaryContact: '',
    email: '',
    phone: '',
    accessLevel: 'full',
  });

  const steps = [
    {
      id: 'basic',
      title: 'Grundläggande info',
      icon: Building2,
      description: 'Företagets grunduppgifter',
    },
    {
      id: 'legal',
      title: 'Juridik & Compliance',
      icon: Shield,
      description: 'Regulatorisk information',
    },
    {
      id: 'fund',
      title: 'Fonddetaljer',
      icon: Briefcase,
      description: 'Fondens struktur och strategi',
    },
    {
      id: 'contact',
      title: 'Kontakt & Åtkomst',
      icon: Users,
      description: 'Kontaktpersoner och behörigheter',
    },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    alert('Nytt bolag skapat! (Demo)\n\n' + JSON.stringify(formData, null, 2));
    onClose();
    setCurrentStep(0);
    setFormData({
      companyName: '',
      shortName: '',
      orgNumber: '',
      fundType: '',
      registrationCountry: '',
      regulatoryStatus: '',
      aifmLicense: '',
      fundStructure: '',
      targetSize: '',
      currency: 'SEK',
      vintageYear: new Date().getFullYear().toString(),
      investmentStrategy: '',
      primaryContact: '',
      email: '',
      phone: '',
      accessLevel: 'full',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-aifm-charcoal to-aifm-charcoal/90 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-aifm-gold rounded-xl flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-medium">Lägg till nytt bolag</h2>
                <p className="text-sm text-white/60">Steg {currentStep + 1} av {steps.length}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Tabs */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(index)}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200
                    ${isActive 
                      ? 'bg-white shadow-md border border-aifm-gold/30' 
                      : isCompleted 
                        ? 'bg-green-50 border border-green-200' 
                        : 'bg-white/50 border border-transparent hover:bg-white hover:border-gray-200'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                    ${isActive 
                      ? 'bg-aifm-gold/10' 
                      : isCompleted 
                        ? 'bg-green-100' 
                        : 'bg-gray-100'}`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Icon className={`w-4 h-4 ${isActive ? 'text-aifm-gold' : 'text-gray-400'}`} />
                    )}
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className={`text-xs font-medium ${isActive ? 'text-aifm-charcoal' : 'text-gray-500'}`}>
                      {step.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Basic Info */}
          {currentStep === 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-aifm-gold" />
                <h3 className="text-lg font-medium text-aifm-charcoal">Grundläggande information</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                      Bolagsnamn *
                    </label>
                    <HelpTooltip text="Det fullständiga juridiska namnet på bolaget/fonden som det är registrerat hos Bolagsverket." />
                  </div>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    placeholder="t.ex. Nordic Ventures I AB"
                    className="input w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                        Kortnamn *
                      </label>
                      <HelpTooltip text="Ett kort, lättläst namn som används i gränssnittet. Max 20 tecken." />
                    </div>
                    <input
                      type="text"
                      value={formData.shortName}
                      onChange={(e) => handleInputChange('shortName', e.target.value)}
                      placeholder="t.ex. Nordic Ventures I"
                      className="input w-full"
                      maxLength={20}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                        Organisationsnummer *
                      </label>
                      <HelpTooltip text="Det svenska organisationsnumret i formatet XXXXXX-XXXX." />
                    </div>
                    <input
                      type="text"
                      value={formData.orgNumber}
                      onChange={(e) => handleInputChange('orgNumber', e.target.value)}
                      placeholder="XXXXXX-XXXX"
                      className="input w-full"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                      Fondtyp *
                    </label>
                    <HelpTooltip text="Välj den typ av fond som bäst beskriver investeringsstrategin och strukturen." />
                  </div>
                  <select
                    value={formData.fundType}
                    onChange={(e) => handleInputChange('fundType', e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Välj fondtyp...</option>
                    <option value="venture">Venture Capital</option>
                    <option value="growth">Growth Equity</option>
                    <option value="buyout">Buyout</option>
                    <option value="real_estate">Real Estate</option>
                    <option value="infrastructure">Infrastructure</option>
                    <option value="credit">Private Credit</option>
                    <option value="fund_of_funds">Fund of Funds</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Legal & Compliance */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-aifm-gold" />
                <h3 className="text-lg font-medium text-aifm-charcoal">Juridik & Compliance</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                        Registreringsland *
                      </label>
                      <HelpTooltip text="Landet där fonden är juridiskt registrerad och reglerad." />
                    </div>
                    <select
                      value={formData.registrationCountry}
                      onChange={(e) => handleInputChange('registrationCountry', e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Välj land...</option>
                      <option value="SE">Sverige</option>
                      <option value="NO">Norge</option>
                      <option value="DK">Danmark</option>
                      <option value="FI">Finland</option>
                      <option value="LU">Luxemburg</option>
                      <option value="IE">Irland</option>
                      <option value="other">Annat</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                        Regulatorisk status *
                      </label>
                      <HelpTooltip text="Fondens registreringsstatus hos Finansinspektionen eller motsvarande myndighet." />
                    </div>
                    <select
                      value={formData.regulatoryStatus}
                      onChange={(e) => handleInputChange('regulatoryStatus', e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Välj status...</option>
                      <option value="registered">Registrerad AIF</option>
                      <option value="licensed">Licensierad AIF</option>
                      <option value="sub_threshold">Under tröskelvärde</option>
                      <option value="pending">Ansökan pågår</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                      AIFM-licensnummer
                    </label>
                    <HelpTooltip text="Om fonden har en AIFM-licens, ange licensnumret här. Lämna tomt om ej tillämpligt." />
                  </div>
                  <input
                    type="text"
                    value={formData.aifmLicense}
                    onChange={(e) => handleInputChange('aifmLicense', e.target.value)}
                    placeholder="t.ex. FI-12345"
                    className="input w-full"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                      Fondstruktur *
                    </label>
                    <HelpTooltip text="Den juridiska strukturen som fonden är organiserad under." />
                  </div>
                  <select
                    value={formData.fundStructure}
                    onChange={(e) => handleInputChange('fundStructure', e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Välj struktur...</option>
                    <option value="limited_partnership">Kommanditbolag (KB)</option>
                    <option value="aktiebolag">Aktiebolag (AB)</option>
                    <option value="sicav">SICAV</option>
                    <option value="sif">SIF</option>
                    <option value="raif">RAIF</option>
                    <option value="other">Annan</option>
                  </select>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Viktigt</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Säkerställ att all regulatorisk information är korrekt. Felaktig information kan leda till compliance-problem.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Fund Details */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="w-5 h-5 text-aifm-gold" />
                <h3 className="text-lg font-medium text-aifm-charcoal">Fonddetaljer</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                        Målstorlek (MSEK) *
                      </label>
                      <HelpTooltip text="Den totala målstorleken för fonden i miljoner SEK (eller vald valuta)." />
                    </div>
                    <input
                      type="number"
                      value={formData.targetSize}
                      onChange={(e) => handleInputChange('targetSize', e.target.value)}
                      placeholder="t.ex. 500"
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                        Valuta *
                      </label>
                      <HelpTooltip text="Den huvudsakliga valutan som fonden redovisar i." />
                    </div>
                    <select
                      value={formData.currency}
                      onChange={(e) => handleInputChange('currency', e.target.value)}
                      className="input w-full"
                    >
                      <option value="SEK">SEK - Svenska kronor</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="NOK">NOK - Norska kronor</option>
                      <option value="DKK">DKK - Danska kronor</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                      Vintage Year *
                    </label>
                    <HelpTooltip text="Året då fonden gjorde sin första investering eller closing. Används för benchmarking." />
                  </div>
                  <input
                    type="number"
                    value={formData.vintageYear}
                    onChange={(e) => handleInputChange('vintageYear', e.target.value)}
                    placeholder={new Date().getFullYear().toString()}
                    min="2000"
                    max="2030"
                    className="input w-full"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                      Investeringsstrategi
                    </label>
                    <HelpTooltip text="Beskriv kortfattat fondens investeringsfokus, t.ex. sektor, geografiskt fokus, investeringsstorlek." />
                  </div>
                  <textarea
                    value={formData.investmentStrategy}
                    onChange={(e) => handleInputChange('investmentStrategy', e.target.value)}
                    placeholder="t.ex. Investerar i nordiska tech-bolag i tidig tillväxtfas med fokus på SaaS och FinTech..."
                    className="input w-full h-24 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Contact & Access */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-aifm-gold" />
                <h3 className="text-lg font-medium text-aifm-charcoal">Kontakt & Åtkomst</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                      Primär kontaktperson *
                    </label>
                    <HelpTooltip text="Huvudkontakten för fonden som kommer att ha administratörsrättigheter." />
                  </div>
                  <input
                    type="text"
                    value={formData.primaryContact}
                    onChange={(e) => handleInputChange('primaryContact', e.target.value)}
                    placeholder="Förnamn Efternamn"
                    className="input w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                        E-post *
                      </label>
                      <HelpTooltip text="E-postadressen som inbjudan och notifieringar kommer att skickas till." />
                    </div>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="namn@foretag.se"
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                        Telefon
                      </label>
                      <HelpTooltip text="Telefonnummer för kontakt vid brådskande ärenden." />
                    </div>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+46 70 123 45 67"
                      className="input w-full"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-aifm-charcoal/70 uppercase tracking-wider">
                      Åtkomstnivå *
                    </label>
                    <HelpTooltip text="Bestämmer vilka funktioner och data som kontaktpersonen har tillgång till." />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'full', label: 'Full åtkomst', desc: 'Alla funktioner' },
                      { value: 'standard', label: 'Standard', desc: 'Grundläggande funktioner' },
                      { value: 'readonly', label: 'Endast läsning', desc: 'Kan bara visa data' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleInputChange('accessLevel', option.value)}
                        className={`p-3 rounded-xl border-2 text-left transition-all
                          ${formData.accessLevel === option.value
                            ? 'border-aifm-gold bg-aifm-gold/5'
                            : 'border-gray-200 hover:border-aifm-gold/30'}`}
                      >
                        <p className={`text-sm font-medium ${formData.accessLevel === option.value ? 'text-aifm-gold' : 'text-aifm-charcoal'}`}>
                          {option.label}
                        </p>
                        <p className="text-xs text-aifm-charcoal/50 mt-0.5">{option.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Redo att skapa</p>
                    <p className="text-xs text-green-700 mt-1">
                      När du klickar &quot;Skapa bolag&quot; kommer en inbjudan att skickas till kontaktpersonen.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Navigation */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all
              ${currentStep === 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-aifm-charcoal hover:bg-white hover:shadow-md'}`}
          >
            <ArrowLeft className="w-4 h-4" />
            Tillbaka
          </button>

          <div className="flex items-center gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all
                  ${index === currentStep 
                    ? 'bg-aifm-gold w-6' 
                    : index < currentStep 
                      ? 'bg-green-500' 
                      : 'bg-gray-300'}`}
              />
            ))}
          </div>

          {currentStep === steps.length - 1 ? (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-2 bg-aifm-gold text-white rounded-xl 
                        hover:bg-aifm-gold/90 shadow-lg shadow-aifm-gold/25 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Skapa bolag
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-6 py-2 bg-aifm-charcoal text-white rounded-xl 
                        hover:bg-aifm-charcoal/90 transition-all"
            >
              Nästa
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Company Selector Dropdown with Search
function CompanySelector({ 
  selectedCompany, 
  companies, 
  onChange,
  onAddNew
}: { 
  selectedCompany: Company; 
  companies: Company[]; 
  onChange: (company: Company) => void;
  onAddNew: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter companies based on search
  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.orgNumber.includes(searchQuery)
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className="flex items-center gap-2">
      {/* Add New Button */}
      <button
        onClick={onAddNew}
        className="flex items-center gap-2 px-3 py-2.5 bg-aifm-gold text-white rounded-xl 
                   hover:bg-aifm-gold/90 shadow-lg shadow-aifm-gold/25 transition-all duration-300"
        title="Lägg till nytt bolag"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm font-medium hidden sm:inline">Nytt bolag</span>
      </button>

      {/* Dropdown */}
      <div ref={dropdownRef} className="relative">
        {/* Dropdown Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl 
                     hover:border-aifm-gold/50 hover:shadow-lg hover:shadow-aifm-gold/10
                     transition-all duration-300 group min-w-[280px]"
        >
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: selectedCompany.color + '15' }}
          >
            <Building2 className="w-4 h-4" style={{ color: selectedCompany.color }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-aifm-charcoal">{selectedCompany.shortName}</p>
            <p className="text-xs text-aifm-charcoal/50">{selectedCompany.orgNumber}</p>
          </div>
          <ChevronDown 
            className={`w-4 h-4 text-aifm-charcoal/40 transition-transform duration-300 
                       ${isOpen ? 'rotate-180' : ''} group-hover:text-aifm-gold`} 
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[340px] bg-white rounded-2xl 
                          border border-gray-100 shadow-2xl shadow-black/10 overflow-hidden z-50
                          animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Search Input */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/40" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Sök fond eller bolag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl
                            focus:outline-none focus:border-aifm-gold/50 focus:ring-2 focus:ring-aifm-gold/10
                            placeholder:text-aifm-charcoal/40 transition-all"
                />
              </div>
            </div>

            {/* Company List */}
            <div className="max-h-[320px] overflow-y-auto p-2">
              {filteredCompanies.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Search className="w-8 h-8 text-aifm-charcoal/20 mx-auto mb-2" />
                  <p className="text-sm text-aifm-charcoal/50">Ingen fond hittades</p>
                  <p className="text-xs text-aifm-charcoal/40 mt-1">Försök med ett annat sökord</p>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onAddNew();
                    }}
                    className="mt-3 text-sm text-aifm-gold hover:underline"
                  >
                    + Lägg till nytt bolag
                  </button>
                </div>
              ) : (
                filteredCompanies.map((company) => {
                  const isSelected = selectedCompany.id === company.id;
                  return (
                    <button
                      key={company.id}
                      onClick={() => {
                        onChange(company);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200
                                ${isSelected 
                                  ? 'bg-aifm-gold/10 border border-aifm-gold/30' 
                                  : 'hover:bg-gray-50 border border-transparent'}`}
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ 
                          backgroundColor: company.color + '15',
                          boxShadow: isSelected ? `0 4px 12px ${company.color}20` : 'none'
                        }}
                      >
                        <Building2 className="w-5 h-5" style={{ color: company.color }} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-medium ${isSelected ? 'text-aifm-gold' : 'text-aifm-charcoal'}`}>
                          {company.shortName}
                        </p>
                        <p className="text-xs text-aifm-charcoal/50">{company.name}</p>
                        <p className="text-[10px] text-aifm-charcoal/40 mt-0.5">Org.nr: {company.orgNumber}</p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 bg-aifm-gold rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <p className="text-[10px] text-aifm-charcoal/40 text-center">
                {companies.length} fonder tillgängliga • Sök på namn eller org.nr
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardLayout({ 
  children, 
  showCompanySelector = true,
  selectedCompany: externalSelectedCompany,
  onCompanyChange 
}: DashboardLayoutProps) {
  const [internalSelectedCompany, setInternalSelectedCompany] = useState<Company>(mockCompanies[0]);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  
  const selectedCompany = externalSelectedCompany || internalSelectedCompany;
  const handleCompanyChange = onCompanyChange || setInternalSelectedCompany;

  return (
    <div className="min-h-screen bg-white flex">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-h-screen ml-64">
        {/* Header with company selector */}
        {showCompanySelector && (
          <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
            <div className="px-6 py-4">
              {/* Centered dropdown and notification */}
              <div className="flex items-center justify-between">
                {/* Left spacer for centering */}
                <div className="w-10" />
                
                {/* Centered Company Dropdown with Add Button */}
                <CompanySelector
                  selectedCompany={selectedCompany}
                  companies={mockCompanies}
                  onChange={handleCompanyChange}
                  onAddNew={() => setShowOnboardingWizard(true)}
                />
                
                {/* Right side - notification */}
                <button className="relative p-2 text-aifm-charcoal/50 hover:text-aifm-gold hover:bg-aifm-gold/5 rounded-xl transition-all duration-200">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-aifm-gold rounded-full animate-pulse" />
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Main content area */}
        <div className="flex-1 p-6 bg-gradient-to-br from-gray-50 to-gray-100/50 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Onboarding Wizard Modal */}
      <OnboardingWizard 
        isOpen={showOnboardingWizard} 
        onClose={() => setShowOnboardingWizard(false)} 
      />
    </div>
  );
}
