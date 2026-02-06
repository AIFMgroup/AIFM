'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Calculator, FolderOpen, Users, Briefcase, Banknote,
  ChevronDown, ChevronLeft, ChevronRight, Settings, FileText, History, Star,
  TrendingUp
} from 'lucide-react';
import { useSidebar } from '../SidebarContext';
import { FavoritesSidebarSection, FavoriteButton } from '../FavoritesManager';
import { SystemStatusCompact } from '../SystemStatusIndicator';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { id: string; label: string; href: string }[];
}

// Company-specific navigation items
const bolagNavItems: NavItem[] = [
  { 
    id: 'overview', 
    label: 'Översikt', 
    icon: LayoutDashboard, 
    href: '/overview' 
  },
  { 
    id: 'fund', 
    label: 'Fond', 
    icon: Briefcase,
    children: [
      { id: 'portfolio', label: 'Portfölj', href: '/portfolio' },
      { id: 'investors', label: 'Investerare', href: '/investors' },
      { id: 'nav-calculation', label: 'NAV-beräkning', href: '/nav-calculation' },
    ]
  },
  { 
    id: 'capital', 
    label: 'Kapital', 
    icon: Banknote,
    children: [
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
      { id: 'accounting-reports', label: 'Rapporter', href: '/accounting/reports' },
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
      { id: 'nav-dashboard', label: 'Översikt', href: '/nav-admin' },
      { id: 'nav-reports', label: 'NAV-rapporter', href: '/nav-admin/reports' },
      { id: 'nav-flows', label: 'Notor & SubReds', href: '/nav-admin/flows' },
      { id: 'nav-price-data', label: 'Prisdata-utskick', href: '/nav-admin/price-data' },
      { id: 'nav-owner-data', label: 'Ägardata', href: '/nav-admin/owner-data' },
    ]
  },
  { 
    id: 'audit', 
    label: 'Audit Trail', 
    icon: History, 
    href: '/audit' 
  },
  { 
    id: 'settings', 
    label: 'Inställningar', 
    icon: Settings,
    children: [
      { id: 'accounting-settings', label: 'Fortnox-koppling', href: '/accounting/settings' },
      { id: 'accounting-integrations', label: 'Integrationer', href: '/accounting/integrations' },
    ]
  },
];

export function BolagSidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
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
    return () => { cancelled = true; };
  }, []);

  // Auto-expand items based on current path
  useEffect(() => {
    bolagNavItems.forEach(item => {
      if (item.children) {
        const childMatch = item.children.some(child => pathname.startsWith(child.href));
        if (childMatch && !expandedItems.includes(item.id)) {
          setExpandedItems(prev => [...prev, item.id]);
        }
      }
    });
  }, [pathname, expandedItems]);

  const navItems = useMemo<NavItem[]>(() => {
    if (role !== 'admin') return bolagNavItems;
    return [
      ...bolagNavItems,
      {
        id: 'admin',
        label: 'Admin',
        icon: Settings,
        children: [
          { id: 'admin-dashboard', label: 'Dashboard', href: '/admin/dashboard' },
          { id: 'admin-integrations', label: 'Integrationer', href: '/admin/integrations' },
          { id: 'admin-documents', label: 'Dokument', href: '/admin/documents' },
          { id: 'admin-policies', label: 'Policies', href: '/admin/policies' },
        ],
      },
    ];
  }, [role]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id) 
        : [...prev, id]
    );
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className={`h-screen bg-[#2d2a26] flex flex-col transition-all duration-300 sticky top-0 ${
      collapsed ? 'w-[72px]' : 'w-56'
    }`}>
      {/* Collapse Toggle */}
      <div className="p-3 flex justify-end">
        <button
          onClick={toggle}
          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-white/50" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-white/50" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto scrollbar-none">
        {/* Favorites Section */}
        <FavoritesSidebarSection collapsed={collapsed} />

        <div className="space-y-1">
          {navItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.id);
            const isItemActive = item.href 
              ? isActive(item.href) 
              : item.children?.some(child => isActive(child.href));

            if (hasChildren) {
              return (
                <div key={item.id}>
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                      isItemActive 
                        ? 'bg-white/10 text-white' 
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isItemActive ? 'text-aifm-gold' : ''}`} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button>
                  
                  {!collapsed && isExpanded && (
                    <div className="mt-1 ml-4 pl-4 border-l border-white/10 space-y-0.5">
                      {item.children?.map((child) => (
                        <Link
                          key={child.id}
                          href={child.href}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors group ${
                            isActive(child.href)
                              ? 'bg-aifm-gold/20 text-aifm-gold font-medium'
                              : 'text-white/50 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span className="flex-1">{child.label}</span>
                          <FavoriteButton href={child.href} label={child.label} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href || '#'}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isItemActive 
                    ? 'bg-white/10 text-white' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isItemActive ? 'text-aifm-gold' : ''}`} />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* System Status */}
      {!collapsed && (
        <div className="px-3 pb-3 border-t border-white/5 pt-3">
          <SystemStatusCompact />
        </div>
      )}
    </aside>
  );
}

