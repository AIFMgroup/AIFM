'use client';

import { ReactNode, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, ChevronDown, Search, Check, Plus, X, Menu,
  HelpCircle, ArrowRight, ArrowLeft, CheckCircle2, Bell, Calendar, MessageSquare
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UnifiedSidebar } from './sidebars/UnifiedSidebar';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { CompanyProvider, useCompany } from './CompanyContext';
import { LoadingOverlay } from './LoadingOverlay';
import { MainHeader } from './MainHeader';
// import { ChatWidget } from './ChatWidget'; // Removed - replaced by FeedbackChat
import { NotificationPanel } from './NotificationPanel';
import { Company } from '@/lib/companyData';
import { UserProfileProvider, useUserProfile } from './UserProfileContext';
import { FavoritesProvider } from './FavoritesManager';
import { OnboardingChecklistProvider, OnboardingChecklistWidget } from './OnboardingChecklist';

interface DashboardLayoutProps {
  children: ReactNode;
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

// Minimal Onboarding Wizard Modal - Fixed Size
function OnboardingWizard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    companyName: '',
    shortName: '',
    orgNumber: '',
    fundType: '',
    registrationCountry: '',
    fundStructure: '',
    targetSize: '',
    currency: 'SEK',
    primaryContact: '',
    email: '',
  });

  const steps = ['Bolag', 'Struktur', 'Kontakt'];

  const fundTypes = [
    { value: 'venture', label: 'Venture Capital' },
    { value: 'growth', label: 'Growth Equity' },
    { value: 'buyout', label: 'Buyout' },
    { value: 'real_estate', label: 'Real Estate' },
    { value: 'infrastructure', label: 'Infrastructure' },
    { value: 'credit', label: 'Private Credit' },
  ];

  const countries = [
    { value: 'SE', label: 'Sverige' },
    { value: 'NO', label: 'Norge' },
    { value: 'DK', label: 'Danmark' },
    { value: 'FI', label: 'Finland' },
    { value: 'LU', label: 'Luxemburg' },
  ];

  const structures = [
    { value: 'kb', label: 'Kommanditbolag (KB)' },
    { value: 'ab', label: 'Aktiebolag (AB)' },
    { value: 'sicav', label: 'SICAV' },
    { value: 'raif', label: 'RAIF' },
  ];

  const currencies = [
    { value: 'SEK', label: 'SEK' },
    { value: 'EUR', label: 'EUR' },
    { value: 'USD', label: 'USD' },
    { value: 'NOK', label: 'NOK' },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => currentStep < steps.length - 1 && setCurrentStep(prev => prev + 1);
  const prevStep = () => currentStep > 0 && setCurrentStep(prev => prev - 1);

  const handleSubmit = () => {
    alert('Nytt bolag skapat! (Demo)');
    onClose();
    setCurrentStep(0);
    setFormData({
      companyName: '', shortName: '', orgNumber: '', fundType: '',
      registrationCountry: '', fundStructure: '', targetSize: '',
      currency: 'SEK', primaryContact: '', email: '',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Responsive container */}
      <div className="bg-white rounded-2xl w-full max-w-[720px] max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Minimal Header */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-medium text-aifm-charcoal">Nytt bolag</h2>
            <p className="text-xs text-aifm-charcoal/50 mt-0.5">Steg {currentStep + 1} av {steps.length}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-aifm-charcoal/50" />
          </button>
        </div>

        {/* Step Indicator - Minimal */}
        <div className="px-4 sm:px-8 py-3 border-b border-gray-50 flex-shrink-0">
          <div className="flex items-center gap-4 sm:gap-8">
            {steps.map((step, index) => (
              <button
                key={step}
                onClick={() => setCurrentStep(index)}
                className="flex items-center gap-2 group"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all
                  ${index === currentStep 
                    ? 'bg-aifm-charcoal text-white' 
                    : index < currentStep 
                      ? 'bg-aifm-charcoal/10 text-aifm-charcoal' 
                      : 'bg-gray-100 text-gray-400'}`}>
                  {index < currentStep ? <Check className="w-3 h-3" /> : index + 1}
                </div>
                <span className={`text-sm transition-colors hidden sm:inline ${index === currentStep ? 'text-aifm-charcoal font-medium' : 'text-aifm-charcoal/40'}`}>
                  {step}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area - Fixed Height with scroll if needed */}
        <div className="flex-1 px-4 sm:px-8 py-4 sm:py-6 overflow-y-auto">
          
          {/* Step 1: Company Info */}
          {currentStep === 0 && (
            <div className="space-y-4 sm:space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide">Bolagsnamn</label>
                  <HelpTooltip text="Det fullständiga juridiska namnet på bolaget." />
                </div>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="Nordic Ventures I AB"
                  className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-aifm-charcoal/10 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide">Kortnamn</label>
                    <HelpTooltip text="Kort namn som visas i gränssnittet." />
                  </div>
                  <input
                    type="text"
                    value={formData.shortName}
                    onChange={(e) => handleInputChange('shortName', e.target.value)}
                    placeholder="Nordic Ventures I"
                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-aifm-charcoal/10 transition-all"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide">Org.nummer</label>
                    <HelpTooltip text="Organisationsnummer (XXXXXX-XXXX)." />
                  </div>
                  <input
                    type="text"
                    value={formData.orgNumber}
                    onChange={(e) => handleInputChange('orgNumber', e.target.value)}
                    placeholder="559123-4567"
                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-aifm-charcoal/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide">Fondtyp</label>
                  <HelpTooltip text="Välj den typ av fond som bäst beskriver investeringsstrategin." />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {fundTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleInputChange('fundType', type.value)}
                      className={`px-3 py-2.5 rounded-xl text-sm transition-all
                        ${formData.fundType === type.value
                          ? 'bg-aifm-charcoal text-white'
                          : 'bg-gray-50 text-aifm-charcoal/70 hover:bg-gray-100'}`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Structure */}
          {currentStep === 1 && (
            <div className="space-y-4 sm:space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide">Registreringsland</label>
                  <HelpTooltip text="Landet där fonden är juridiskt registrerad." />
                </div>
                <div className="flex flex-wrap gap-2">
                  {countries.map((country) => (
                    <button
                      key={country.value}
                      type="button"
                      onClick={() => handleInputChange('registrationCountry', country.value)}
                      className={`px-4 py-2.5 rounded-xl text-sm transition-all
                        ${formData.registrationCountry === country.value
                          ? 'bg-aifm-charcoal text-white'
                          : 'bg-gray-50 text-aifm-charcoal/70 hover:bg-gray-100'}`}
                    >
                      {country.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide">Fondstruktur</label>
                  <HelpTooltip text="Den juridiska strukturen som fonden är organiserad under." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {structures.map((struct) => (
                    <button
                      key={struct.value}
                      type="button"
                      onClick={() => handleInputChange('fundStructure', struct.value)}
                      className={`px-4 py-3 rounded-xl text-sm text-left transition-all
                        ${formData.fundStructure === struct.value
                          ? 'bg-aifm-charcoal text-white'
                          : 'bg-gray-50 text-aifm-charcoal/70 hover:bg-gray-100'}`}
                    >
                      {struct.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide">Målstorlek (MSEK)</label>
                    <HelpTooltip text="Fondens målstorlek i miljoner." />
                  </div>
                  <input
                    type="number"
                    value={formData.targetSize}
                    onChange={(e) => handleInputChange('targetSize', e.target.value)}
                    placeholder="500"
                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-aifm-charcoal/10 transition-all"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide">Valuta</label>
                    <HelpTooltip text="Fondens redovisningsvaluta." />
                  </div>
                  <div className="flex gap-2">
                    {currencies.map((curr) => (
                      <button
                        key={curr.value}
                        type="button"
                        onClick={() => handleInputChange('currency', curr.value)}
                        className={`flex-1 py-3 rounded-xl text-sm transition-all
                          ${formData.currency === curr.value
                            ? 'bg-aifm-charcoal text-white'
                            : 'bg-gray-50 text-aifm-charcoal/70 hover:bg-gray-100'}`}
                      >
                        {curr.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Contact */}
          {currentStep === 2 && (
            <div className="space-y-4 sm:space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide">Kontaktperson</label>
                  <HelpTooltip text="Huvudkontakten som får administratörsrättigheter." />
                </div>
                <input
                  type="text"
                  value={formData.primaryContact}
                  onChange={(e) => handleInputChange('primaryContact', e.target.value)}
                  placeholder="Anna Andersson"
                  className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-aifm-charcoal/10 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wide">E-post</label>
                  <HelpTooltip text="Inbjudan skickas till denna adress." />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="anna@foretag.se"
                  className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-aifm-charcoal/10 transition-all"
                />
              </div>

              <div className="mt-4 sm:mt-6 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-aifm-charcoal/30 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-aifm-charcoal/70">Redo att skapa</p>
                    <p className="text-xs text-aifm-charcoal/50 mt-1">
                      En inbjudan skickas till kontaktpersonen när bolaget skapas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="px-4 sm:px-8 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className={`px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2
              ${currentStep === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-aifm-charcoal/60 hover:text-aifm-charcoal hover:bg-white'}`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Tillbaka</span>
          </button>

          <div className="flex items-center gap-1.5">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${index === currentStep ? 'w-6 bg-aifm-charcoal' : 'w-1.5 bg-gray-200'}`}
              />
            ))}
          </div>

          {currentStep === steps.length - 1 ? (
            <button
              onClick={handleSubmit}
              className="px-4 sm:px-6 py-2 bg-aifm-charcoal text-white rounded-xl text-sm font-medium hover:bg-aifm-charcoal/90 transition-all"
            >
              Skapa bolag
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="px-4 sm:px-6 py-2 bg-aifm-charcoal text-white rounded-xl text-sm font-medium hover:bg-aifm-charcoal/90 transition-all flex items-center gap-2"
            >
              <span className="hidden sm:inline">Nästa</span>
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
        <span className="text-sm font-medium hidden lg:inline">Nytt bolag</span>
      </button>

      {/* Dropdown */}
      <div ref={dropdownRef} className="relative">
        {/* Dropdown Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-white border border-gray-200 rounded-xl 
                     hover:border-aifm-gold/50 hover:shadow-lg hover:shadow-aifm-gold/10
                     transition-all duration-300 group min-w-0 sm:min-w-[280px]"
        >
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: selectedCompany.color + '15' }}
          >
            <Building2 className="w-4 h-4" style={{ color: selectedCompany.color }} />
          </div>
          <div className="flex-1 text-left hidden sm:block">
            <p className="text-sm font-medium text-aifm-charcoal truncate">{selectedCompany.shortName}</p>
            <p className="text-xs text-aifm-charcoal/50">{selectedCompany.orgNumber}</p>
          </div>
          <ChevronDown 
            className={`w-4 h-4 text-aifm-charcoal/40 transition-transform duration-300 
                       ${isOpen ? 'rotate-180' : ''} group-hover:text-aifm-gold`} 
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full right-0 sm:left-1/2 sm:-translate-x-1/2 mt-2 w-[300px] sm:w-[340px] bg-white rounded-2xl 
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
                      <div className="flex-1 text-left min-w-0">
                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-aifm-gold' : 'text-aifm-charcoal'}`}>
                          {company.shortName}
                        </p>
                        <p className="text-xs text-aifm-charcoal/50 truncate">{company.name}</p>
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

// Collapsible Company Header
function CollapsibleCompanyHeader({ 
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
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative">
      {/* Collapsed view - just a toggle button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-white border border-gray-200 rounded-xl 
                     hover:border-aifm-gold/50 hover:shadow-lg hover:shadow-aifm-gold/10
                     transition-all duration-300 group"
        >
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: selectedCompany.color + '15' }}
          >
            <Building2 className="w-4 h-4" style={{ color: selectedCompany.color }} />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-aifm-charcoal">{selectedCompany.shortName}</p>
            <p className="text-xs text-aifm-charcoal/50">{selectedCompany.orgNumber}</p>
          </div>
          {/* Pulsating expand arrow */}
          <ChevronDown className="w-4 h-4 text-aifm-gold animate-bounce" />
        </button>
      )}

      {/* Expanded view - full company selector */}
      {isExpanded && (
        <div className="flex items-center gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <CompanySelector
            selectedCompany={selectedCompany}
            companies={companies}
            onChange={(company) => {
              onChange(company);
            }}
            onAddNew={onAddNew}
          />
          {/* Collapse button */}
          <button
            onClick={() => setIsExpanded(false)}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            title="Minimera"
          >
            <ChevronDown className="w-4 h-4 text-aifm-charcoal/50 rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
}

// Global Search Bar Component
function GlobalSearchBar() {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [groups, setGroups] = useState<Array<{ label: string; items: Array<{ type: string; title: string; subtitle?: string; href: string; score: number }> }>>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  const flatItems = useMemo(() => {
    const out: Array<{ kind: 'suggestion' | 'result'; title: string; href?: string }> = [];
    if (searchQuery.trim().length >= 4) {
      for (const s of suggestions) out.push({ kind: 'suggestion', title: s });
    }
    for (const g of groups) {
      for (const it of g.items) out.push({ kind: 'result', title: it.title, href: it.href });
    }
    return out;
  }, [groups, searchQuery, suggestions]);

  const runSearch = useCallback(async (q: string) => {
    const query = q.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setGroups([]);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&companyId=${encodeURIComponent(selectedCompany?.id || '')}`, {
        signal: ac.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setGroups(Array.isArray(data.groups) ? data.groups : []);
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return;
      setSuggestions([]);
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompany?.id]);

  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      runSearch(searchQuery);
    }, 180);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [isOpen, runSearch, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onSubmit = useCallback(() => {
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setIsOpen(false);
    setActiveIndex(-1);
  }, [router, searchQuery]);

  return (
    <div ref={wrapperRef} className="relative flex-1 max-w-xl">
      <div className="relative transition-all duration-300">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-aifm-charcoal/30" />
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="Sök i allt… (CRM, datarum, bokföring)"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setActiveIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              setActiveIndex(-1);
              return;
            }
            if (e.key === 'Enter') {
              // If user selected an item, go there; otherwise go to full search page
              const item = flatItems[activeIndex];
              if (item?.kind === 'result' && item.href) {
                router.push(item.href);
                setIsOpen(false);
                setActiveIndex(-1);
                return;
              }
              if (item?.kind === 'suggestion') {
                setSearchQuery(item.title);
                setActiveIndex(-1);
                runSearch(item.title);
                return;
              }
              onSubmit();
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIsOpen(true);
              setActiveIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((prev) => Math.max(prev - 1, -1));
              return;
            }
          }}
          className="w-full pl-12 pr-12 py-3 bg-white border border-gray-200/80 rounded-2xl
                     text-sm text-aifm-charcoal placeholder:text-aifm-charcoal/40
                     focus:outline-none focus:border-aifm-gold/50 focus:ring-4 focus:ring-aifm-gold/10
                     shadow-sm hover:shadow-md transition-all duration-300"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <button
            type="button"
            onClick={onSubmit}
            className="p-1.5 bg-aifm-gold/10 rounded-xl hover:bg-aifm-gold/20 transition-colors"
            title="Sök"
          >
            <Search className="h-4 w-4 text-aifm-gold" />
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (searchQuery.trim().length >= 2 || isLoading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-black/10 overflow-hidden z-50">
          {isLoading && (
            <div className="px-4 py-3 text-xs text-aifm-charcoal/50 bg-gray-50/50">
              Söker…
            </div>
          )}

          {searchQuery.trim().length >= 4 && suggestions.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="px-4 pt-3 pb-2 text-[10px] font-semibold text-aifm-charcoal/40 uppercase tracking-wider">
                Förslag
              </div>
              <div className="px-2 pb-2">
                {suggestions.slice(0, 6).map((s, idx) => {
                  const index = idx; // suggestions are first in flat list
                  const active = activeIndex === index;
                  return (
                    <button
                      key={s}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => {
                        setSearchQuery(s);
                        setActiveIndex(-1);
                        runSearch(s);
                        inputRef.current?.focus();
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                        active ? 'bg-aifm-gold/10 text-aifm-charcoal' : 'hover:bg-gray-50 text-aifm-charcoal/80'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="max-h-[420px] overflow-y-auto">
            {groups.length === 0 && !isLoading ? (
              <div className="px-4 py-10 text-center">
                <Search className="w-10 h-10 text-aifm-charcoal/10 mx-auto mb-3" />
                <p className="text-sm text-aifm-charcoal/60">Inga träffar</p>
                <p className="text-xs text-aifm-charcoal/40 mt-1">Testa ett annat sökord</p>
              </div>
            ) : (
              groups.map((g, gi) => {
                // Compute offset for activeIndex mapping
                const suggestionOffset = searchQuery.trim().length >= 4 ? suggestions.length : 0;
                const groupStart = groups
                  .slice(0, gi)
                  .reduce((acc, gg) => acc + gg.items.length, 0);
                return (
                  <div key={g.label} className="py-2">
                    <div className="px-4 py-1 text-[10px] font-semibold text-aifm-charcoal/40 uppercase tracking-wider">
                      {g.label}
                    </div>
                    <div className="px-2">
                      {g.items.slice(0, 12).map((it, ii) => {
                        const index = suggestionOffset + groupStart + ii;
                        const active = activeIndex === index;
                        return (
                          <button
                            key={`${it.type}-${it.href}-${it.title}`}
                            type="button"
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => {
                              router.push(it.href);
                              setIsOpen(false);
                              setActiveIndex(-1);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl transition-colors ${
                              active ? 'bg-aifm-gold/10' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-aifm-charcoal truncate">{it.title}</p>
                                {it.subtitle && (
                                  <p className="text-xs text-aifm-charcoal/50 truncate">{it.subtitle}</p>
                                )}
                              </div>
                              <ArrowRight className={`w-4 h-4 flex-shrink-0 ${active ? 'text-aifm-gold' : 'text-aifm-charcoal/20'}`} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <span className="text-[10px] text-aifm-charcoal/40">Enter: öppna • ↑↓: navigera • Esc: stäng</span>
            <button
              type="button"
              onClick={onSubmit}
              className="text-[11px] text-aifm-gold font-medium hover:underline"
            >
              Visa alla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Profile Menu Component
function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { profile, avatarSrc } = useUserProfile();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 pl-3 pr-1 py-1 rounded-full bg-white border border-gray-100 
                   hover:border-aifm-gold/30 hover:shadow-lg hover:shadow-aifm-gold/10 transition-all duration-300"
      >
        <span className="text-sm font-medium text-aifm-charcoal hidden sm:inline">
          {profile?.title ? `${profile.title}` : 'Profil'}
        </span>
        <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-aifm-gold/20 bg-gradient-to-br from-aifm-gold to-aifm-gold/70 flex items-center justify-center">
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-semibold text-sm">
              {(profile?.displayName || profile?.email || 'A').slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl border border-gray-100 
                        shadow-2xl shadow-black/10 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Profile Header */}
          <a href="/settings?tab=profile" className="block p-4 border-b border-gray-100 bg-gradient-to-r from-aifm-gold/5 to-transparent hover:from-aifm-gold/10 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-aifm-gold to-aifm-gold/70 flex items-center justify-center">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-semibold">
                    {(profile?.displayName || profile?.email || 'A').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium text-aifm-charcoal">{profile?.displayName || 'Min profil'}</p>
                <p className="text-xs text-aifm-charcoal/50">{profile?.title ? `${profile.title} • ` : ''}{profile?.email || ''}</p>
              </div>
            </div>
          </a>
          
          {/* Menu Items */}
          <div className="p-2">
            <a href="/settings?tab=profile" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-aifm-charcoal/70 hover:bg-gray-50 hover:text-aifm-charcoal transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-aifm-charcoal/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Min profil</p>
                <p className="text-xs text-aifm-charcoal/40">Redigera bild och info</p>
              </div>
            </a>
            
            <a href="/settings?tab=account" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-aifm-charcoal/70 hover:bg-gray-50 hover:text-aifm-charcoal transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-aifm-charcoal/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Inställningar</p>
                <p className="text-xs text-aifm-charcoal/40">Konto och säkerhet</p>
              </div>
            </a>
            
            <a href="/settings?tab=security" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-aifm-charcoal/70 hover:bg-gray-50 hover:text-aifm-charcoal transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-aifm-charcoal/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Byt lösenord</p>
                <p className="text-xs text-aifm-charcoal/40">Uppdatera lösenord</p>
              </div>
            </a>
          </div>
          
          {/* Logout */}
          <div className="p-2 border-t border-gray-100">
            <a href="/auth/logout" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <p className="font-medium">Logga ut</p>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// Calendar Quick Panel
function CalendarQuickPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mock upcoming events
  const upcomingEvents = [
    { id: '1', title: 'Kundmöte: Nordea', time: '14:00', date: 'Idag', type: 'meeting' },
    { id: '2', title: 'Deadline: Kvartalsrapport', time: '17:00', date: 'Idag', type: 'deadline' },
    { id: '3', title: 'Uppföljning: Scania AB', time: '10:00', date: 'Imorgon', type: 'call' },
  ];

  return (
    <div ref={panelRef} className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl transition-all duration-200 ${
          isOpen 
            ? 'text-aifm-gold bg-aifm-gold/10' 
            : 'text-aifm-charcoal/40 hover:text-aifm-gold hover:bg-aifm-gold/5'
        }`}
      >
        <Calendar className="w-5 h-5" />
        {upcomingEvents.length > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-aifm-gold rounded-full" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-aifm-charcoal">Kommande händelser</h3>
            <button 
              onClick={() => {
                setIsOpen(false);
                router.push('/crm/calendar');
              }}
              className="text-xs text-aifm-gold hover:underline"
            >
              Visa kalender →
            </button>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {upcomingEvents.length === 0 ? (
              <div className="py-8 text-center">
                <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Inga kommande händelser</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => {
                      setIsOpen(false);
                      router.push('/crm/calendar');
                    }}
                    className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        event.type === 'meeting' ? 'bg-blue-500' :
                        event.type === 'deadline' ? 'bg-red-500' : 'bg-green-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                        <p className="text-xs text-gray-500">{event.date} kl {event.time}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/crm/calendar?new=true');
              }}
              className="w-full py-2 text-sm font-medium text-aifm-gold hover:text-aifm-gold/80 transition-colors"
            >
              + Ny händelse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Messages Quick Panel
function MessagesQuickPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mock messages
  const messages = [
    { id: '1', from: 'Anna Svensson', preview: 'Har du hunnit granska avtalet?', time: '10 min sedan', unread: true, avatar: 'AS' },
    { id: '2', from: 'Erik Johansson', preview: 'Tack för informationen!', time: '1 tim sedan', unread: true, avatar: 'EJ' },
    { id: '3', from: 'Maria Lindgren', preview: 'Mötet är flyttat till fredag', time: '3 tim sedan', unread: false, avatar: 'ML' },
  ];

  const unreadCount = messages.filter(m => m.unread).length;

  return (
    <div ref={panelRef} className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl transition-all duration-200 ${
          isOpen 
            ? 'text-aifm-gold bg-aifm-gold/10' 
            : 'text-aifm-charcoal/40 hover:text-aifm-gold hover:bg-aifm-gold/5'
        }`}
      >
        <MessageSquare className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-aifm-gold text-white 
                         text-[10px] font-semibold rounded-full flex items-center justify-center shadow-lg shadow-aifm-gold/30">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-aifm-charcoal">Meddelanden</h3>
            <span className="text-xs text-gray-400">{unreadCount} olästa</span>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Inga meddelanden</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {messages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => {
                      setIsOpen(false);
                      // Navigate to messages or chat
                      router.push('/crm/activities');
                    }}
                    className={`w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                      msg.unread ? 'bg-aifm-gold/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c0a280] to-[#2d2a26] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                        {msg.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${msg.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {msg.from}
                          </p>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">{msg.time}</span>
                        </div>
                        <p className={`text-xs truncate ${msg.unread ? 'text-gray-700' : 'text-gray-500'}`}>
                          {msg.preview}
                        </p>
                      </div>
                      {msg.unread && (
                        <div className="w-2 h-2 bg-aifm-gold rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/crm/activities');
              }}
              className="w-full py-2 text-sm font-medium text-aifm-gold hover:text-aifm-gold/80 transition-colors"
            >
              Visa alla meddelanden →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Notification Icons Group
function NotificationIconsGroup() {
  return (
    <div className="flex items-center gap-1">
      {/* Calendar Quick Panel */}
      <CalendarQuickPanel />
      
      {/* Messages Quick Panel */}
      <MessagesQuickPanel />
      
      {/* Notifications Bell - use existing component */}
      <NotificationPanel />
    </div>
  );
}

// Mobile Sidebar Drawer
function MobileSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 lg:hidden transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="relative h-full">
          <UnifiedSidebar />
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg"
          >
            <X className="w-5 h-5 text-aifm-charcoal" />
          </button>
        </div>
      </div>
    </>
  );
}

// Inner layout component that uses the sidebar context
function DashboardLayoutInner({ 
  children, 
  selectedCompany: externalSelectedCompany,
  onCompanyChange 
}: DashboardLayoutProps) {
  const { selectedCompany: contextCompany, switchCompany, companies } = useCompany();
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { collapsed } = useSidebar();
  
  // Use external props if provided, otherwise use context
  const selectedCompany = externalSelectedCompany || contextCompany;
  const handleCompanyChange = onCompanyChange || switchCompany;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Main Header with Pillar Navigation - always visible */}
      <MainHeader />
      
      <div className="flex flex-1">
        {/* Desktop Sidebar - Fixed position */}
        <div className="hidden lg:block fixed left-0 top-0 h-screen z-40">
          <UnifiedSidebar />
        </div>
        
        {/* Mobile Sidebar */}
        <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        
        {/* Main content - needs left margin to account for fixed sidebar on desktop */}
        <main className={`flex-1 flex flex-col min-h-[calc(100vh-64px)] transition-all duration-300 ease-in-out overflow-x-hidden
          ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-64'}`}>
          {/* Mobile menu button */}
          <div className="lg:hidden px-4 py-2 border-b border-gray-100">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-aifm-charcoal/70 hover:text-aifm-charcoal hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {/* Main content area */}
          <div className="flex-1 p-2 sm:p-4 bg-white overflow-auto">
            <div className="w-full">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Onboarding Wizard Modal */}
      <OnboardingWizard 
        isOpen={showOnboardingWizard} 
        onClose={() => setShowOnboardingWizard(false)} 
      />
      
      {/* Loading Overlay */}
      <LoadingOverlay />
      
      {/* Onboarding Checklist Widget */}
      <OnboardingChecklistWidget />
      
      {/* Chat Widget removed - replaced by FeedbackChat on accounting pages */}
      {/* <ChatWidget /> */}
    </div>
  );
}

// Main export that wraps with all required providers
export function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <UserProfileProvider>
      <CompanyProvider>
        <FavoritesProvider>
          <OnboardingChecklistProvider>
            <SidebarProvider>
              <DashboardLayoutInner {...props} />
            </SidebarProvider>
          </OnboardingChecklistProvider>
        </FavoritesProvider>
      </CompanyProvider>
    </UserProfileProvider>
  );
}
