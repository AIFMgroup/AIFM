'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Briefcase, CheckSquare, FolderLock,
  Users, ArrowUpRight, ArrowDownRight, FileText, 
  Settings, HelpCircle, LogOut, Wallet, Shield, BookOpen,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useSidebar } from './SidebarContext';

const navItems = [
  { id: 'overview', label: 'Översikt', icon: LayoutDashboard, href: '/overview' },
  { id: 'portfolio', label: 'Portfölj', icon: Briefcase, href: '/portfolio' },
  { id: 'approvals', label: 'Uppgifter', icon: CheckSquare, href: '/approvals' },
  { id: 'dataroom', label: 'Datarum', icon: FolderLock, href: '/data-rooms' },
  { id: 'divider1', type: 'divider' },
  { id: 'investors', label: 'Investerare', icon: Users, href: '/investors' },
  { id: 'capital', label: 'Kapitalanrop', icon: ArrowUpRight, href: '/capital-calls' },
  { id: 'distributions', label: 'Utdelningar', icon: ArrowDownRight, href: '/distributions' },
  { id: 'treasury', label: 'Likviditet', icon: Wallet, href: '/treasury' },
  { id: 'divider2', type: 'divider' },
  { id: 'documents', label: 'Bokföring', icon: FileText, href: '/clients' },
];

const bottomNavItems = [
  { id: 'guide', label: 'Guide', icon: BookOpen, href: '/guide' },
  { id: 'settings', label: 'Inställningar', icon: Settings, href: '/settings' },
  { id: 'help', label: 'Hjälp', icon: HelpCircle, href: '/guide' },
];

export function DashboardSidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/overview') return pathname === '/overview' || pathname === '/';
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    document.cookie = 'password-gate-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/password-gate';
  };

  return (
    <aside 
      className={`${collapsed ? 'w-[72px]' : 'w-64'} bg-aifm-charcoal flex flex-col transition-all duration-300 ease-in-out fixed left-0 top-0 bottom-0 z-40`}
    >
      {/* Logo */}
      <div className={`p-4 border-b border-white/10 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-aifm-gold rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-aifm-gold/20">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          {!collapsed && (
            <span className="text-white font-medium tracking-widest uppercase transition-opacity duration-200">AIFM</span>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {navItems.map((item) => {
            if (item.type === 'divider') {
              return <li key={item.id} className="my-3 border-t border-white/10" />;
            }
            const Icon = item.icon!;
            const active = isActive(item.href!);
            
            return (
              <li key={item.id}>
                <Link 
                  href={item.href!}
                  className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg transition-all duration-200 group relative
                    ${active 
                      ? 'bg-aifm-gold text-white shadow-lg shadow-aifm-gold/20' 
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="text-sm font-medium transition-opacity duration-200">{item.label}</span>
                  )}
                  {/* Tooltip on hover when collapsed */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-aifm-charcoal text-white text-xs rounded-md 
                                    opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50
                                    transition-opacity duration-150 shadow-lg">
                      {item.label}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Navigation */}
      <div className={`border-t border-white/10 py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
        <ul className="space-y-1">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link 
                  href={item.href}
                  className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-all duration-200 group relative`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="text-sm">{item.label}</span>}
                  {/* Tooltip on hover when collapsed */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-aifm-charcoal text-white text-xs rounded-md 
                                    opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50
                                    transition-opacity duration-150 shadow-lg">
                      {item.label}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
          <li>
            <button 
              onClick={handleLogout}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-white/50 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 group relative`}
              title={collapsed ? 'Logga ut' : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm">Logga ut</span>}
              {/* Tooltip on hover when collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-aifm-charcoal text-white text-xs rounded-md 
                                opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50
                                transition-opacity duration-150 shadow-lg">
                  Logga ut
                </div>
              )}
            </button>
          </li>
        </ul>
      </div>

      {/* Collapse Toggle Button - Discrete edge button */}
      <button 
        onClick={toggle}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full 
                   flex items-center justify-center shadow-md hover:shadow-lg hover:bg-aifm-gold hover:border-aifm-gold
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
