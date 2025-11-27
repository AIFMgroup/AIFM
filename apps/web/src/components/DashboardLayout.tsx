'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { Bell, Building2, ChevronDown, Search, Check } from 'lucide-react';
import { DashboardSidebar } from './DashboardSidebar';
import { mockCompanies, Company } from '@/lib/companyData';

interface DashboardLayoutProps {
  children: ReactNode;
  showCompanySelector?: boolean;
  selectedCompany?: Company;
  onCompanyChange?: (company: Company) => void;
}

// Company Selector Dropdown with Search
function CompanySelector({ 
  selectedCompany, 
  companies, 
  onChange 
}: { 
  selectedCompany: Company; 
  companies: Company[]; 
  onChange: (company: Company) => void;
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
  );
}

export function DashboardLayout({ 
  children, 
  showCompanySelector = true,
  selectedCompany: externalSelectedCompany,
  onCompanyChange 
}: DashboardLayoutProps) {
  const [internalSelectedCompany, setInternalSelectedCompany] = useState<Company>(mockCompanies[0]);
  
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
                
                {/* Centered Company Dropdown */}
                <CompanySelector
                  selectedCompany={selectedCompany}
                  companies={mockCompanies}
                  onChange={handleCompanyChange}
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
    </div>
  );
}
