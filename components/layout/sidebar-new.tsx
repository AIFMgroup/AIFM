"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Banknote,
  FolderOpen,
  Calculator,
  Bot,
  CheckSquare,
  Settings,
  LogOut,
  Link2,
  ChevronDown,
  ChevronLeft,
} from "lucide-react";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
};

const navItems: NavItem[] = [
  {
    label: "Översikt",
    href: "/overview",
    icon: <LayoutDashboard className="w-5 h-5 flex-shrink-0" />,
  },
  // Temporarily hidden - Fond och Kapital
  // {
  //   label: "Fond",
  //   icon: <Briefcase className="w-5 h-5 flex-shrink-0" />,
  //   children: [
  //     { label: "Portfölj", href: "/portfolio" },
  //     { label: "Investerare", href: "/investors" },
  //     { label: "NAV-beräkning", href: "/nav-calculation" },
  //   ],
  // },
  // {
  //   label: "Kapital",
  //   icon: <Banknote className="w-5 h-5 flex-shrink-0" />,
  //   children: [
  //     { label: "Kapitalanrop", href: "/capital-calls" },
  //     { label: "Utdelningar", href: "/distributions" },
  //     { label: "Likviditet", href: "/treasury" },
  //   ],
  // },
  {
    label: "Dokument",
    icon: <FolderOpen className="w-5 h-5 flex-shrink-0" />,
    children: [{ label: "Datarum", href: "/data-rooms" }],
  },
  {
    label: "Bokföring",
    icon: <Calculator className="w-5 h-5 flex-shrink-0" />,
    children: [
      { label: "Översikt", href: "/accounting" },
      { label: "Inkorg", href: "/accounting/inbox" },
      { label: "Ladda upp material", href: "/accounting/upload" },
      { label: "Löpande bokföring", href: "/accounting/bookkeeping" },
      { label: "Bankavstämning", href: "/accounting/bank-reconciliation" },
      { label: "Anläggningsregister", href: "/accounting/assets" },
      { label: "Periodiseringar", href: "/accounting/periodizations" },
      { label: "Bokslut", href: "/accounting/closing" },
      { label: "Årsredovisning", href: "/accounting/annual-report" },
      { label: "Moms & Skatt", href: "/accounting/tax-declaration" },
      { label: "Betalningar", href: "/accounting/payments" },
      { label: "Integrationer", href: "/accounting/integrations" },
    ],
  },
  {
    label: "Compliance Agent",
    icon: <Bot className="w-5 h-5 flex-shrink-0" />,
    children: [
      { label: "Compliance Agent", href: "/compliance/chat" },
      { label: "Regelverksarkiv", href: "/compliance/archive" },
      { label: "Ladda upp dokument", href: "/compliance/documents" },
      { label: "Inställningar", href: "/compliance/settings" },
    ],
  },
  {
    label: "Uppgifter",
    href: "/tasks",
    icon: <CheckSquare className="w-5 h-5 flex-shrink-0" />,
  },
];

const bottomNavItems: NavItem[] = [
  {
    label: "Inställningar",
    href: "/settings",
    icon: <Settings className="w-5 h-5 flex-shrink-0" />,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (href: string) => pathname === href;
  const isParentActive = (children?: { href: string }[]) =>
    children?.some((child) => pathname === child.href);

  return (
    <aside
      className={`${
        isCollapsed ? "w-16" : "w-56"
      } bg-aifm-charcoal flex flex-col transition-all duration-300 ease-in-out fixed left-0 top-0 bottom-0 z-40`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-white/5 flex items-center justify-center">
        <Link className="flex items-center justify-center" href="/overview">
          <Image
            alt="AIFM"
            width={isCollapsed ? 32 : 80}
            height={32}
            className="object-contain transition-all duration-300"
            src="/AIFM_logo.png"
          />
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-6 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => (
            <li key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                    isActive(item.href)
                      ? "text-white bg-aifm-gold"
                      : "text-white hover:bg-white/5"
                  }`}
                >
                  {item.icon}
                  {!isCollapsed && (
                    <span className="text-sm">{item.label}</span>
                  )}
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => toggleExpand(item.label)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                      isParentActive(item.children)
                        ? "text-white bg-white/10"
                        : "text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      {!isCollapsed && (
                        <span className="text-sm">{item.label}</span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          expandedItems.includes(item.label) ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </button>
                  {!isCollapsed && (
                    <div
                      className={`overflow-hidden transition-all duration-200 ${
                        expandedItems.includes(item.label)
                          ? "max-h-96"
                          : "max-h-0"
                      }`}
                    >
                      <ul className="pl-5 space-y-0.5">
                        {item.children?.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                isActive(child.href)
                                  ? "text-white bg-white/10"
                                  : "text-white/70 hover:text-white hover:bg-white/5"
                              }`}
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isActive(child.href)
                                    ? "bg-aifm-gold"
                                    : "bg-white/30"
                                }`}
                              />
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-white/5 py-4 px-3">
        <ul className="space-y-1">
          {bottomNavItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href!}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-white hover:bg-white/5 transition-all duration-200"
              >
                {item.icon}
                {!isCollapsed && <span className="text-sm">{item.label}</span>}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/auth/logout"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm">Logga ut</span>}
            </Link>
          </li>
        </ul>
      </div>

      {/* Collapse Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-md hover:bg-aifm-gold hover:border-aifm-gold hover:text-white text-aifm-charcoal/60 transition-all duration-200 z-50"
        title={isCollapsed ? "Expandera meny" : "Minimera meny"}
      >
        <ChevronLeft
          className={`w-3.5 h-3.5 transition-transform ${
            isCollapsed ? "rotate-180" : ""
          }`}
        />
      </button>
    </aside>
  );
}





