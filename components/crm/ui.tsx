'use client';

import { useState, useRef, useEffect, ReactNode, forwardRef } from 'react';
import { Check, ChevronDown, Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Custom Select / Dropdown
// ============================================================================

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  color?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showSearch?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Select({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Välj...', 
  disabled = false,
  className,
  showSearch = false,
  size = 'md',
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = showSearch && search
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.description?.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && showSearch && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, showSearch]);

  const sizeClasses = {
    sm: 'h-8 text-xs px-2.5',
    md: 'h-10 text-sm px-3',
    lg: 'h-12 text-base px-4',
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-xl',
          'transition-all duration-200 outline-none',
          'hover:border-gray-300 focus:border-[#c0a280] focus:ring-2 focus:ring-[#c0a280]/10',
          disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
          isOpen && 'border-[#c0a280] ring-2 ring-[#c0a280]/10',
          sizeClasses[size]
        )}
      >
        <span className={cn(
          'flex items-center gap-2 truncate',
          !selectedOption && 'text-gray-400'
        )}>
          {selectedOption?.icon}
          {selectedOption?.color && (
            <span 
              className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {showSearch && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Sök..."
                  className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border-0 rounded-lg focus:ring-0 focus:bg-gray-100 transition-colors"
                />
              </div>
            </div>
          )}
          
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-400">
                Inga alternativ hittades
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    'hover:bg-gray-50 active:bg-gray-100',
                    option.value === value && 'bg-[#c0a280]/5'
                  )}
                >
                  {option.icon && (
                    <span className="flex-shrink-0 text-gray-500">{option.icon}</span>
                  )}
                  {option.color && (
                    <span 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {option.label}
                    </div>
                    {option.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {option.description}
                      </div>
                    )}
                  </div>
                  {option.value === value && (
                    <Check className="w-4 h-4 text-[#c0a280] flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Status Pills
// ============================================================================

interface StatusPillProps {
  status: string;
  variant?: 'default' | 'dot' | 'badge';
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  // Contact statuses
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Aktiv' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Inaktiv' },
  archived: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Arkiverad' },
  
  // Company statuses
  lead: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400', label: 'Lead' },
  prospect: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Prospekt' },
  customer: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Kund' },
  partner: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Partner' },
  
  // Deal stages
  qualified: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Kvalificerad' },
  proposal: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', label: 'Offert' },
  negotiation: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Förhandling' },
  won: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Vunnen' },
  lost: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Förlorad' },
  
  // Task statuses
  todo: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400', label: 'Att göra' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Pågår' },
  waiting: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Väntar' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Klar' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Avbruten' },
  
  // Task priorities
  low: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Låg' },
  medium: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Medel' },
  high: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Hög' },
  urgent: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Brådskande' },
  
  // Activity statuses
  scheduled: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Planerad' },
  no_show: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Utebliven' },
  
  // Open/closed
  open: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Öppen' },
};

export function StatusPill({ status, variant = 'default', size = 'sm', className }: StatusPillProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
  
  if (variant === 'dot') {
    return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        <span className={cn('w-2 h-2 rounded-full', config.dot)} />
        <span className="text-sm text-gray-700">{config.label}</span>
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full',
      config.bg, config.text,
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      className
    )}>
      {config.label}
    </span>
  );
}

// ============================================================================
// Input Components
// ============================================================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  helper?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, helper, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-sm',
              'placeholder:text-gray-400',
              'transition-all duration-200 outline-none',
              'hover:border-gray-300',
              'focus:border-[#c0a280] focus:ring-2 focus:ring-[#c0a280]/10',
              'disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed',
              error && 'border-red-300 focus:border-red-500 focus:ring-red-500/10',
              icon && 'pl-10',
              className
            )}
            {...props}
          />
        </div>
        {helper && !error && (
          <p className="text-xs text-gray-500">{helper}</p>
        )}
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ============================================================================
// Textarea
// ============================================================================

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helper, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm',
            'placeholder:text-gray-400 resize-none',
            'transition-all duration-200 outline-none',
            'hover:border-gray-300',
            'focus:border-[#c0a280] focus:ring-2 focus:ring-[#c0a280]/10',
            'disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed',
            error && 'border-red-300 focus:border-red-500 focus:ring-red-500/10',
            className
          )}
          {...props}
        />
        {helper && !error && (
          <p className="text-xs text-gray-500">{helper}</p>
        )}
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// ============================================================================
// Button Components
// ============================================================================

// Button consolidated: use canonical @/components/Button
export { Button, type ButtonProps } from '@/components/Button';

// ============================================================================
// IconButton
// ============================================================================

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  tooltip,
  className,
  children,
  ...props
}: IconButtonProps) {
  const variantClasses = {
    ghost: 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200',
    outline: 'text-gray-500 border border-gray-200 hover:bg-gray-50 hover:border-gray-300',
    danger: 'text-gray-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100',
  };

  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg',
        'transition-all duration-200 outline-none',
        'focus-visible:ring-2 focus-visible:ring-[#c0a280] focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      title={tooltip}
      {...props}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Search Input
// ============================================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchInput({ 
  value, 
  onChange, 
  placeholder = 'Sök...', 
  className,
  autoFocus,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          'w-full h-10 pl-10 pr-10 bg-white border border-gray-200 rounded-xl text-sm',
          'placeholder:text-gray-400',
          'transition-all duration-200 outline-none',
          'hover:border-gray-300',
          'focus:border-[#c0a280] focus:ring-2 focus:ring-[#c0a280]/10'
        )}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Avatar
// ============================================================================

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn(
          'rounded-full object-cover',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br from-[#c0a280] to-[#2d2a26] flex items-center justify-center text-white font-medium',
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}

// ============================================================================
// Card
// ============================================================================

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

export function Card({ children, className, onClick, interactive = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl border border-gray-100',
        interactive && 'cursor-pointer hover:shadow-lg hover:border-gray-200 transition-all duration-200 active:scale-[0.99]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 py-4 border-b border-gray-100', className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('p-5', className)}>
      {children}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <span className="text-gray-400">{icon}</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mb-4 max-w-sm">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} icon={action.icon}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Modal
// ============================================================================

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className={cn(
        'relative w-full bg-white rounded-2xl shadow-xl overflow-hidden',
        'animate-in fade-in zoom-in-95 duration-200',
        sizeClasses[size]
      )}>
        {(title || description) && (
          <div className="px-6 pt-6 pb-4">
            {title && (
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-gray-500 mt-1">{description}</p>
            )}
          </div>
        )}
        {children}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export function ModalActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100', className)}>
      {children}
    </div>
  );
}

// ============================================================================
// Tabs
// ============================================================================

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  variant?: 'pills' | 'underline';
}

export function Tabs({ tabs, value, onChange, variant = 'pills' }: TabsProps) {
  if (variant === 'underline') {
    return (
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab.id === value
                ? 'border-[#c0a280] text-[#2d2a26]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                'px-1.5 py-0.5 text-xs rounded-full',
                tab.id === value ? 'bg-[#c0a280]/10 text-[#c0a280]' : 'bg-gray-100 text-gray-500'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all',
            tab.id === value
              ? 'bg-white text-[#2d2a26] shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'px-1.5 py-0.5 text-xs rounded-full',
              tab.id === value ? 'bg-[#c0a280]/10 text-[#c0a280]' : 'bg-gray-200/80 text-gray-500'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

