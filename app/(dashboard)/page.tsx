'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, Building2, TrendingUp, ArrowRight, Sparkles } from 'lucide-react';
import { useCompany } from '@/components/CompanyContext';
import { mockCompanies, Company } from '@/lib/companyData';

// Generate more mock companies for demo (up to 100)
const generateCompanies = (): Company[] => {
  const types: Company['type'][] = ['FUND', 'HOLDING', 'OPERATING', 'SPV'];
  const statuses: Company['status'][] = ['ACTIVE', 'INACTIVE'];
  const baseCompanies = [...mockCompanies];
  
  const additionalNames = [
    'Alpha Ventures', 'Beta Capital', 'Gamma Partners', 'Delta Fund', 'Epsilon Holdings',
    'Zeta Investments', 'Eta Growth', 'Theta Capital', 'Iota Partners', 'Kappa Fund',
    'Lambda Equity', 'Mu Ventures', 'Nu Capital', 'Xi Partners', 'Omicron Fund',
    'Pi Holdings', 'Rho Investments', 'Sigma Growth', 'Tau Capital', 'Upsilon Partners',
    'Phi Fund', 'Chi Equity', 'Psi Ventures', 'Omega Capital', 'Aurora Partners',
    'Boreal Fund', 'Celsius Holdings', 'Dawn Ventures', 'Eclipse Capital', 'Flux Partners',
    'Glacier Fund', 'Horizon Equity', 'Infinity Ventures', 'Jupiter Capital', 'Kronos Partners',
    'Luna Fund', 'Meridian Holdings', 'Nexus Ventures', 'Orbit Capital', 'Pinnacle Partners',
    'Quantum Fund', 'Radiant Equity', 'Stellar Ventures', 'Terra Capital', 'Unity Partners',
    'Vertex Fund', 'Wavelength Holdings', 'Xenon Ventures', 'Yield Capital', 'Zenith Partners',
    'Nordic Alpha I', 'Nordic Beta II', 'Scandinavian Growth', 'Baltic Ventures', 'Arctic Capital',
    'Fjord Partners', 'Viking Fund', 'Northern Lights', 'Midnight Sun', 'Polar Equity',
    'Evergreen Capital', 'Summit Partners', 'Cascade Fund', 'Horizon Capital', 'Pinnacle Equity',
    'Meridian Ventures', 'Stellar Holdings', 'Aurora Fund', 'Nexus Capital', 'Vanguard Partners',
    'Crimson Fund', 'Sapphire Capital', 'Emerald Partners', 'Ruby Holdings', 'Diamond Fund',
    'Platinum Capital', 'Silver Partners', 'Golden Holdings', 'Bronze Fund', 'Copper Capital',
    'Iron Partners', 'Steel Holdings', 'Titanium Fund', 'Carbon Capital', 'Graphene Partners',
    'Quantum Holdings', 'Neural Fund', 'Cyber Capital', 'Digital Partners', 'Tech Holdings',
  ];

  const generated: Company[] = additionalNames.map((name, index) => ({
    id: `company-${index + 10}`,
    name,
    shortName: name.split(' ')[0].toUpperCase().slice(0, 3),
    orgNumber: `55${(9000 + index).toString()}-${(1000 + index).toString()}`,
    type: types[index % types.length],
    status: statuses[index % statuses.length],
    color: `hsl(${(index * 37) % 360}, 60%, 45%)`,
  }));

  return [...baseCompanies, ...generated];
};

const allCompanies = generateCompanies();

// Alphabet for quick navigation
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Type labels for display
const typeLabels: Record<Company['type'], string> = {
  FUND: 'Fond',
  HOLDING: 'Holding',
  OPERATING: 'Operativt',
  SPV: 'SPV',
};

