'use client';

import { useState, useRef, useEffect } from 'react';
import {
  MoreHorizontal,
  Wand2,
  Minimize2,
  Maximize2,
  Briefcase,
  Download,
  FileText,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export interface ActionDropdownProps {
  onRegenerate?: () => void;
  onReformulate?: (type: 'simplify' | 'expand' | 'formal') => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  isExporting: 'pdf' | 'excel' | null;
  isDarkMode?: boolean;
}

export function ActionDropdown({
  onRegenerate,
  onReformulate,
  onExportPDF,
  onExportExcel,
  isExporting,
  isDarkMode = false,
}: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative ml-auto" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-1.5 rounded-lg transition-all duration-200 ${
          isOpen
            ? 'text-[#c0a280] bg-[#c0a280]/10'
            : isDarkMode
              ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
        }`}
        title="Fler åtgärder"
        aria-label="Fler åtgärder"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 bottom-full mb-2 w-56 rounded-xl shadow-xl border 
                     overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {onReformulate && (
            <>
              <div className={`px-4 py-2 ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDarkMode ? 'text-gray-500' : 'text-gray-400'
                  }`}
                >
                  <Wand2 className="w-3 h-3" />
                  Omformulera
                </span>
              </div>
              <div className="py-1">
                <button
                  onClick={() => handleAction(() => onReformulate('simplify'))}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    isDarkMode
                      ? 'text-gray-300 hover:bg-blue-900/30 hover:text-blue-300'
                      : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <Minimize2 className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
                  <span>Förenkla svaret</span>
                </button>
                <button
                  onClick={() => handleAction(() => onReformulate('expand'))}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    isDarkMode
                      ? 'text-gray-300 hover:bg-purple-900/30 hover:text-purple-300'
                      : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
                  }`}
                >
                  <Maximize2 className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-500'}`} />
                  <span>Utveckla svaret</span>
                </button>
                <button
                  onClick={() => handleAction(() => onReformulate('formal'))}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    isDarkMode
                      ? 'text-gray-300 hover:bg-amber-900/30 hover:text-amber-300'
                      : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  <Briefcase className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`} />
                  <span>Gör formellt</span>
                </button>
              </div>
              <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`} />
            </>
          )}

          <div className={`px-4 py-2 ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                isDarkMode ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              <Download className="w-3 h-3" />
              Exportera
            </span>
          </div>
          <div className="py-1">
            <button
              onClick={() => handleAction(onExportPDF)}
              disabled={isExporting !== null}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors disabled:opacity-50 ${
                isDarkMode
                  ? 'text-gray-300 hover:bg-red-900/30 hover:text-red-300'
                  : 'text-gray-600 hover:bg-red-50 hover:text-red-700'
              }`}
            >
              {isExporting === 'pdf' ? (
                <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
              ) : (
                <FileText className={`w-4 h-4 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
              )}
              <span>Ladda ner som PDF</span>
            </button>
            <button
              onClick={() => handleAction(onExportExcel)}
              disabled={isExporting !== null}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors disabled:opacity-50 ${
                isDarkMode
                  ? 'text-gray-300 hover:bg-green-900/30 hover:text-green-300'
                  : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
              }`}
            >
              {isExporting === 'excel' ? (
                <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
              ) : (
                <FileSpreadsheet className={`w-4 h-4 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
              )}
              <span>Ladda ner som Excel</span>
            </button>
          </div>

          {onRegenerate && (
            <>
              <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`} />
              <button
                onClick={() => handleAction(onRegenerate)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                  isDarkMode
                    ? 'text-gray-300 hover:bg-[#c0a280]/20 hover:text-[#d4b896]'
                    : 'text-gray-600 hover:bg-[#c0a280]/10 hover:text-[#c0a280]'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Generera nytt svar</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
