'use client';

import { useState, useRef, useEffect } from 'react';
import { HelpCircle, ExternalLink, AlertCircle, CheckCircle2, Info } from 'lucide-react';

export interface FieldSourceInfo {
  source: 'openfigi' | 'gleif' | 'yahoo_finance' | 'mic_database' | 'isin_derivation' | 'regulatory_rule' | 'ai_analysis' | 'datia' | 'esg_provider';
  sourceUrl?: string;
  retrievedAt?: string;
  confidence: 'high' | 'medium' | 'low' | 'not_found';
  rawValue?: string | number | boolean;
  basedOn?: string[]; // For AI-generated fields
  reasoning?: string; // For AI-generated fields
}

interface SourceIndicatorProps {
  source: FieldSourceInfo;
  className?: string;
  showInline?: boolean;
}

const SOURCE_NAMES: Record<FieldSourceInfo['source'], string> = {
  'openfigi': 'OpenFIGI (Bloomberg)',
  'gleif': 'GLEIF',
  'yahoo_finance': 'Yahoo Finance',
  'mic_database': 'ISO MIC Database',
  'isin_derivation': 'ISIN Standard',
  'regulatory_rule': 'FFFS 2013:9 / LVF',
  'ai_analysis': 'AI-analys (Claude)',
  'datia': 'Datia ESG',
  'esg_provider': 'ESG-dataleverantör',
};

const SOURCE_DESCRIPTIONS: Record<FieldSourceInfo['source'], string> = {
  'openfigi': 'Gratis värdepappersidentifieringstjänst från Bloomberg',
  'gleif': 'Global Legal Entity Identifier Foundation - officiell LEI-databas',
  'yahoo_finance': 'Marknadsdata och nyckeltal',
  'mic_database': 'ISO 10383 Market Identifier Codes',
  'isin_derivation': 'Härledd från ISIN-kodens struktur',
  'regulatory_rule': 'Baserat på svensk fondlagstiftning (FFFS 2013:9, LVF 2004:46)',
  'ai_analysis': 'Genererat av AI baserat på verifierad data',
  'datia': 'ESG-data från Datia ECO API — hållbarhetspoäng, exkluderingsscreening och PAI-indikatorer',
  'esg_provider': 'ESG-data från extern dataleverantör',
};

