'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, 
  Briefcase, 
  Calculator, 
  Users, 
  FolderOpen, 
  TrendingUp, 
  Scale, 
  CheckSquare,
  Download,
  History,
  Settings,
  LogOut,
  HelpCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Building2,
  LineChart,
  Search,
  Check,
  Plus,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { useSidebar } from '../SidebarContext';
import { FavoritesSidebarSection, FavoriteButton } from '../FavoritesManager';
import { SystemStatusCompact } from '../SystemStatusIndicator';
import { useCompany } from '../CompanyContext';
import { mockCompanies } from '@/lib/companyData';
import { InteractiveOnboardingWizard } from '../InteractiveOnboardingWizard';

interface NavChild {
  id: string;
  label: string;
  href: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: NavChild[];
  badge?: string;
}

// Unified navigation structure - all features in one place
const mainNavItems: NavItem[] = [
  { 
    id: 'overview', 
    label: 'Översikt', 
    icon: LayoutDashboard, 
    href: '/overview' 
  },
  { 
    id: 'fund-capital', 
    label: 'Fond & Kapital', 
    icon: Briefcase,
    children: [
      { id: 'portfolio', label: 'Portfölj', href: '/portfolio' },
      { id: 'investors', label: 'Investerare', href: '/investors' },
      { id: 'nav-calculation', label: 'NAV-beräkning', href: '/nav-calculation' },
      { id: 'capital-calls', label: 'Kapitalanrop', href: '/capital-calls' },
      { id: 'distributions', label: 'Utdelningar', href: '/distributions' },
      { id: 'treasury', label: 'Likviditet', href: '/treasury' },
    ]
  },
  { 
    id: 'accounting', 
    label: 'Bokföring', 
    icon: Calculator,
    children: [
      { id: 'accounting-dashboard', label: 'Dashboard', href: '/accounting/dashboard' },
      { id: 'accounting-inbox', label: 'Inkorg', href: '/accounting/inbox' },
      { id: 'accounting-upload', label: 'Ladda upp', href: '/accounting/upload' },
      { id: 'accounting-bookkeeping', label: 'Löpande bokföring', href: '/accounting/bookkeeping' },
      { id: 'accounting-bank', label: 'Bankavstämning', href: '/accounting/bank-reconciliation' },
      { id: 'accounting-reports', label: 'Rapporter', href: '/accounting/reports' },
      { id: 'accounting-assets', label: 'Anläggningsregister', href: '/accounting/assets' },
      { id: 'accounting-periodizations', label: 'Periodiseringar', href: '/accounting/periodizations' },
      { id: 'accounting-closing', label: 'Bokslut', href: '/accounting/closing' },
      { id: 'accounting-annual', label: 'Årsredovisning', href: '/accounting/annual-report' },
      { id: 'accounting-tax', label: 'Moms & Skatt', href: '/accounting/tax-declaration' },
      { id: 'accounting-payments', label: 'Betalningar', href: '/accounting/payments' },
    ]
  },
  { 
    id: 'crm', 
    label: 'CRM', 
    icon: Users,
    children: [
      { id: 'crm-dashboard', label: 'Dashboard', href: '/crm' },
      { id: 'crm-contacts', label: 'Kontakter', href: '/crm/contacts' },
      { id: 'crm-companies', label: 'Företag', href: '/crm/companies' },
      { id: 'crm-pipeline', label: 'Pipeline', href: '/crm/pipeline' },
      { id: 'crm-calendar', label: 'Kalender', href: '/crm/calendar' },
      { id: 'crm-tasks', label: 'Uppgifter', href: '/crm/tasks' },
      { id: 'crm-activities', label: 'Aktiviteter', href: '/crm/activities' },
    ]
  },
  { 
    id: 'documents', 
    label: 'Dokument', 
    icon: FolderOpen,
    children: [
      { id: 'data-rooms', label: 'Datarum', href: '/data-rooms' },
      { id: 'reports', label: 'Rapporter', href: '/reports' },
    ]
  },
  { 
    id: 'nav-admin', 
    label: 'NAV-processer', 
    icon: TrendingUp,
    children: [
      { id: 'nav-overview', label: 'Översikt', href: '/nav-admin' },
      { id: 'nav-reports', label: 'NAV-rapporter', href: '/nav-admin/reports' },
      { id: 'nav-flows', label: 'Notor & SubReds', href: '/nav-admin/flows' },
      { id: 'nav-price-data', label: 'Prisdata-utskick', href: '/nav-admin/price-data' },
      { id: 'nav-owner-data', label: 'Ägardata', href: '/nav-admin/owner-data' },
      { id: 'nav-settings', label: 'Inställningar', href: '/nav-admin/settings' },
    ]
  },
  { 
    id: 'securities', 
    label: 'Värdepapper', 
    icon: LineChart,
    children: [
      { id: 'securities-list', label: 'Godkännanden', href: '/securities' },
      { id: 'securities-new', label: 'Ny ansökan', href: '/securities/new-approval' },
    ]
  },
  { 
    id: 'aifm-agent', 
    label: 'AIFM Agent', 
    icon: Sparkles,
    href: '/aifm-agent'
  },
  { 
    id: 'compliance', 
    label: 'Compliance', 
    icon: Scale,
    children: [
      { id: 'compliance-archive', label: 'Regelverksarkiv', href: '/compliance/archive' },
      { id: 'compliance-docs', label: 'Ladda upp dokument', href: '/compliance/documents' },
    ]
  },
  { 
    id: 'tasks', 
    label: 'Uppgifter', 
    icon: CheckSquare,
    children: [
      { id: 'all-tasks', label: 'Alla uppgifter', href: '/tasks' },
      { id: 'my-tasks', label: 'Mina uppgifter', href: '/my-tasks' },
    ]
  },
];

