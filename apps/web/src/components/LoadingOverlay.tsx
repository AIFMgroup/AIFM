'use client';

import { Building2, Loader2 } from 'lucide-react';
import { useCompany } from './CompanyContext';

export function LoadingOverlay() {
  const { isLoading, selectedCompany } = useCompany();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 animate-in fade-in duration-300">
        {/* Animated logo container */}
        <div className="relative">
          {/* Outer pulsing ring */}
          <div className="absolute inset-0 -m-4 rounded-full bg-aifm-gold/20 animate-ping" />
          <div className="absolute inset-0 -m-2 rounded-full bg-aifm-gold/10 animate-pulse" />
          
          {/* Company icon */}
          <div 
            className="relative w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl"
            style={{ 
              backgroundColor: selectedCompany.color + '15',
              boxShadow: `0 20px 60px ${selectedCompany.color}30`
            }}
          >
            <Building2 
              className="w-10 h-10 animate-pulse" 
              style={{ color: selectedCompany.color }} 
            />
          </div>
        </div>

        {/* Loading text */}
        <div className="text-center">
          <div className="flex items-center gap-2 justify-center mb-2">
            <Loader2 className="w-4 h-4 text-aifm-gold animate-spin" />
            <span className="text-sm font-medium text-aifm-charcoal">
              Laddar data...
            </span>
          </div>
          <p className="text-xs text-aifm-charcoal/50">
            Byter till {selectedCompany.shortName}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-aifm-gold to-aifm-charcoal rounded-full animate-pulse"
            style={{
              animation: 'loadingProgress 0.8s ease-out forwards'
            }}
          />
        </div>
      </div>

      {/* Keyframes for progress animation */}
      <style jsx>{`
        @keyframes loadingProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}

