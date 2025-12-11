'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  variant?: 'default' | 'minimal' | 'gold';
  size?: 'sm' | 'md' | 'lg';
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Välj...',
  className = '',
  variant = 'default',
  size = 'md'
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base'
  };

  const variantClasses = {
    default: `
      bg-white border border-gray-200 text-aifm-charcoal
      hover:border-aifm-gold/50 hover:shadow-sm
      focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20
    `,
    minimal: `
      bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 text-aifm-charcoal
      hover:from-aifm-gold/5 hover:to-aifm-gold/10 hover:border-aifm-gold/30
    `,
    gold: `
      bg-gradient-to-r from-aifm-gold/10 to-aifm-gold/5 border border-aifm-gold/30 text-aifm-charcoal
      hover:from-aifm-gold/20 hover:to-aifm-gold/10 hover:border-aifm-gold/50
    `
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between gap-2 w-full rounded-xl font-medium
          transition-all duration-300 group outline-none
          ${sizeClasses[size]}
          ${variantClasses[variant]}
        `}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown 
          className={`
            w-4 h-4 text-aifm-charcoal/40 group-hover:text-aifm-gold 
            transition-all duration-300 flex-shrink-0
            ${isOpen ? 'rotate-180' : ''}
          `} 
        />
      </button>
      
      {isOpen && (
        <div 
          className="
            absolute top-full left-0 right-0 mt-2 bg-white rounded-xl 
            border border-gray-100 shadow-xl overflow-hidden z-50
            animate-in fade-in slide-in-from-top-2 duration-200
          "
        >
          <div className="max-h-60 overflow-auto py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center justify-between gap-3 px-4 py-2.5
                  text-left transition-all duration-200
                  ${value === option.value 
                    ? 'bg-aifm-gold/10 text-aifm-gold' 
                    : 'text-aifm-charcoal hover:bg-gray-50'}
                  ${size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'}
                `}
              >
                <span className="flex items-center gap-2">
                  {option.icon}
                  {option.label}
                </span>
                {value === option.value && (
                  <Check className="w-4 h-4 text-aifm-gold" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Multi-select variant
interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Välj...',
  className = ''
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const selectedLabels = options
    .filter(o => value.includes(o.value))
    .map(o => o.label);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center justify-between gap-2 w-full px-3 py-2 text-sm
          bg-white border border-gray-200 rounded-xl font-medium text-aifm-charcoal
          hover:border-aifm-gold/50 hover:shadow-sm
          transition-all duration-300 group outline-none
        "
      >
        <span className="truncate">
          {selectedLabels.length > 0 
            ? selectedLabels.length > 2 
              ? `${selectedLabels.length} valda`
              : selectedLabels.join(', ')
            : placeholder}
        </span>
        <ChevronDown 
          className={`
            w-4 h-4 text-aifm-charcoal/40 group-hover:text-aifm-gold 
            transition-all duration-300 flex-shrink-0
            ${isOpen ? 'rotate-180' : ''}
          `} 
        />
      </button>
      
      {isOpen && (
        <div 
          className="
            absolute top-full left-0 right-0 mt-2 bg-white rounded-xl 
            border border-gray-100 shadow-xl overflow-hidden z-50
            animate-in fade-in slide-in-from-top-2 duration-200
          "
        >
          <div className="max-h-60 overflow-auto py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-sm
                  text-left transition-all duration-200
                  ${value.includes(option.value)
                    ? 'bg-aifm-gold/10 text-aifm-gold' 
                    : 'text-aifm-charcoal hover:bg-gray-50'}
                `}
              >
                <div className={`
                  w-4 h-4 rounded border-2 flex items-center justify-center
                  transition-all duration-200
                  ${value.includes(option.value)
                    ? 'bg-aifm-gold border-aifm-gold'
                    : 'border-gray-300'}
                `}>
                  {value.includes(option.value) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="flex items-center gap-2">
                  {option.icon}
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