// Utility items (bottom of sidebar)
const utilityNavItems: NavItem[] = [
  { 
    id: 'export', 
    label: 'Exportera', 
    icon: Download, 
    href: '/export' 
  },
  { 
    id: 'audit', 
    label: 'Audit Trail', 
    icon: History, 
    href: '/audit' 
  },
];

// Admin items (only shown for admins)
const adminNavItem: NavItem = {
  id: 'admin',
  label: 'Administration',
  icon: Building2,
  children: [
    { id: 'admin-dashboard', label: 'Dashboard', href: '/admin/dashboard' },
    { id: 'admin-users', label: 'Användare', href: '/admin/users' },
    { id: 'admin-integrations', label: 'Integrationer (AI)', href: '/admin/integrations' },
    { id: 'admin-knowledge-base', label: 'Kunskapsbas', href: '/admin/knowledge-base' },
    { id: 'admin-dropbox', label: 'Dropbox-synk', href: '/admin/dropbox' },
    { id: 'admin-security', label: 'Säkerhet', href: '/admin/security' },
    { id: 'admin-permissions', label: 'Behörigheter', href: '/admin/permissions' },
    { id: 'admin-workflows', label: 'Arbetsflöden', href: '/admin/workflows' },
    { id: 'admin-bulk', label: 'Bulk-operationer', href: '/admin/bulk-operations' },
    { id: 'admin-audit', label: 'Granskningslogg', href: '/audit/logs' },
    { id: 'admin-documents', label: 'Dokument', href: '/admin/documents' },
    { id: 'admin-policies', label: 'Policies', href: '/admin/policies' },
  ],
};

// Mock compliance status per company
const companyComplianceStatus: Record<string, { score: number; overdueCount: number; status: 'ok' | 'warning' | 'critical' }> = {
  'aifm-1': { score: 87, overdueCount: 1, status: 'warning' },
  'aifm-2': { score: 95, overdueCount: 0, status: 'ok' },
  'aifm-3': { score: 62, overdueCount: 3, status: 'critical' },
  'aifm-4': { score: 90, overdueCount: 0, status: 'ok' },
  'aifm-5': { score: 78, overdueCount: 2, status: 'warning' },
};