export function SourceIndicator({ source, className = '', showInline = false }: SourceIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Calculate position on open
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      setPosition(spaceBelow < 200 && spaceAbove > spaceBelow ? 'top' : 'bottom');
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current && 
        !tooltipRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getConfidenceColor = () => {
    switch (source.confidence) {
      case 'high':
        return 'text-green-600';
      case 'medium':
        return 'text-amber-600';
      case 'low':
        return 'text-orange-600';
      case 'not_found':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getConfidenceIcon = () => {
    switch (source.confidence) {
      case 'high':
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
      case 'medium':
        return <Info className="w-3.5 h-3.5 text-amber-600" />;
      case 'low':
      case 'not_found':
        return <AlertCircle className="w-3.5 h-3.5 text-orange-600" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  const getConfidenceText = () => {
    switch (source.confidence) {
      case 'high':
        return 'Hög tillförlitlighet';
      case 'medium':
        return 'Medel tillförlitlighet';
      case 'low':
        return 'Låg tillförlitlighet';
      case 'not_found':
        return 'Data hittades inte';
      default:
        return 'Okänd';
    }
  };

  if (source.confidence === 'not_found') {
    return (
      <div className={`inline-flex items-center gap-1 text-xs text-red-600 ${className}`}>
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Ej funnet</span>
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 text-xs ${getConfidenceColor()} hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 rounded`}
        title="Visa källa"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        {showInline && (
          <span className="text-gray-500">{SOURCE_NAMES[source.source]}</span>
        )}
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg ${
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } left-0`}
        >
          {/* Arrow */}
          <div
            className={`absolute left-3 ${
              position === 'top' ? 'bottom-0 translate-y-full' : 'top-0 -translate-y-full'
            }`}
          >
            <div
              className={`w-2 h-2 bg-white border-gray-200 transform rotate-45 ${
                position === 'top' ? 'border-b border-r' : 'border-t border-l'
              }`}
            />
          </div>

          {/* Content */}
          <div className="p-3 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm text-gray-900">
                  {SOURCE_NAMES[source.source]}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {SOURCE_DESCRIPTIONS[source.source]}
                </p>
              </div>
              {source.sourceUrl && (
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 p-1"
                  title="Öppna källa"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Confidence */}
            <div className="flex items-center gap-2 py-2 px-2.5 bg-gray-50 rounded-lg">
              {getConfidenceIcon()}
              <span className="text-xs font-medium text-gray-700">
                {getConfidenceText()}
              </span>
            </div>

            {/* Raw value if different */}
            {source.rawValue !== undefined && (
              <div className="text-xs">
                <span className="text-gray-500">Ursprungligt värde: </span>
                <span className="font-mono text-gray-700">
                  {typeof source.rawValue === 'boolean' 
                    ? source.rawValue ? 'true' : 'false'
                    : String(source.rawValue)
                  }
                </span>
              </div>
            )}

            {/* AI-specific: based on */}
            {source.basedOn && source.basedOn.length > 0 && (
              <div className="text-xs">
                <p className="text-gray-500 mb-1">Baserat på:</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700">
                  {source.basedOn.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI-specific: reasoning */}
            {source.reasoning && (
              <div className="text-xs">
                <p className="text-gray-500 mb-1">Motivering:</p>
                <p className="text-gray-700">{source.reasoning}</p>
              </div>
            )}

            {/* Timestamp */}
            {source.retrievedAt && (
              <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                Hämtad: {new Date(source.retrievedAt).toLocaleString('sv-SE')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Wrapper for displaying a field with its source indicator
 */
interface SourcedFieldDisplayProps {
  label: string;
  value: string | number | boolean | undefined;
  source?: FieldSourceInfo;
  notFoundMessage?: string;
  className?: string;
}

export function SourcedFieldDisplay({ 
  label, 
  value, 
  source, 
  notFoundMessage = 'Information hittades inte',
  className = '' 
}: SourcedFieldDisplayProps) {
  const isNotFound = !value || source?.confidence === 'not_found';

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {source && <SourceIndicator source={source} />}
      </div>
      {isNotFound ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-800">{notFoundMessage}</span>
        </div>
      ) : (
        <p className="text-sm text-gray-900">
          {typeof value === 'boolean' ? (value ? 'Ja' : 'Nej') : value}
        </p>
      )}
    </div>
  );
}

/**
 * Input field with source indicator
 */
interface SourcedInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  source?: FieldSourceInfo;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  type?: 'text' | 'url' | 'number';
  className?: string;
}

export function SourcedInput({
  label,
  value,
  onChange,
  source,
  placeholder,
  disabled = false,
  required = false,
  type = 'text',
  className = '',
}: SourcedInputProps) {
  const isAutoFilled = source && source.confidence !== 'not_found' && value;
  
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {source && <SourceIndicator source={source} />}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg transition-colors ${
          isAutoFilled
            ? 'border-green-300 bg-green-50/50 focus:ring-2 focus:ring-green-500/20 focus:border-green-500'
            : 'border-gray-300 focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      />
      {isAutoFilled && (
        <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Automatiskt ifyllt
        </p>
      )}
    </div>
  );
}

/**
 * Checkbox with source indicator
 */
interface SourcedCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  source?: FieldSourceInfo;
  disabled?: boolean;
  className?: string;
}

export function SourcedCheckbox({
  label,
  checked,
  onChange,
  source,
  disabled = false,
  className = '',
}: SourcedCheckboxProps) {
  const isAutoFilled = source && source.confidence !== 'not_found';

  return (
    <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
      isAutoFilled 
        ? 'bg-green-50 border border-green-200 hover:bg-green-100' 
        : 'bg-gray-50 hover:bg-gray-100'
    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 w-4 h-4 text-aifm-gold border-gray-300 rounded focus:ring-aifm-gold"
      />
      <span className="flex-1 text-sm text-gray-700">{label}</span>
      {source && <SourceIndicator source={source} />}
    </label>
  );
}

/**
 * Textarea with source indicator
 */
interface SourcedTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  source?: FieldSourceInfo;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  helperText?: string;
}

export function SourcedTextarea({
  label,
  value,
  onChange,
  source,
  placeholder,
  rows = 3,
  disabled = false,
  required = false,
  className = '',
  helperText,
}: SourcedTextareaProps) {
  const isAutoFilled = source && source.confidence !== 'not_found' && value;
  const isNotFound = source?.confidence === 'not_found';

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {source && <SourceIndicator source={source} />}
      </div>
      
      {isNotFound && source?.reasoning && (
        <div className="flex items-start gap-2 px-3 py-2 mb-2 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-amber-800">{source.reasoning}</span>
        </div>
      )}
      
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg resize-none transition-colors ${
          isAutoFilled
            ? 'border-green-300 bg-green-50/50 focus:ring-2 focus:ring-green-500/20 focus:border-green-500'
            : 'border-gray-300 focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      />
      
      {helperText && (
        <p className="mt-1 text-xs text-gray-500">{helperText}</p>
      )}
      
      {isAutoFilled && (
        <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Automatiskt ifyllt av AI
        </p>
      )}
    </div>
  );
}