export default function CompanySelectPage() {
  const router = useRouter();
  const { setSelectedCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [hoveredCompany, setHoveredCompany] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Filter companies based on search and letter
  const filteredCompanies = useMemo(() => {
    let filtered = allCompanies;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.orgNumber.includes(query) ||
        c.type.toLowerCase().includes(query)
      );
    }
    
    if (selectedLetter) {
      filtered = filtered.filter(c => c.name.toUpperCase().startsWith(selectedLetter));
    }
    
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [searchQuery, selectedLetter]);

  // Get available letters (letters that have companies)
  const availableLetters = useMemo(() => {
    const letters = new Set(allCompanies.map(c => c.name[0].toUpperCase()));
    return alphabet.filter(l => letters.has(l));
  }, []);

  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
    router.push('/overview');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #2d2a26 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/frilagd_logo.png"
                alt="AIFM"
                width={120}
                height={40}
                className="h-10 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="hidden sm:inline">{allCompanies.length} bolag</span>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-12">
        {/* Hero Section */}
        <div className={`text-center mb-12 transition-all duration-700 delay-100 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight mb-4">
            Välj <span className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-[#c0a280] to-[#8b7355]">bolag</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Välj ett bolag för att se dess dashboard, nyckeltal och dokumentation
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className={`mb-8 transition-all duration-700 delay-200 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
            {/* Search Input */}
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Sök bolag, org.nummer eller typ..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedLetter(null);
                }}
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#c0a280] focus:ring-4 focus:ring-[#c0a280]/10 transition-all shadow-sm hover:shadow-md"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Alphabet Quick Nav */}
          <div className="flex flex-wrap justify-center gap-1 mt-6">
            <button
              onClick={() => setSelectedLetter(null)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                selectedLetter === null
                  ? 'bg-[#2d2a26] text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Alla
            </button>
            {alphabet.map(letter => {
              const isAvailable = availableLetters.includes(letter);
              return (
                <button
                  key={letter}
                  onClick={() => isAvailable && setSelectedLetter(letter === selectedLetter ? null : letter)}
                  disabled={!isAvailable}
                  className={`w-8 h-8 text-xs font-medium rounded-lg transition-all ${
                    selectedLetter === letter
                      ? 'bg-[#c0a280] text-white shadow-lg shadow-[#c0a280]/30'
                      : isAvailable
                        ? 'text-gray-600 hover:bg-[#c0a280]/10 hover:text-[#c0a280]'
                        : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        <div className={`text-center mb-6 transition-all duration-500 delay-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-sm text-gray-500">
            Visar <span className="font-medium text-gray-700">{filteredCompanies.length}</span> bolag
            {selectedLetter && <span> som börjar på <span className="font-medium text-[#c0a280]">{selectedLetter}</span></span>}
            {searchQuery && <span> för &ldquo;{searchQuery}&rdquo;</span>}
          </p>
        </div>

        {/* Companies Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-all duration-700 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {filteredCompanies.map((company, index) => (
            <button
              key={company.id}
              onClick={() => handleSelectCompany(company)}
              onMouseEnter={() => setHoveredCompany(company.id)}
              onMouseLeave={() => setHoveredCompany(null)}
              className="group relative bg-white rounded-2xl border border-gray-100 p-5 text-left transition-all duration-300 hover:shadow-xl hover:shadow-gray-200/50 hover:border-[#c0a280]/30 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-[#c0a280]/50"
              style={{
                animationDelay: `${Math.min(index * 30, 500)}ms`,
              }}
            >
              {/* Status indicator */}
              <div className="absolute top-4 right-4">
                <div className={`w-2 h-2 rounded-full ${
                  company.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-300'
                }`} />
              </div>

              {/* Company Icon */}
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${company.color}15` }}
              >
                <Building2 className="w-6 h-6" style={{ color: company.color }} />
              </div>

              {/* Company Info */}
              <h3 className="font-medium text-gray-900 mb-1 group-hover:text-[#c0a280] transition-colors line-clamp-1">
                {company.name}
              </h3>
              <p className="text-xs text-gray-500 mb-3">{company.orgNumber}</p>

              {/* Meta Info */}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {typeLabels[company.type]}
                </span>
              </div>

              {/* Hover Arrow */}
              <div className={`absolute bottom-4 right-4 transition-all duration-300 ${
                hoveredCompany === company.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
              }`}>
                <ArrowRight className="w-5 h-5 text-[#c0a280]" />
              </div>
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filteredCompanies.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Inga bolag hittades</h3>
            <p className="text-gray-500">Försök med en annan sökning eller filter</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedLetter(null);
              }}
              className="mt-4 px-4 py-2 text-sm text-[#c0a280] hover:bg-[#c0a280]/10 rounded-lg transition-colors"
            >
              Rensa filter
            </button>
          </div>
        )}
      </main>

      {/* Floating Action - Quick Stats */}
      <div className={`fixed bottom-6 right-6 transition-all duration-700 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="bg-[#2d2a26] text-white rounded-2xl shadow-2xl shadow-[#2d2a26]/30 px-5 py-4 flex items-center gap-4">
          <div className="p-2 bg-[#c0a280]/20 rounded-xl">
            <Sparkles className="w-5 h-5 text-[#c0a280]" />
          </div>
          <div className="text-sm">
            <p className="text-white/60">Aktiva bolag</p>
            <p className="font-semibold text-lg">
              {allCompanies.filter(c => c.status === 'ACTIVE').length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
