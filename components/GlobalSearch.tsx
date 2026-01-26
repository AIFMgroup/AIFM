'use client';

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, Transition, Combobox } from '@headlessui/react';
import {
  Search, Building2, Users, User, Briefcase, Scale, FileText,
  ChevronRight, Clock, ArrowRight, Hash, Mail, Phone,
  Calendar, CheckSquare, DollarSign, X, Command, Loader2
} from 'lucide-react';
import { mockCompanies, Company } from '@/lib/companyData';

// ============================================================================
// Types
// ============================================================================

interface SearchResult {
  id: string;
  type: 'company' | 'contact' | 'crm_company' | 'deal' | 'task' | 'document' | 'compliance' | 'page';
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  href: string;
  pillar: 'bolag' | 'crm' | 'compliance' | 'system';
  meta?: string;
}

interface SearchGroup {
  name: string;
  results: SearchResult[];
}

// ============================================================================
// Mock Data & Search Logic
// ============================================================================

// Quick access pages
const QUICK_PAGES: SearchResult[] = [
  { id: 'page-overview', type: 'page', title: 'Översikt', subtitle: 'Bolagsöversikt', icon: Building2, href: '/overview', pillar: 'bolag' },
  { id: 'page-crm', type: 'page', title: 'CRM Dashboard', subtitle: 'Kunder och affärer', icon: Users, href: '/crm', pillar: 'crm' },
  { id: 'page-contacts', type: 'page', title: 'Kontakter', subtitle: 'Alla kontakter', icon: User, href: '/crm/contacts', pillar: 'crm' },
  { id: 'page-pipeline', type: 'page', title: 'Pipeline', subtitle: 'Affärsöversikt', icon: DollarSign, href: '/crm/pipeline', pillar: 'crm' },
  { id: 'page-tasks', type: 'page', title: 'Uppgifter', subtitle: 'Alla uppgifter', icon: CheckSquare, href: '/crm/tasks', pillar: 'crm' },
  { id: 'page-calendar', type: 'page', title: 'Kalender', subtitle: 'Möten och aktiviteter', icon: Calendar, href: '/crm/calendar', pillar: 'crm' },
  { id: 'page-compliance', type: 'page', title: 'Compliance Manager', subtitle: 'Regelverk och compliance', icon: Scale, href: '/?view=compliance', pillar: 'compliance' },
  { id: 'page-datarooms', type: 'page', title: 'Datarum', subtitle: 'Dokument och filer', icon: FileText, href: '/data-rooms', pillar: 'bolag' },
  { id: 'page-investors', type: 'page', title: 'Investerare', subtitle: 'Investerarregister', icon: Users, href: '/investors', pillar: 'bolag' },
  { id: 'page-accounting', type: 'page', title: 'Bokföring', subtitle: 'Redovisning', icon: Hash, href: '/accounting/dashboard', pillar: 'bolag' },
];

// Mock contacts for search
const MOCK_CONTACTS: SearchResult[] = [
  { id: 'contact-1', type: 'contact', title: 'Anna Svensson', subtitle: 'VD, Nordic AB', icon: User, href: '/crm/contacts/contact-1', pillar: 'crm', meta: 'anna@nordic.se' },
  { id: 'contact-2', type: 'contact', title: 'Erik Johansson', subtitle: 'CFO, Tech Solutions', icon: User, href: '/crm/contacts/contact-2', pillar: 'crm', meta: 'erik@techsolutions.se' },
  { id: 'contact-3', type: 'contact', title: 'Maria Lindgren', subtitle: 'Partner, Invest AB', icon: User, href: '/crm/contacts/contact-3', pillar: 'crm', meta: 'maria@invest.se' },
  { id: 'contact-4', type: 'contact', title: 'Johan Andersson', subtitle: 'CEO, Growth Partners', icon: User, href: '/crm/contacts/contact-4', pillar: 'crm', meta: 'johan@growth.se' },
  { id: 'contact-5', type: 'contact', title: 'Sara Nilsson', subtitle: 'Investor Relations', icon: User, href: '/crm/contacts/contact-5', pillar: 'crm', meta: 'sara@capital.se' },
];

