'use client';

import { ReactNode } from 'react';
import { Home, LucideIcon } from 'lucide-react';

// Stat Card for Hero Section
export interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
}

export function StatCard({ label, value, subValue, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/10">
      <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
        <div className="p-1.5 sm:p-2 bg-white/10 rounded-md sm:rounded-lg">
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/70" />
        </div>
        <p className="text-[10px] sm:text-xs text-white/60 uppercase tracking-wider font-medium truncate">{label}</p>
        {trend && (
          <span className={`text-[10px] sm:text-xs font-medium ml-auto flex-shrink-0 ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.positive ? '↗' : '↘'} {trend.value}
          </span>
        )}
      </div>
      <p className="text-lg sm:text-2xl font-semibold text-white">{value}</p>
      {subValue && <p className="text-xs sm:text-sm text-white/50 mt-0.5 sm:mt-1 truncate">{subValue}</p>}
    </div>
  );
}

// Tab Button
export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function TabButton({ 
  tab, 
  isActive, 
  onClick 
}: { 
  tab: TabItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md sm:rounded-lg transition-all duration-200 whitespace-nowrap ${
        isActive
          ? 'bg-white text-aifm-charcoal shadow-sm'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      {tab.label}
      {tab.count !== undefined && (
        <span className={`ml-1.5 sm:ml-2 ${isActive ? 'text-aifm-charcoal/50' : 'text-white/50'}`}>
          {tab.count}
        </span>
      )}
    </button>
  );
}

// Breadcrumb
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
      <Home className="w-4 h-4" />
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-2">
          <span>/</span>
          <span className={index === items.length - 1 ? 'text-white' : ''}>
            {item.label}
          </span>
        </span>
      ))}
    </div>
  );
}

// Main Page Header Component
export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  stats?: StatCardProps[];
  tabs?: {
    items: TabItem[];
    activeId: string;
    onChange: (id: string) => void;
  };
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  stats,
  tabs,
  actions,
  children
}: PageHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-6 mb-4 sm:mb-6 rounded-xl sm:rounded-2xl">
      {/* Breadcrumb */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb items={breadcrumbs} />
      )}

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white tracking-tight mb-0.5 sm:mb-1 truncate">
            {title}
          </h1>
          {description && (
            <p className="text-white/50 text-xs sm:text-sm lg:text-base line-clamp-2">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      {stats && stats.length > 0 && (
        <div className={`grid grid-cols-2 lg:grid-cols-${Math.min(stats.length, 4)} gap-2 sm:gap-4 mb-4 sm:mb-6`}>
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      )}

      {/* Tabs */}
      {tabs && (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
          <div className="flex items-center gap-1 sm:gap-2 bg-white/5 rounded-lg sm:rounded-xl p-1 sm:p-1.5 w-fit min-w-max">
            {tabs.items.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={tabs.activeId === tab.id}
                onClick={() => tabs.onChange(tab.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Extra content */}
      {children}
    </div>
  );
}

// Action Button variants for consistency
export function PrimaryButton({ 
  children, 
  onClick,
  icon: Icon
}: { 
  children: ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
}) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-aifm-charcoal 
                 bg-white rounded-lg sm:rounded-xl hover:bg-gray-100 shadow-lg transition-all"
    >
      {Icon && <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}

export function SecondaryButton({ 
  children, 
  onClick,
  icon: Icon
}: { 
  children: ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
}) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-white/70 
                 bg-white/10 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/20 transition-all"
    >
      {Icon && <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}
