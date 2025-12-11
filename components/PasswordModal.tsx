'use client';

import { useState, useEffect } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/Button';

interface PasswordModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

const CORRECT_CODE = 'AIFM';

export function PasswordModal({ isOpen, onSuccess }: PasswordModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setCode('');
      setError(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(false);

    // Simulate a small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));

    if (code.toUpperCase().trim() === CORRECT_CODE) {
      // Store in localStorage to remember for this session
      localStorage.setItem('aifm_access_granted', 'true');
      localStorage.setItem('aifm_access_time', Date.now().toString());
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setCode('');
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md transform transition-all animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="relative p-6 border-b-2 border-gray-200">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 text-center uppercase tracking-wide mb-2">
            Åtkomst Skyddad
          </h2>
          <p className="text-sm text-gray-600 text-center">
            Ange åtkomstkod för att fortsätta
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
              Åtkomstkod
            </label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(false);
                }}
                onKeyDown={handleKeyDown}
                className={`
                  w-full px-4 py-3 border-2 rounded-xl text-center text-lg font-bold tracking-widest
                  uppercase focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all
                  ${error 
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white'
                  }
                `}
                placeholder="____"
                autoFocus
                disabled={isSubmitting}
                maxLength={4}
              />
              {error && (
                <div className="absolute -bottom-6 left-0 right-0 flex items-center justify-center gap-2 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Felaktig kod. Försök igen.</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={!code.trim() || isSubmitting}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl py-3 uppercase tracking-wide font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Verifierar...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" />
                  Verifiera Kod
                </span>
              )}
            </Button>
            
            <div className="text-xs text-gray-500 text-center pt-2">
              <p>Koden är skiftlägesokänslig</p>
            </div>
          </div>
        </form>

        {/* Decorative elements */}
        <div className="absolute top-4 right-4 opacity-20">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full blur-2xl"></div>
        </div>
        <div className="absolute bottom-4 left-4 opacity-20">
          <div className="w-32 h-32 bg-gradient-to-tr from-purple-400 to-pink-400 rounded-full blur-2xl"></div>
        </div>
      </div>
    </div>
  );
}

