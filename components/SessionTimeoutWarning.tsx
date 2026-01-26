'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { 
  startSessionTimeout, 
  stopSessionTimeout, 
  extendSession,
  getTimeRemaining,
  formatTimeRemaining 
} from '@/lib/security/sessionTimeout';

interface SessionTimeoutWarningProps {
  timeoutMinutes?: number;
  warningMinutes?: number;
  onLogout?: () => void;
}

export function SessionTimeoutWarning({
  timeoutMinutes = 30,
  warningMinutes = 5,
  onLogout,
}: SessionTimeoutWarningProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(() => {
    setIsLoggingOut(true);
    stopSessionTimeout();
    if (onLogout) {
      onLogout();
    } else {
      window.location.href = '/auth/logout';
    }
  }, [onLogout]);

  const handleExtend = useCallback(() => {
    extendSession();
    setShowWarning(false);
  }, []);

  useEffect(() => {
    // Initialize session timeout manager
    startSessionTimeout({
      timeoutMs: timeoutMinutes * 60 * 1000,
      warningMs: warningMinutes * 60 * 1000,
      onWarning: () => setShowWarning(true),
      onTimeout: handleLogout,
    });

    return () => stopSessionTimeout();
  }, [timeoutMinutes, warningMinutes, handleLogout]);

  // Update countdown when warning is shown
  useEffect(() => {
    if (!showWarning) return;

    const interval = setInterval(() => {
      const remaining = getTimeRemaining();
      setTimeRemaining(remaining);
      
      if (remaining <= 0) {
        clearInterval(interval);
        handleLogout();
      }
    }, 1000);

    // Initial value
    setTimeRemaining(getTimeRemaining());

    return () => clearInterval(interval);
  }, [showWarning, handleLogout]);

  if (!showWarning) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" />
      
      {/* Warning Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
            Sessionen går snart ut
          </h2>

          {/* Message */}
          <p className="text-gray-600 text-center mb-4">
            Du har varit inaktiv en längre tid. För din säkerhet loggas du ut om:
          </p>

          {/* Countdown */}
          <div className="text-center mb-6">
            <span className="text-3xl font-bold text-amber-600">
              {formatTimeRemaining(timeRemaining)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-100 rounded-full mb-6 overflow-hidden">
            <div 
              className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
              style={{ 
                width: `${Math.min(100, (timeRemaining / (warningMinutes * 60 * 1000)) * 100)}%` 
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              Logga ut
            </button>
            <button
              onClick={handleExtend}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-aifm-gold text-white rounded-xl hover:bg-aifm-gold/90 transition-colors font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Fortsätt arbeta
            </button>
          </div>

          {/* Note */}
          <p className="text-xs text-gray-400 text-center mt-4">
            Osparade ändringar kan gå förlorade vid utloggning
          </p>
        </div>
      </div>
    </>
  );
}