// Sidebar Company Dropdown
function SidebarCompanyDropdown({ collapsed, onAddCompany }: { collapsed: boolean; onAddCompany: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { selectedCompany, setSelectedCompany } = useCompany();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const companies = mockCompanies;
  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.orgNumber.includes(searchQuery)
  );

  if (collapsed) {
    return (
      <div className="px-2 py-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group relative"
          title={selectedCompany?.name || 'Välj bolag'}
        >
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: selectedCompany?.color ? `${selectedCompany.color}30` : 'rgba(255,255,255,0.1)' }}
          >
            <Building2 className="w-4 h-4 text-white/70" />
          </div>
          {/* Tooltip */}
          <div className="absolute left-full ml-2 px-3 py-2 bg-[#1a1a1a] text-white text-xs rounded-lg 
                          opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 
                          shadow-xl border border-white/10 transition-opacity">
            {selectedCompany?.name || 'Välj bolag'}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-3" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 
                   border border-white/10 transition-all duration-200"
      >
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: selectedCompany?.color ? `${selectedCompany.color}30` : 'rgba(255,255,255,0.1)' }}
        >
          {selectedCompany?.color ? (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedCompany.color }} />
          ) : (
            <Building2 className="w-4 h-4 text-white/50" />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {selectedCompany?.name || 'Välj bolag'}
          </p>
          {selectedCompany && (
            <p className="text-[10px] text-white/40">{selectedCompany.orgNumber}</p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-3 right-3 mt-2 bg-[#252525] rounded-xl border border-white/10 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Search */}
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Sök bolag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg 
                           text-white placeholder:text-white/30 focus:outline-none focus:border-[#c0a280]/50"
              />
            </div>
          </div>

          {/* Company List */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredCompanies.map((company) => {
              const compliance = companyComplianceStatus[company.id] || { score: 100, overdueCount: 0, status: 'ok' };
              return (
                <button
                  key={company.id}
                  onClick={() => {
                    setSelectedCompany(company);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors ${
                    selectedCompany?.id === company.id ? 'bg-[#c0a280]/10' : ''
                  }`}
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center relative flex-shrink-0"
                    style={{ backgroundColor: `${company.color}20` }}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: company.color }} />
                    {compliance.status !== 'ok' && (
                      <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                        compliance.status === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                      }`}>
                        <AlertTriangle className="w-2 h-2 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{company.name}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        compliance.status === 'ok' ? 'bg-emerald-500/20 text-emerald-400' :
                        compliance.status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {compliance.score}%
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40">{company.orgNumber}</p>
                  </div>
                  {selectedCompany?.id === company.id && (
                    <Check className="w-4 h-4 text-[#c0a280] flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Add New */}
          <div className="p-2 border-t border-white/5">
            <button 
              onClick={() => {
                setIsOpen(false);
                onAddCompany();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c0a280] hover:bg-[#c0a280]/10 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Lägg till nytt bolag
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UnifiedSidebarContent() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'overview' | 'setup-company'>('overview');

  // Fetch user role
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/role', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { role?: string };
        if (!cancelled) setRole((data.role || '').toLowerCase() || null);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Build final nav items based on role
  const navItems = useMemo<NavItem[]>(() => {
    const items = [...mainNavItems, ...utilityNavItems];
    if (role === 'admin') {
      items.push(adminNavItem);
    }
    return items;
  }, [role]);

  // Check if a path is active
  const isActive = useCallback((href: string) => {
    if (href === '/overview') return pathname === '/overview' || pathname === '/';
    if (href === '/?view=compliance') {
      return pathname === '/' && searchParams?.get('view') === 'compliance';
    }
    if (href === '/compliance') return pathname === '/compliance';
    return pathname === href || pathname.startsWith(href + '/');
  }, [pathname, searchParams]);

  // Check if parent item has an active child
  const hasActiveChild = useCallback((item: NavItem) => {
    if (item.href) return isActive(item.href);
    return item.children?.some(child => isActive(child.href)) || false;
  }, [isActive]);

  // Auto-expand items with active children
  useEffect(() => {
    navItems.forEach(item => {
      if (item.children && item.children.some(child => isActive(child.href))) {
        setExpandedItems(prev => new Set(prev).add(item.id));
      }
    });
  }, [pathname, navItems, isActive]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleLogout = () => {
    window.location.href = '/auth/logout';
  };

  const startOnboarding = () => {
    setOnboardingMode('overview');
    setShowOnboarding(true);
  };

  return (
    <aside 
      className={`${collapsed ? 'w-[72px]' : 'w-64'} bg-[#1a1a1a] flex flex-col transition-all duration-300 ease-in-out h-screen relative`}
    >
      {/* Logo Section - at the very top */}
      <div className={`pt-6 pb-4 flex items-center justify-center ${collapsed ? 'px-2' : 'px-4'}`}>
        <Link href="/overview" className="flex items-center justify-center">
          <Image 
            src="/AIFM_logo.png" 
            alt="AIFM" 
            width={collapsed ? 36 : 120} 
            height={36}
            className="object-contain transition-all duration-300"
          />
        </Link>
      </div>

      {/* Company Selector - under logo */}
      <SidebarCompanyDropdown collapsed={collapsed} onAddCompany={() => {
        setOnboardingMode('setup-company');
        setShowOnboarding(true);
      }} />

      {/* Divider */}
      <div className={`mx-3 border-t border-white/10 ${collapsed ? 'mx-2' : ''}`} />

      {/* Collapse Toggle */}
      <button
        onClick={toggle}
        className="absolute -right-3 top-24 w-6 h-6 bg-white border border-gray-200 rounded-full 
                   flex items-center justify-center shadow-md hover:bg-[#c0a280] hover:border-[#c0a280]
                   hover:text-white text-gray-500 transition-all duration-200 z-50"
        title={collapsed ? 'Expandera meny' : 'Minimera meny'}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-none">
        {/* Favorites Section */}
        <FavoritesSidebarSection collapsed={collapsed} />

        {/* Navigation Items */}
        <div className={`space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.has(item.id);
            const isItemActive = hasActiveChild(item);

            return (
              <div key={item.id}>
                {/* Parent Item */}
                {hasChildren ? (
                  <button
                    onClick={() => !collapsed && toggleExpand(item.id)}
                    className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} 
                               px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                               ${isItemActive 
                                 ? 'bg-white/10 text-white' 
                                 : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 flex-shrink-0 ${isItemActive ? 'text-[#c0a280]' : ''}`} />
                      {!collapsed && (
                        <span className="text-sm font-medium">{item.label}</span>
                      )}
                    </div>
                    {!collapsed && (
                      <ChevronDown 
                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                      />
                    )}
                    {/* Tooltip when collapsed */}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#1a1a1a] text-white text-xs rounded-lg 
                                      opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 
                                      shadow-xl border border-white/10 transition-opacity">
                        {item.label}
                      </div>
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href!}
                    className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} 
                               px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                               ${isItemActive 
                                 ? 'bg-[#c0a280] text-white' 
                                 : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                    {/* Tooltip when collapsed */}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#1a1a1a] text-white text-xs rounded-lg 
                                      opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 
                                      shadow-xl border border-white/10 transition-opacity">
                        {item.label}
                      </div>
                    )}
                  </Link>
                )}

                {/* Children Items */}
                {hasChildren && !collapsed && (
                  <div 
                    className={`overflow-hidden transition-all duration-300 ease-in-out
                               ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <div className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                      {item.children!.map((child) => {
                        const childActive = isActive(child.href);
                        return (
                          <Link
                            key={child.id}
                            href={child.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group
                                       ${childActive 
                                         ? 'bg-[#c0a280]/20 text-[#c0a280] font-medium' 
                                         : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full transition-colors
                                           ${childActive ? 'bg-[#c0a280]' : 'bg-white/30 group-hover:bg-white/50'}`} />
                            <span className="flex-1">{child.label}</span>
                            <FavoriteButton href={child.href} label={child.label} />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* System Status */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <SystemStatusCompact />
        </div>
      )}

      {/* Bottom Actions */}
      <div className={`border-t border-white/5 py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        <div className="space-y-0.5">
          {/* Start Guide */}
          <button
            onClick={startOnboarding}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} 
                       px-3 py-2 rounded-xl text-white/60 hover:bg-[#c0a280]/20 hover:text-[#c0a280] 
                       transition-all duration-200 group relative`}
            title={collapsed ? 'Starta guide' : undefined}
          >
            <HelpCircle className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm">Starta guide</span>}
            {collapsed && (
              <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#1a1a1a] text-white text-xs rounded-lg 
                              opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 
                              shadow-xl border border-white/10">
                Starta guide
              </div>
            )}
          </button>

          {/* Settings */}
          <Link
            href="/settings"
            className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} 
                       px-3 py-2 rounded-xl transition-all duration-200 group relative
                       ${pathname === '/settings' || pathname.startsWith('/settings/')
                         ? 'bg-[#c0a280] text-white' 
                         : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
            title={collapsed ? 'Inställningar' : undefined}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm">Inställningar</span>}
            {collapsed && (
              <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#1a1a1a] text-white text-xs rounded-lg 
                              opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 
                              shadow-xl border border-white/10">
                Inställningar
              </div>
            )}
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} 
                       px-3 py-2 rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/10 
                       transition-all duration-200 group relative`}
            title={collapsed ? 'Logga ut' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm">Logga ut</span>}
            {collapsed && (
              <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#1a1a1a] text-white text-xs rounded-lg 
                              opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 
                              shadow-xl border border-white/10">
                Logga ut
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Onboarding Wizard */}
      <InteractiveOnboardingWizard
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        initialMode={onboardingMode}
      />
    </aside>
  );
}

// Sidebar placeholder while Suspense is loading
function SidebarFallback() {
  return (
    <aside className="w-64 bg-[#1a1a1a] flex flex-col h-screen">
      <div className="pt-6 pb-4 flex items-center justify-center px-4">
        <div className="w-[120px] h-9 bg-white/5 rounded animate-pulse" />
      </div>
      <div className="px-3 py-3">
        <div className="h-[54px] bg-white/5 rounded-xl animate-pulse" />
      </div>
      <div className="mx-3 border-t border-white/10" />
      <nav className="flex-1 py-4 px-3 space-y-2">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
        ))}
      </nav>
    </aside>
  );
}

// Export with Suspense wrapper to handle useSearchParams during SSR
export function UnifiedSidebar() {
  return (
    <Suspense fallback={<SidebarFallback />}>
      <UnifiedSidebarContent />
    </Suspense>
  );
}
