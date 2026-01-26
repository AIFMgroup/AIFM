'use client';

import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Offline Icon */}
        <div className="w-24 h-24 mx-auto mb-8 bg-gray-200 rounded-full flex items-center justify-center">
          <WifiOff className="w-12 h-12 text-gray-400" />
        </div>
        
        {/* Title */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Du är offline
        </h1>
        
        {/* Description */}
        <p className="text-gray-600 mb-8 leading-relaxed">
          Det verkar som att du har tappat internetanslutningen. 
          Kontrollera din anslutning och försök igen.
        </p>
        
        {/* Retry Button */}
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#2d2a26] text-white rounded-xl 
                     font-medium hover:bg-[#3d3a36] transition-colors shadow-lg shadow-gray-900/10"
        >
          <RefreshCw className="w-5 h-5" />
          Försök igen
        </button>
        
        {/* Info */}
        <p className="mt-8 text-sm text-gray-500">
          Vissa funktioner kan vara tillgängliga offline om de har cachats.
        </p>
        
        {/* AIFM Logo */}
        <div className="mt-12 opacity-30">
          <svg className="w-20 h-8 mx-auto" viewBox="0 0 80 32" fill="currentColor">
            <text x="0" y="24" fontFamily="serif" fontSize="24" fontStyle="italic">aifm</text>
          </svg>
        </div>
      </div>
    </div>
  );
}



