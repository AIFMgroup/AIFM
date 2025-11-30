'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { 
  Bell, Building2, ChevronDown, Search, Check, Plus, X, Menu,
  HelpCircle, ArrowRight, ArrowLeft, CheckCircle2
} from 'lucide-react';
import { DashboardSidebar } from './DashboardSidebar';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { useCompany } from './CompanyContext';
import { LoadingOverlay } from './LoadingOverlay';
import { ChatWidget } from './ChatWidget';
import { Company } from '@/lib/companyData';

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
          <DashboardSidebar />
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
    <div className="min-h-screen bg-white flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <DashboardSidebar />
      </div>
      
      {/* Mobile Sidebar */}
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out lg:${collapsed ? 'ml-[72px]' : 'ml-56'}`}>
        {/* Header with company selector - ALWAYS visible */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
          <div className="px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              {/* Mobile menu button */}
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 text-aifm-charcoal/70 hover:text-aifm-charcoal hover:bg-gray-100 rounded-xl transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              
              {/* Left spacer for centering (desktop only) */}
              <div className="hidden lg:block w-10" />
              
              {/* Centered Collapsible Company Header */}
              <CollapsibleCompanyHeader
                selectedCompany={selectedCompany}
                companies={companies}
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

        {/* Main content area */}
        <div className="flex-1 p-4 sm:p-6 bg-gradient-to-br from-gray-50 to-gray-100/50 overflow-auto">
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
      
      {/* Loading Overlay */}
      <LoadingOverlay />
      
      {/* Chat Widget - Global Help Assistant */}
      <ChatWidget />
    </div>
  );
}

// Main export that wraps with SidebarProvider
export function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardLayoutInner {...props} />
    </SidebarProvider>
  );
}
