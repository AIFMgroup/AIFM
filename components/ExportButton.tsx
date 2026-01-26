'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  onExportCSV: () => void | Promise<void>;
  onExportExcel?: () => void | Promise<void>;
  onExportJSON?: () => void | Promise<void>;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function ExportButton({ 
  onExportCSV, 
  onExportExcel,
  onExportJSON,
  label = 'Exportera',
  disabled = false,
  size = 'md'
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (exportFn: () => void | Promise<void>) => {
    setIsExporting(true);
    try {
      await exportFn();
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const sizeClasses = size === 'sm' 
    ? 'px-3 py-1.5 text-xs'
    : 'px-4 py-2 text-sm';

  // If only CSV export, show simple button
  if (!onExportExcel && !onExportJSON) {
    return (
      <button
        onClick={() => handleExport(onExportCSV)}
        disabled={disabled || isExporting}
        className={`flex items-center gap-2 ${sizeClasses} font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {label}
      </button>
    );
  }

  // Dropdown with multiple export options
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className={`flex items-center gap-2 ${sizeClasses} font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-20 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            onClick={() => handleExport(onExportCSV)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <FileText className="w-4 h-4 text-green-600" />
            Exportera som CSV
          </button>
          
          {onExportExcel && (
            <button
              onClick={() => handleExport(onExportExcel)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-700" />
              Exportera som Excel
            </button>
          )}
          
          {onExportJSON && (
            <button
              onClick={() => handleExport(onExportJSON)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              Exportera som JSON
            </button>
          )}
        </div>
      )}
    </div>
  );
}



