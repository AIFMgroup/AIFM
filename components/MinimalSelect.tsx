'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MinimalSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  variant?: 'light' | 'dark';
  placeholder?: string;
  className?: string;
}

export function MinimalSelect({ 
  value, 
  onChange, 
  options,
  variant = 'dark',
  placeholder = 'Välj...',
  className = ''
}: MinimalSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(o => o.value === value);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const baseStyles = variant === 'dark' 
    ? 'bg-white/10 border-white/20 text-white hover:bg-white/15' 
    : 'bg-gray-50 border-gray-200 text-aifm-charcoal hover:bg-gray-100';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm
                   transition-all focus:outline-none focus:ring-2 focus:ring-aifm-gold/50 ${baseStyles}`}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[200px] bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between
                ${value === option.value 
                  ? 'bg-aifm-gold/10 text-aifm-charcoal font-medium' 
                  : 'text-aifm-charcoal/70 hover:bg-gray-50'}`}
            >
              <span className="truncate">{option.label}</span>
              {value === option.value && <Check className="w-4 h-4 text-aifm-gold flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}





