'use client';

import { usePWA } from '@/lib/pwa/usePWA';
import { RefreshCw } from 'lucide-react';

export function UpdateBanner() {
  const { isUpdateAvailable, update } = usePWA();

  if (!isUpdateAvailable) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[100] bg-emerald-600 text-white px-4 py-2 flex items-center justify-center gap-3 shadow-md"
    >
      <span className="text-sm font-medium">Ny version tillgänglig</span>
      <button
        onClick={() => update()}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
        aria-label="Uppdatera sidan"
      >
        <RefreshCw className="w-4 h-4" />
        Uppdatera
      </button>
    </div>
  );
}
