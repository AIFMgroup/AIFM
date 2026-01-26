'use client';

import React, { useState } from 'react';
import { usePWA } from '@/lib/pwa/usePWA';

export function InstallBanner() {
  const { isInstallable, isInstalled, install } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || isInstalled || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 animate-slideInRight">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-[#2d2a26] to-[#4d4a46] rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm">Installera AIFM</h3>
          <p className="text-xs text-gray-500 mt-1">
            Få snabb åtkomst och offline-stöd genom att installera appen.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={install}
              className="px-3 py-1.5 bg-[#2d2a26] text-white text-xs font-medium rounded-lg hover:bg-[#3d3a36] transition-colors"
            >
              Installera
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-gray-500 text-xs font-medium hover:text-gray-700 transition-colors"
            >
              Inte nu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



