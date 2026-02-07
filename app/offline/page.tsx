'use client';

import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="p-4 bg-gray-100 rounded-full mb-6">
        <WifiOff className="w-12 h-12 text-gray-400" />
      </div>

      <h1 className="text-2xl font-semibold text-[#2d2a26] mb-2">
        Ingen internetanslutning
      </h1>
      <p className="text-gray-500 max-w-sm mb-8">
        Det verkar som att du är offline. Kontrollera din anslutning och försök igen.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 px-6 py-3 bg-[#2d2a26] text-white rounded-xl font-medium shadow-lg active:scale-95 transition-transform touch-manipulation"
      >
        <RefreshCw className="w-4 h-4" />
        Försök igen
      </button>

      <p className="text-xs text-gray-400 mt-12">
        AIFM Assistent
      </p>
    </div>
  );
}