// Mock CRM companies for search
const MOCK_CRM_COMPANIES: SearchResult[] = [
  { id: 'crm-1', type: 'crm_company', title: 'Nordic AB', subtitle: 'Kund • Stockholm', icon: Briefcase, href: '/crm/companies/crm-1', pillar: 'crm' },
  { id: 'crm-2', type: 'crm_company', title: 'Tech Solutions AB', subtitle: 'Prospekt • Göteborg', icon: Briefcase, href: '/crm/companies/crm-2', pillar: 'crm' },
  { id: 'crm-3', type: 'crm_company', title: 'Invest Capital', subtitle: 'Partner • Malmö', icon: Briefcase, href: '/crm/companies/crm-3', pillar: 'crm' },
  { id: 'crm-4', type: 'crm_company', title: 'Growth Partners', subtitle: 'Lead • Uppsala', icon: Briefcase, href: '/crm/companies/crm-4', pillar: 'crm' },
];

// Mock deals
const MOCK_DEALS: SearchResult[] = [
  { id: 'deal-1', type: 'deal', title: 'Enterprise License', subtitle: 'Nordic AB • 500 000 SEK', icon: DollarSign, href: '/crm/pipeline?deal=deal-1', pillar: 'crm', meta: 'Negotiation' },
  { id: 'deal-2', type: 'deal', title: 'Konsultuppdrag Q1', subtitle: 'Tech Solutions • 250 000 SEK', icon: DollarSign, href: '/crm/pipeline?deal=deal-2', pillar: 'crm', meta: 'Proposal' },
  { id: 'deal-3', type: 'deal', title: 'Nytt avtal 2026', subtitle: 'Invest Capital • 1 200 000 SEK', icon: DollarSign, href: '/crm/pipeline?deal=deal-3', pillar: 'crm', meta: 'Won' },
];

// Compliance documents
const MOCK_COMPLIANCE_DOCS: SearchResult[] = [
  { id: 'doc-1', type: 'compliance', title: 'AIFM-manual 2025', subtitle: 'Senast uppdaterad: 2025-12-15', icon: FileText, href: '/?view=compliance&tab=documents', pillar: 'compliance' },
  { id: 'doc-2', type: 'compliance', title: 'KYC-policy', subtitle: 'Regelverk • Compliance', icon: Scale, href: '/?view=compliance&tab=documents', pillar: 'compliance' },
  { id: 'doc-3', type: 'compliance', title: 'AML-riskbedömning', subtitle: 'Senast uppdaterad: 2025-10-30', icon: FileText, href: '/?view=compliance&tab=documents', pillar: 'compliance' },
  { id: 'doc-4', type: 'compliance', title: 'SFDR Artikel 8', subtitle: 'Hållbarhetsrapportering', icon: Scale, href: '/?view=compliance&tab=archive', pillar: 'compliance' },
];

// Convert managed companies to search results
const MANAGED_COMPANIES: SearchResult[] = mockCompanies.map(c => ({
  id: `company-${c.id}`,
  type: 'company' as const,
  title: c.name,
  subtitle: `${c.type} • ${c.orgNumber}`,
  icon: Building2,
  href: '/overview',
  pillar: 'bolag' as const,
}));

// Search function
function searchAll(query: string): SearchGroup[] {
  const q = query.toLowerCase().trim();
  
  if (!q) {
    // Show recent/suggested items when no query
    return [
      { name: 'Snabbnavigering', results: QUICK_PAGES.slice(0, 5) },
      { name: 'Förvaltade bolag', results: MANAGED_COMPANIES.slice(0, 3) },
    ];
  }

  const results: SearchGroup[] = [];
  
  // Search pages
  const pageResults = QUICK_PAGES.filter(p => 
    p.title.toLowerCase().includes(q) || 
    p.subtitle?.toLowerCase().includes(q)
  );
  if (pageResults.length > 0) {
    results.push({ name: 'Sidor', results: pageResults });
  }

  // Search managed companies
  const companyResults = MANAGED_COMPANIES.filter(c => 
    c.title.toLowerCase().includes(q) || 
    c.subtitle?.toLowerCase().includes(q)
  );
  if (companyResults.length > 0) {
    results.push({ name: 'Förvaltade bolag', results: companyResults });
  }

  // Search CRM companies
  const crmCompanyResults = MOCK_CRM_COMPANIES.filter(c => 
    c.title.toLowerCase().includes(q) || 
    c.subtitle?.toLowerCase().includes(q)
  );
  if (crmCompanyResults.length > 0) {
    results.push({ name: 'CRM-företag', results: crmCompanyResults });
  }

  // Search contacts
  const contactResults = MOCK_CONTACTS.filter(c => 
    c.title.toLowerCase().includes(q) || 
    c.subtitle?.toLowerCase().includes(q) ||
    c.meta?.toLowerCase().includes(q)
  );
  if (contactResults.length > 0) {
    results.push({ name: 'Kontakter', results: contactResults });
  }

  // Search deals
  const dealResults = MOCK_DEALS.filter(d => 
    d.title.toLowerCase().includes(q) || 
    d.subtitle?.toLowerCase().includes(q)
  );
  if (dealResults.length > 0) {
    results.push({ name: 'Affärer', results: dealResults });
  }

  // Search compliance docs
  const complianceResults = MOCK_COMPLIANCE_DOCS.filter(d => 
    d.title.toLowerCase().includes(q) || 
    d.subtitle?.toLowerCase().includes(q)
  );
  if (complianceResults.length > 0) {
    results.push({ name: 'Compliance', results: complianceResults });
  }

  return results;
}

