'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Briefcase, CheckSquare,
  Settings, LogOut, ChevronDown,
  ChevronLeft, ChevronRight, Banknote, FolderOpen, BookOpen, Bot, Calculator
} from 'lucide-react';
import { useSidebar } from './SidebarContext';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { id: string; label: string; href: string }[];
}

const navItems: NavItem[] = [
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
    id: 'documents', 
    label: 'Dokument', 
    icon: FolderOpen,
    children: [
      { id: 'data-rooms', label: 'Datarum', href: '/data-rooms' },
    ]
  },
  { 
    id: 'accounting', 
    label: 'Bokföring', 
    icon: Calculator,
    children: [
      { id: 'accounting-overview', label: 'Översikt', href: '/accounting' },
      { id: 'accounting-upload', label: 'Ladda upp material', href: '/accounting/upload' },
      { id: 'accounting-bookkeeping', label: 'Löpande bokföring', href: '/accounting/bookkeeping' },
      { id: 'accounting-closing', label: 'Bokslut', href: '/accounting/closing' },
      { id: 'accounting-annual', label: 'Årsredovisning', href: '/accounting/annual-report' },
      { id: 'accounting-payments', label: 'Betalningar', href: '/accounting/payments' },
    ]
  },
  { 
    id: 'compliance-agent', 
    label: 'Compliance Agent', 
    icon: Bot,
    children: [
      { id: 'compliance-docs', label: 'Ladda upp dokument', href: '/compliance/documents' },
      { id: 'compliance-chat', label: 'Compliance Agent', href: '/compliance/chat' },
    ]
  },
  { 
    id: 'tasks', 
    label: 'Uppgifter', 
    icon: CheckSquare, 
    href: '/approvals' 
  },
];

export function DashboardSidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const isActive = (href: string) => {
    if (href === '/overview') return pathname === '/overview' || pathname === '/';
    return pathname.startsWith(href);
  };

  const isParentActive = (item: NavItem) => {
    if (item.href) return isActive(item.href);
    return item.children?.some(child => isActive(child.href)) || false;
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleLogout = () => {
    document.cookie = 'password-gate-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/password-gate';
  };

  return (
    <aside 
      className={`${collapsed ? 'w-[72px]' : 'w-56'} bg-aifm-charcoal flex flex-col transition-all duration-300 ease-in-out fixed left-0 top-0 bottom-0 z-40`}
    >
      {/* Logo */}
      <div className={`p-4 border-b border-white/5 flex items-center ${collapsed ? 'justify-center' : 'justify-start'}`}>
        <Link href="/overview" className="flex items-center">
          <Image 
            src="/frilagd_logo.png" 
            alt="AIFM" 
            width={collapsed ? 40 : 140} 
            height={collapsed ? 40 : 50}
            className="object-contain transition-all duration-300"
          />
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-6 overflow-y-auto">
        <ul className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.id);
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
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
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
                  <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-60 mt-1' : 'max-h-0'}`}>
                    <ul className="pl-5 space-y-0.5">
                      {item.children!.map((child) => {
                        const childActive = isActive(child.href);
                        return (
                          <li key={child.id}>
                            <Link
                              href={child.href}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200
                                ${childActive 
                                  ? 'text-white bg-aifm-gold' 
                                  : 'text-white/70 hover:text-white hover:bg-white/5'
                                }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${childActive ? 'bg-white' : 'bg-white/30'}`} />
                              {child.label}
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

      {/* Bottom Navigation */}
      <div className={`border-t border-white/5 py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
        <ul className="space-y-1">
          <li>
            <Link 
              href="/guide"
              className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-white hover:bg-white/5 transition-all duration-200 group relative ${pathname === '/guide' ? 'bg-aifm-gold' : ''}`}
              title={collapsed ? 'Användarguide' : undefined}
            >
              <BookOpen className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm">Användarguide</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-aifm-charcoal text-white text-xs rounded 
                                opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-white/10">
                  Användarguide
                </div>
              )}
            </Link>
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
