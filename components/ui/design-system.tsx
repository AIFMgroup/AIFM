'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X, Loader2 } from 'lucide-react';

// =============================================================================
// COLOR SYSTEM
// =============================================================================
// Primary: aifm-charcoal #2d2a26
// Accent: aifm-gold #c0a280
// Background: white
// Text: gray-900, gray-500, gray-400

// =============================================================================
// TABS
// =============================================================================

interface TabItem {
  key: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (key: string) => void;
  variant?: 'underline' | 'pills';
  size?: 'sm' | 'md';
}

export function Tabs({ tabs, activeTab, onChange, variant = 'underline', size = 'md' }: TabsProps) {
  if (variant === 'pills') {
    return (
      <div className="overflow-x-auto scrollbar-none -mx-2 px-2 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-gray-100 rounded-xl min-w-max sm:min-w-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`
                flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === tab.key 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`
                  px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs
                  ${activeTab === tab.key 
                    ? 'bg-[#c0a280]/20 text-[#c0a280]' 
                    : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Underline variant
  return (
    <div className="overflow-x-auto scrollbar-none -mx-2 px-2 sm:mx-0 sm:px-0">
      <div className="flex items-center gap-0.5 sm:gap-1 border-b border-gray-100 min-w-max sm:min-w-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`
              relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 ${size === 'sm' ? 'py-2 sm:py-2.5' : 'py-2.5 sm:py-3'} 
              text-xs sm:text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === tab.key 
                ? 'text-gray-900' 
                : 'text-gray-400 hover:text-gray-600'
              }
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`
                px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs
                ${activeTab === tab.key 
                  ? 'bg-[#c0a280]/20 text-[#c0a280]' 
                  : 'bg-gray-100 text-gray-400'
                }
              `}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-3 sm:left-4 right-3 sm:right-4 h-0.5 bg-[#2d2a26] rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// SELECT (Custom Dropdown)
// =============================================================================

interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function Select({ value, onChange, options, placeholder = 'Välj...', label, size = 'md', disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  const sizeClasses = {
    sm: 'py-1.5 px-3 text-xs',
    md: 'py-2.5 px-4 text-sm',
    lg: 'py-3 px-4 text-base',
  };

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2 bg-white border border-gray-200 
          rounded-xl ${sizeClasses[size]} font-medium text-left transition-all
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-300 focus:outline-none focus:border-[#c0a280]/40 focus:ring-2 focus:ring-[#c0a280]/10'}
          ${open ? 'border-[#c0a280]/40 ring-2 ring-[#c0a280]/10' : ''}
        `}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-fadeIn">
          <div className="max-h-64 overflow-auto py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                  ${value === option.value 
                    ? 'bg-[#c0a280]/10 text-gray-900' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                {option.icon && <span className="text-gray-400">{option.icon}</span>}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-gray-400 mt-0.5">{option.description}</div>
                  )}
                </div>
                {value === option.value && (
                  <Check className="w-4 h-4 text-[#c0a280]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// INPUT
// =============================================================================

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  icon?: ReactNode;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Input({ label, icon, error, size = 'md', className = '', ...props }: InputProps) {
  const sizeClasses = {
    sm: 'py-1.5 text-xs',
    md: 'py-2.5 text-sm',
    lg: 'py-3 text-base',
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          {...props}
          className={`
            w-full ${icon ? 'pl-11' : 'pl-4'} pr-4 ${sizeClasses[size]}
            bg-white border rounded-xl font-medium
            placeholder:text-gray-400 placeholder:font-normal
            transition-all
            ${error 
              ? 'border-red-300 focus:border-red-400 focus:ring-red-100' 
              : 'border-gray-200 hover:border-gray-300 focus:border-[#c0a280]/40 focus:ring-[#c0a280]/10'
            }
            focus:outline-none focus:ring-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// =============================================================================
// BUTTON
// =============================================================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading, 
  icon, 
  disabled,
  className = '',
  ...props 
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-[#2d2a26] text-white hover:bg-[#2d2a26]/90 active:bg-[#2d2a26]/80',
    secondary: 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100',
    accent: 'bg-[#c0a280] text-white hover:bg-[#c0a280]/90 active:bg-[#c0a280]/80',
    ghost: 'text-gray-600 hover:bg-gray-100 active:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// =============================================================================
// CARD
// =============================================================================

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-5 sm:p-8',
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-xl sm:rounded-2xl ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`pb-4 mb-4 border-b border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, description }: { children: ReactNode; description?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{children}</h3>
      {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
    </div>
  );
}

// =============================================================================
// BADGE
// =============================================================================

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent';
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

export function Badge({ children, variant = 'default', size = 'sm', icon }: BadgeProps) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-600',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    error: 'bg-red-50 text-red-700',
    info: 'bg-blue-50 text-blue-700',
    accent: 'bg-[#c0a280]/20 text-[#c0a280]',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span className={`
      inline-flex items-center gap-1 font-semibold rounded-full
      ${variantClasses[variant]} ${sizeClasses[size]}
    `}>
      {icon}
      {children}
    </span>
  );
}

// =============================================================================
// STAT CARD
// =============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    positive: boolean;
  };
  accentColor?: 'gold' | 'blue' | 'green' | 'red' | 'gray';
}

export function StatCard({ label, value, icon, trend, accentColor = 'gold' }: StatCardProps) {
  const accentClasses = {
    gold: 'border-l-[#c0a280]',
    blue: 'border-l-blue-400',
    green: 'border-l-emerald-400',
    red: 'border-l-red-400',
    gray: 'border-l-gray-400',
  };

  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${accentClasses[accentColor]} rounded-xl sm:rounded-2xl p-3 sm:p-4`}>
      <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400 mb-1.5 sm:mb-2">
        {icon && <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0">{icon}</span>}
        <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider truncate">{label}</span>
      </div>
      <div className="flex items-end gap-1.5 sm:gap-2">
        <span className="text-lg sm:text-2xl font-light text-gray-900">{value}</span>
        {trend && (
          <span className={`text-[10px] sm:text-xs font-medium mb-0.5 sm:mb-1 ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MODAL
// =============================================================================

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, description, children, size = 'md', footer }: ModalProps) {
  if (!open) return null;

  const sizeClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-t-2xl sm:rounded-2xl w-full ${sizeClasses[size]} shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex items-start justify-between shrink-0">
            <div className="min-w-0 flex-1">
              {title && <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{title}</h3>}
              {description && <p className="text-xs sm:text-sm text-gray-400 mt-0.5 line-clamp-2">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-2 -m-1 sm:-m-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </div>

        {footer && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 shrink-0 safe-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="py-16 text-center">
      {icon && (
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="w-8 h-8 text-gray-300">{icon}</span>
        </div>
      )}
      <h3 className="font-medium text-gray-700">{title}</h3>
      {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// =============================================================================
// PAGE HEADER
// =============================================================================

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-6 mb-4 sm:mb-6">
      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
        {icon && (
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg sm:rounded-xl flex items-center justify-center text-gray-500 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-semibold text-gray-900 truncate">{title}</h1>
          {description && <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 line-clamp-2">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
}

// =============================================================================
// DATE INPUT
// =============================================================================

interface DateInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'date' | 'datetime-local' | 'month';
  size?: 'sm' | 'md' | 'lg';
}

export function DateInput({ label, value, onChange, type = 'date', size = 'md' }: DateInputProps) {
  const sizeClasses = {
    sm: 'py-1.5 text-xs',
    md: 'py-2.5 text-sm',
    lg: 'py-3 text-base',
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`
          w-full px-4 ${sizeClasses[size]}
          bg-white border border-gray-200 rounded-xl font-medium
          transition-all
          hover:border-gray-300 
          focus:outline-none focus:border-[#c0a280]/40 focus:ring-2 focus:ring-[#c0a280]/10
        `}
      />
    </div>
  );
}

// =============================================================================
// TOGGLE
// =============================================================================

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <div className="relative shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          className="sr-only peer"
          disabled={disabled}
        />
        <div className={`
          w-10 h-6 rounded-full transition-colors
          ${checked ? 'bg-[#c0a280]' : 'bg-gray-200'}
        `} />
        <div className={`
          absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `} />
      </div>
      {(label || description) && (
        <div>
          {label && <div className="text-sm font-medium text-gray-900">{label}</div>}
          {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
        </div>
      )}
    </label>
  );
}

// =============================================================================
// ALERT
// =============================================================================

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
}

export function Alert({ variant = 'info', title, children, icon, onClose }: AlertProps) {
  const variantClasses = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${variantClasses[variant]}`}>
      <div className="flex items-start gap-3">
        {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
        <div className="flex-1">
          {title && <div className="font-semibold text-sm mb-0.5">{title}</div>}
          <div className="text-sm">{children}</div>
        </div>
        {onClose && (
          <button 
            onClick={onClose} 
            className="shrink-0 p-1 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SKELETON
// =============================================================================

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-gray-200 rounded animate-pulse ${className}`} />
  );
}

// =============================================================================
// DATA TABLE
// =============================================================================

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyState?: ReactNode;
  loading?: boolean;
}

export function DataTable<T>({ columns, data, keyExtractor, onRowClick, emptyState, loading }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-[#c0a280] animate-spin" />
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col) => (
              <th 
                key={col.key} 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider"
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((item) => (
            <tr 
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={`
                ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                transition-colors
              `}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-4 text-sm text-gray-700">
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