// ============================================================================
// Pillar Badge Component
// ============================================================================

function PillarBadge({ pillar }: { pillar: SearchResult['pillar'] }) {
  const config = {
    bolag: { label: 'Bolag', color: 'bg-blue-100 text-blue-700' },
    crm: { label: 'CRM', color: 'bg-purple-100 text-purple-700' },
    compliance: { label: 'Compliance', color: 'bg-amber-100 text-amber-700' },
    system: { label: 'System', color: 'bg-gray-100 text-gray-700' },
  };

  const { label, color } = config[pillar];

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${color}`}>
      {label}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchGroup[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    // Listen for custom event from KeyboardShortcutsProvider
    function handleOpenSearch() {
      setIsOpen(true);
    }
    
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('openGlobalSearch', handleOpenSearch);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('openGlobalSearch', handleOpenSearch);
    };
  }, []);

  // Search when query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSearching(true);
      const searchResults = searchAll(query);
      setResults(searchResults);
      setIsSearching(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Reset query when closing
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setQuery(''), 200);
    }
  }, [isOpen]);

  const handleSelect = (result: SearchResult | null) => {
    if (result) {
      router.push(result.href);
      setIsOpen(false);
    }
  };

  // Flatten results for combobox
  const flatResults = results.flatMap(g => g.results);

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Sök...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-white border border-gray-200 rounded text-gray-400">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>

      {/* Search Dialog */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[100]" onClose={setIsOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-start justify-center p-4 pt-[15vh]">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95 translate-y-4"
                enterTo="opacity-100 scale-100 translate-y-0"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100 translate-y-0"
                leaveTo="opacity-0 scale-95 translate-y-4"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                  <Combobox onChange={handleSelect}>
                    {/* Search Input */}
                    <div className="relative border-b border-gray-100">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Combobox.Input
                        ref={inputRef}
                        className="w-full py-4 pl-12 pr-12 text-lg text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
                        placeholder="Sök bolag, kontakter, affärer..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoComplete="off"
                      />
                      {query && (
                        <button
                          onClick={() => setQuery('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Results */}
                    <Combobox.Options static className="max-h-[60vh] overflow-y-auto p-2">
                      {isSearching ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-6 h-6 text-[#c0a280] animate-spin" />
                        </div>
                      ) : results.length === 0 && query ? (
                        <div className="py-12 text-center">
                          <Search className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                          <p className="text-gray-500">Inga resultat för "{query}"</p>
                          <p className="text-sm text-gray-400 mt-1">Försök med ett annat sökord</p>
                        </div>
                      ) : (
                        results.map((group) => (
                          <div key={group.name} className="mb-4 last:mb-0">
                            <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              {group.name}
                            </p>
                            {group.results.map((result) => (
                              <Combobox.Option
                                key={result.id}
                                value={result}
                                className={({ active }) =>
                                  `flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                                    active ? 'bg-gray-100' : ''
                                  }`
                                }
                              >
                                {({ active }) => (
                                  <>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                      active ? 'bg-[#c0a280] text-white' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                      <result.icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900 truncate">{result.title}</p>
                                        <PillarBadge pillar={result.pillar} />
                                      </div>
                                      {result.subtitle && (
                                        <p className="text-sm text-gray-500 truncate">{result.subtitle}</p>
                                      )}
                                    </div>
                                    {active && (
                                      <div className="flex items-center gap-1 text-gray-400">
                                        <span className="text-xs">Öppna</span>
                                        <ArrowRight className="w-4 h-4" />
                                      </div>
                                    )}
                                  </>
                                )}
                              </Combobox.Option>
                            ))}
                          </div>
                        ))
                      )}
                    </Combobox.Options>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium">↑↓</kbd>
                          navigera
                        </span>
                        <span className="flex items-center gap-1">
                          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium">↵</kbd>
                          öppna
                        </span>
                        <span className="flex items-center gap-1">
                          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium">esc</kbd>
                          stäng
                        </span>
                      </div>
                      <span>Sök över hela plattformen</span>
                    </div>
                  </Combobox>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

