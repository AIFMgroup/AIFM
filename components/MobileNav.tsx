'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  Home,
  Building2,
  Users,
  Shield,
  Briefcase,
  FileText,
  Settings,
  ChevronRight,
  Bell,
  Search,
} from 'lucide-react';
import { useCompany } from '@/components/CompanyContext';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
}

const mainNavItems: NavItem[] = [
  {
    label: 'Bolag',
    href: '/overview',
    icon: <Building2 className="w-5 h-5" />,
    children: [
      { label: 'Översikt', href: '/overview' },
      { label: 'Bokföring', href: '/accounting/dashboard' },
      { label: 'Portfölj', href: '/portfolio' },
      { label: 'Investerare', href: '/investors' },
      { label: 'Kapitalanskaffning', href: '/capital-calls' },
    ],
  },
  {
    label: 'CRM',
    href: '/crm',
    icon: <Users className="w-5 h-5" />,
    children: [
      { label: 'Dashboard', href: '/crm' },
      { label: 'Kontakter', href: '/crm/contacts' },
      { label: 'Företag', href: '/crm/companies' },
      { label: 'Pipeline', href: '/crm/pipeline' },
      { label: 'Aktiviteter', href: '/crm/activities' },
    ],
  },
  {
    label: 'Compliance',
    href: '/?view=compliance',
    icon: <Shield className="w-5 h-5" />,
    children: [
      { label: 'Compliance Chat', href: '/?view=compliance' },
      { label: 'Dokument', href: '/compliance/documents' },
      { label: 'Arkiv', href: '/?view=compliance&tab=archive' },
    ],
  },
];

const secondaryNavItems: NavItem[] = [
  { label: 'Data Rooms', href: '/data-rooms', icon: <Briefcase className="w-5 h-5" /> },
  { label: 'Rapporter', href: '/reports', icon: <FileText className="w-5 h-5" /> },
  { label: 'Inställningar', href: '/settings', icon: <Settings className="w-5 h-5" /> },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const pathname = usePathname();
  const { selectedCompany } = useCompany();

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
    setExpandedItem(null);
  }, [pathname]);

  // Prevent scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleExpanded = (label: string) => {
    setExpandedItem(expandedItem === label ? null : label);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 px-4">
        <div className="h-full flex items-center justify-between">
          {/* Menu Button */}
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Öppna meny"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-xl font-serif italic text-[#2d2a26] tracking-tight">aifm</span>
          </Link>

          {/* Right Icons */}
          <div className="flex items-center gap-1">
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <nav
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-[280px] bg-white z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
          <span className="text-xl font-serif italic text-[#2d2a26] tracking-tight">aifm</span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 -mr-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Stäng meny"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Company Selector */}
        {selectedCompany && (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Valt bolag</div>
            <div className="font-medium text-gray-900 truncate">{selectedCompany.name}</div>
          </div>
        )}

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-3 mb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Navigation</span>
          </div>
          
          {mainNavItems.map((item) => (
            <div key={item.label}>
              <button
                onClick={() => item.children ? toggleExpanded(item.label) : null}
                className={`w-full flex items-center justify-between px-4 py-3 text-left ${
                  pathname.startsWith(item.href.split('?')[0]) 
                    ? 'bg-amber-50 text-[#2d2a26]' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.children && (
                  <ChevronRight 
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      expandedItem === item.label ? 'rotate-90' : ''
                    }`} 
                  />
                )}
              </button>
              
              {/* Sub-items */}
              {item.children && expandedItem === item.label && (
                <div className="bg-gray-50">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`block pl-12 pr-4 py-2.5 text-sm ${
                        pathname === child.href
                          ? 'text-[#2d2a26] font-medium'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="h-px bg-gray-200 my-4 mx-4" />

          {/* Secondary Navigation */}
          <div className="px-3 mb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Mer</span>
          </div>
          
          {secondaryNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 ${
                pathname.startsWith(item.href)
                  ? 'bg-amber-50 text-[#2d2a26]'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* User Section */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-medium">
              U
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">Användare</div>
              <div className="text-sm text-gray-500 truncate">user@example.com</div>
            </div>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed header */}
      <div className="lg:hidden h-14" />
    </>
  );
}

// Bottom Navigation Bar for quick access on mobile
export function MobileBottomNav() {
  const pathname = usePathname();

  const items = [
    { label: 'Hem', href: '/overview', icon: <Home className="w-5 h-5" /> },
    { label: 'CRM', href: '/crm', icon: <Users className="w-5 h-5" /> },
    { label: 'Compliance', href: '/?view=compliance', icon: <Shield className="w-5 h-5" /> },
    { label: 'Data Rooms', href: '/data-rooms', icon: <Briefcase className="w-5 h-5" /> },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-40 safe-bottom">
      <div className="h-full grid grid-cols-4">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href.split('?')[0] + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 ${
                isActive ? 'text-[#2d2a26]' : 'text-gray-400'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}



