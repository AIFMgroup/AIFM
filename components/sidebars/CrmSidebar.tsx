'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Users, Building2, Kanban, Calendar, CheckSquare,
  Activity, ChevronLeft, ChevronRight, Search, Plus, Shield, FileText, Star
} from 'lucide-react';
import { useSidebar } from '../SidebarContext';
import { FavoritesSidebarSection, FavoriteButton } from '../FavoritesManager';
import { SystemStatusCompact } from '../SystemStatusIndicator';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
}

// CRM navigation items (global - not company-specific)
const crmNavItems: NavItem[] = [
  { 
    id: 'dashboard', 
    label: 'Dashboard', 
    icon: LayoutDashboard, 
    href: '/crm' 
  },
  { 
    id: 'contacts', 
    label: 'Kontakter', 
    icon: Users, 
    href: '/crm/contacts' 
  },
  { 
    id: 'companies', 
    label: 'Företag', 
    icon: Building2, 
    href: '/crm/companies' 
  },
  { 
    id: 'pipeline', 
    label: 'Pipeline', 
    icon: Kanban, 
    href: '/crm/pipeline' 
  },
  { 
    id: 'calendar', 
    label: 'Kalender', 
    icon: Calendar, 
    href: '/crm/calendar' 
  },
  { 
    id: 'tasks', 
    label: 'Uppgifter', 
    icon: CheckSquare, 
    href: '/crm/tasks',
    badge: 5 // Example badge
  },
  { 
    id: 'activities', 
    label: 'Aktiviteter', 
    icon: Activity, 
    href: '/crm/activities' 
  },
  { 
    id: 'contracts', 
    label: 'Avtal', 
    icon: FileText, 
    href: '/crm/contracts' 
  },
  { 
    id: 'kyc', 
    label: 'KYC', 
    icon: Shield, 
    href: '/crm/kyc',
    badge: 2 // Pending reviews
  },
];

export function CrmSidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || (href !== '/crm' && pathname.startsWith(href));
  const isExactActive = (href: string) => pathname === href;

  return (
    <aside className={`h-screen bg-[#2d2a26] flex flex-col transition-all duration-300 sticky top-0 ${
      collapsed ? 'w-[72px]' : 'w-56'
    }`}>
      {/* Quick Actions */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-white/10">
          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-aifm-gold text-white text-xs font-medium rounded-lg hover:bg-aifm-gold/90 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Ny kontakt
            </button>
            <button className="px-3 py-2 bg-white/5 text-white/70 rounded-lg hover:bg-white/10 transition-colors">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
          {crmNavItems.map((item) => {
            const active = item.href === '/crm' ? isExactActive(item.href) : isActive(item.href);
            
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                  active 
                    ? 'bg-white/10 text-white' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-aifm-gold' : ''}`} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    {item.badge ? (
                      <span className="px-2 py-0.5 bg-aifm-gold text-white text-xs font-medium rounded-full">
                        {item.badge}
                      </span>
                    ) : (
                      <FavoriteButton href={item.href} label={item.label} />
                    )}
                  </>
                )}
                {collapsed && item.badge && (
                  <span className="absolute right-2 top-1 w-2 h-2 bg-aifm-gold rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Quick Stats */}
      {!collapsed && (
        <div className="p-3 border-t border-white/10">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <p className="text-lg font-semibold text-white">247</p>
              <p className="text-[10px] text-white/40 uppercase">Kontakter</p>
            </div>
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <p className="text-lg font-semibold text-aifm-gold">12</p>
              <p className="text-[10px] text-white/40 uppercase">Aktiva affärer</p>
            </div>
          </div>
        </div>
      )}

      {/* System Status */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <SystemStatusCompact />
        </div>
      )}
    </aside>
  );
}

