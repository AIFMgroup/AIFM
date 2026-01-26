'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Briefcase, CheckSquare,
  Settings, LogOut, ChevronDown,
  ChevronLeft, ChevronRight, Banknote, FolderOpen, Bot, Calculator, Scale, Link2,
  Users, Building2, Kanban, Calendar, ClipboardList, Shield, GitBranch, Key, FileSearch,
  HelpCircle, Star, Download, TrendingUp, FileText, Send, Activity
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { FavoritesSidebarSection, FavoriteButton } from './FavoritesManager';
import { SystemStatusCompact } from './SystemStatusIndicator';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { id: string; label: string; href: string }[];
}

const baseNavItems: NavItem[] = [
  { 
    id: 'overview', 
    label: 'Översikt', 
    icon: LayoutDashboard, 
    href: '/overview' 
  },
  // Temporarily hidden - Fond och Kapital
  // { 
  //   id: 'fund', 
  //   label: 'Fond', 
  //   icon: Briefcase,
  //   children: [
  //     { id: 'portfolio', label: 'Portfölj', href: '/portfolio' },
  //     { id: 'investors', label: 'Investerare', href: '/investors' },
  //     { id: 'nav-calculation', label: 'NAV-beräkning', href: '/nav-calculation' },
  //   ]
  // },
  // { 
  //   id: 'capital', 
  //   label: 'Kapital', 
  //   icon: Banknote,
  //   children: [
  //     { id: 'capital-calls', label: 'Kapitalanrop', href: '/capital-calls' },
  //     { id: 'distributions', label: 'Utdelningar', href: '/distributions' },
  //     { id: 'treasury', label: 'Likviditet', href: '/treasury' },
  //   ]
  // },
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
    ]
  },
  { 
    id: 'nav-admin', 
    label: 'NAV-processer', 
    icon: TrendingUp,
    children: [
      { id: 'nav-dashboard', label: 'Översikt', href: '/nav-admin' },
      { id: 'nav-reports', label: 'NAV-rapporter', href: '/nav-admin/reports' },
      { id: 'nav-flows', label: 'Notor & SubReds', href: '/nav-admin/flows' },
      { id: 'nav-price-data', label: 'Prisdata-utskick', href: '/nav-admin/price-data' },
      { id: 'nav-owner-data', label: 'Ägardata', href: '/nav-admin/owner-data' },
    ]
  },
  { 
    id: 'export', 
    label: 'Exportera', 
    icon: Download, 
    href: '/export' 
  },
  { 
    id: 'accounting', 
    label: 'Bokföring', 
    icon: Calculator,
    children: [
      { id: 'accounting-dashboard', label: 'Dashboard', href: '/accounting/dashboard' },
      { id: 'accounting-inbox', label: 'Inkorg', href: '/accounting/inbox' },
      { id: 'accounting-upload', label: 'Ladda upp', href: '/accounting/upload' },
      { id: 'accounting-reports', label: 'Rapporter', href: '/accounting/reports' },
      { id: 'accounting-settings', label: 'Fortnox-koppling', href: '/accounting/settings' },
      { id: 'accounting-integrations', label: 'Integrationer', href: '/accounting/integrations' },
      { id: 'accounting-bookkeeping', label: 'Löpande bokföring', href: '/accounting/bookkeeping' },
      { id: 'accounting-bank', label: 'Bankavstämning', href: '/accounting/bank-reconciliation' },
      { id: 'accounting-assets', label: 'Anläggningsregister', href: '/accounting/assets' },
      { id: 'accounting-periodizations', label: 'Periodiseringar', href: '/accounting/periodizations' },
      { id: 'accounting-closing', label: 'Bokslut', href: '/accounting/closing' },
      { id: 'accounting-annual', label: 'Årsredovisning', href: '/accounting/annual-report' },
      { id: 'accounting-tax', label: 'Moms & Skatt', href: '/accounting/tax-declaration' },
      { id: 'accounting-payments', label: 'Betalningar', href: '/accounting/payments' },
    ]
  },
  { 
    id: 'compliance', 
    label: 'Compliance', 
    icon: Scale,
    children: [
      { id: 'compliance-chat', label: 'Regelverksassistent', href: '/compliance' },
      { id: 'compliance-archive', label: 'Regelverksarkiv', href: '/compliance/archive' },
      { id: 'compliance-docs', label: 'Ladda upp dokument', href: '/compliance/documents' },
      { id: 'compliance-settings', label: 'Inställningar', href: '/compliance/settings' },
    ]
  },
  { 
    id: 'tasks', 
    label: 'Uppgifter', 
    icon: CheckSquare, 
    href: '/tasks' 
  },
  { 
    id: 'my-tasks', 
    label: 'Mina uppgifter', 
    icon: ClipboardList, 
    href: '/my-tasks' 
  },
];

