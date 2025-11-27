'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Lock, AlertCircle } from 'lucide-react';

const REQUIRED_PASSWORD = 'AIFM';

export default function PasswordGatePage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password === REQUIRED_PASSWORD) {
      try {
        const response = await fetch('/api/password-gate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Redirect to overview
          window.location.href = '/overview';
        } else {
          setError(data.error || 'Felaktigt lösenord');
        }
      } catch {
        setError('Ett fel uppstod. Försök igen.');
      } finally {
        setLoading(false);
      }
    } else {
      setError('Felaktigt lösenord');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Logo at top left */}
      <div className="absolute top-6 left-8">
        <Image 
          src="/frilagd_logo.png" 
          alt="AIFM" 
          width={140} 
          height={50}
          className="object-contain"
          priority
        />
      </div>

      {/* Main content - split layout */}
      <div className="min-h-screen flex">
        {/* Left side - Mascot */}
        <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-aifm-charcoal/5 to-transparent">
          <div className="text-center">
            <Image 
              src="/maskot6.png" 
              alt="AIFM Maskot" 
              width={320} 
              height={320}
              className="object-contain mx-auto"
              priority
            />
            <div className="mt-8 max-w-md mx-auto px-8">
              <h2 className="text-2xl font-medium text-aifm-charcoal mb-3">
                Välkommen till AIFM
              </h2>
              <p className="text-aifm-charcoal/60">
                Din kompletta plattform för fondadministration, investerarhantering och compliance.
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile mascot */}
            <div className="lg:hidden flex justify-center mb-8">
              <Image 
                src="/maskot6.png" 
                alt="AIFM Maskot" 
                width={150} 
                height={150}
                className="object-contain"
              />
            </div>

            {/* Login Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-xl font-medium text-aifm-charcoal uppercase tracking-wider mb-2">
                  Logga in
                </h2>
                <p className="text-sm text-aifm-charcoal/50">
                  Ange lösenord för att fortsätta
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                    Lösenord
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-aifm-charcoal/40" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value.toUpperCase())}
                      className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all text-sm uppercase bg-gray-50"
                      placeholder="••••••••"
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  {error && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full btn-primary py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Verifierar...
                    </span>
                  ) : (
                    'Logga in'
                  )}
                </button>
              </form>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-aifm-charcoal/40 mt-6">
              © {new Date().getFullYear()} AIFM Group. Alla rättigheter förbehållna.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