export function DashboardSidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

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
    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = useMemo<NavItem[]>(() => {
    if (role !== 'admin') return baseNavItems;
    return [
      ...baseNavItems,
      {
        id: 'admin',
        label: 'Admin',
        icon: Settings,
        children: [
          { id: 'admin-dashboard', label: 'Dashboard', href: '/admin/dashboard' },
          { id: 'admin-users', label: 'Användare', href: '/admin/users' },
          { id: 'admin-security', label: 'Säkerhet', href: '/admin/security' },
          { id: 'admin-permissions', label: 'Behörigheter', href: '/admin/permissions' },
          { id: 'admin-workflows', label: 'Arbetsflöden', href: '/admin/workflows' },
          { id: 'admin-bulk', label: 'Bulk-operationer', href: '/admin/bulk-operations' },
          { id: 'admin-audit', label: 'Granskningslogg', href: '/audit/logs' },
          { id: 'admin-integrations', label: 'Integrationer', href: '/admin/integrations' },
          { id: 'admin-documents', label: 'Dokument', href: '/admin/documents' },
          { id: 'admin-policies', label: 'Policies', href: '/admin/policies' },
          { id: 'admin-qa', label: 'Q&A', href: '/admin/qa' },
        ],
      },
    ];
  }, [role]);

  // Track which items are manually expanded (user clicked)
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set());
  // Track which items are manually collapsed (user clicked to close)
  const [manuallyCollapsed, setManuallyCollapsed] = useState<Set<string>>(new Set());

  const isActive = useCallback((href: string) => {
    if (href === '/overview') return pathname === '/overview' || pathname === '/';
    // Exact match for routes that have children with similar paths
    // This prevents /compliance from being active when on /compliance/documents
    if (href === '/compliance') return pathname === '/compliance';
    // For other routes, check if it starts with the href followed by / or is exact match
    return pathname === href || pathname.startsWith(href + '/');
  }, [pathname]);

  const isParentActive = useCallback((item: NavItem) => {
    if (item.href) return isActive(item.href);
    return item.children?.some(child => isActive(child.href)) || false;
  }, [isActive]);

  // Calculate which items should be expanded
  const isExpanded = useCallback((id: string) => {
    // If manually collapsed, don't show
    if (manuallyCollapsed.has(id)) return false;
    // If manually expanded, show
    if (manuallyExpanded.has(id)) return true;
    // Otherwise, show if a child is active
    const item = navItems.find(i => i.id === id);
    if (item && item.children) {
      return item.children.some(child => isActive(child.href));
    }
    return false;
  }, [manuallyExpanded, manuallyCollapsed, isActive]);

  // When pathname changes and a child becomes active, remove parent from manually collapsed
  useEffect(() => {
    navItems.forEach(item => {
      if (item.children && item.children.some(child => isActive(child.href))) {
        setManuallyCollapsed(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    });
  }, [pathname, isActive]);

  const toggleExpand = (id: string) => {
    const currentlyExpanded = isExpanded(id);
    if (currentlyExpanded) {
      // User is collapsing - add to manually collapsed, remove from manually expanded
      setManuallyCollapsed(prev => new Set(prev).add(id));
      setManuallyExpanded(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      // User is expanding - add to manually expanded, remove from manually collapsed
      setManuallyExpanded(prev => new Set(prev).add(id));
      setManuallyCollapsed(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleLogout = () => {
    window.location.href = '/auth/logout';
  };

  return (
    <aside 
      className={`${collapsed ? 'w-[72px]' : 'w-64 sm:w-56'} bg-aifm-charcoal flex flex-col transition-all duration-300 ease-in-out fixed left-0 top-0 bottom-0 z-40`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-white/5 flex items-center justify-center">
        <Link href="/overview" className="flex items-center justify-center">
          <Image 
            src="/AIFM_logo.png" 
            alt="AIFM" 
            width={collapsed ? 32 : 80} 
            height={collapsed ? 32 : 32}
            className="object-contain transition-all duration-300"
          />
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-6 overflow-y-auto">
        {/* Favorites Section */}
        <FavoritesSidebarSection collapsed={collapsed} />

        <ul className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const itemIsExpanded = isExpanded(item.id);
            const active = isParentActive(item);
            
            return (
              <li key={item.id}>
                {/* Parent item */}
                {hasChildren ? (
                  <button
                    onClick={() => !collapsed && toggleExpand(item.id)}
                    className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-2.5 rounded-lg transition-all duration-200 group relative
                      ${active 
                        ? 'text-white bg-white/10' 
                        : 'text-white hover:bg-white/5'
                      }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && (
                        <span className="text-sm">{item.label}</span>
                      )}
                    </div>
                    {!collapsed && hasChildren && (
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${itemIsExpanded ? 'rotate-180' : ''}`} />
                    )}
                    {/* Tooltip when collapsed */}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-aifm-charcoal text-white text-xs rounded 
                                      opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-white/10">
                        {item.label}
                      </div>
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href!}
                    className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg transition-all duration-200 group relative
                      ${active 
                        ? 'text-white bg-aifm-gold' 
                        : 'text-white hover:bg-white/5'
                      }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <span className="text-sm">{item.label}</span>
                    )}
                    {/* Tooltip when collapsed */}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-aifm-charcoal text-white text-xs rounded 
                                      opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-white/10">
                        {item.label}
                      </div>
                    )}
                  </Link>
                )}

                {/* Children */}
                {hasChildren && !collapsed && (
                  <div className={`overflow-hidden transition-all duration-200 ${itemIsExpanded ? 'max-h-96 mt-1' : 'max-h-0'}`}>
                    <ul className="pl-5 space-y-0.5">
                      {item.children!.map((child) => {
                        const childActive = isActive(child.href);
                        return (
                          <li key={child.id}>
                            <Link
                              href={child.href}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group
                                ${childActive 
                                  ? 'text-white bg-aifm-gold' 
                                  : 'text-white/70 hover:text-white hover:bg-white/5'
                                }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${childActive ? 'bg-white' : 'bg-white/30'}`} />
                              <span className="flex-1">{child.label}</span>
                              <FavoriteButton href={child.href} label={child.label} />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* System Status - Compact */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <SystemStatusCompact />
        </div>
      )}

      {/* Bottom Navigation */}
      <div className={`border-t border-white/5 py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
        <ul className="space-y-1">
          <li>
            <button 
              onClick={() => {
                localStorage.removeItem('aifm-onboarding-completed');
                window.location.reload();
              }}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-white hover:bg-aifm-gold/20 hover:text-aifm-gold transition-all duration-200 group relative`}
              title={collapsed ? 'Starta guide' : undefined}
            >
              <HelpCircle className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm">Starta guide</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-aifm-charcoal text-white text-xs rounded 
                                opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-white/10">
                  Starta guide
                </div>
              )}
            </button>
          </li>
          <li>
            <Link 
              href="/settings"
              className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-white hover:bg-white/5 transition-all duration-200 group relative ${pathname === '/settings' ? 'bg-aifm-gold' : ''}`}
              title={collapsed ? 'Inställningar' : undefined}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm">Inställningar</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-aifm-charcoal text-white text-xs rounded 
                                opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-white/10">
                  Inställningar
                </div>
              )}
            </Link>
          </li>
          <li>
            <button 
              onClick={handleLogout}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-white hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 group relative`}
              title={collapsed ? 'Logga ut' : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm">Logga ut</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-aifm-charcoal text-white text-xs rounded 
                                opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-white/10">
                  Logga ut
                </div>
              )}
            </button>
          </li>
        </ul>
      </div>

      {/* Collapse Toggle Button */}
      <button 
        onClick={toggle}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full 
                   flex items-center justify-center shadow-md hover:bg-aifm-gold hover:border-aifm-gold
                   hover:text-white text-aifm-charcoal/60 transition-all duration-200 z-50"
        title={collapsed ? 'Expandera meny' : 'Minimera meny'}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
}
