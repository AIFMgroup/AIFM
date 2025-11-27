'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
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
          // Redirect to overview or intended destination
          const urlParams = new URLSearchParams(window.location.search);
          const callbackUrl = urlParams.get('callbackUrl') || '/overview';
          window.location.href = callbackUrl; // Use window.location for full page reload to set cookie
        } else {
          setError(data.error || 'Invalid password');
        }
      } catch {
        setError('An error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      setError('Invalid password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <Card className="border border-gray-200 bg-white rounded-2xl shadow-aifm-lg w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-aifm-gold rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-3xl">A</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-medium text-aifm-charcoal mb-2 tracking-wider">
            ACCESS REQUIRED
          </CardTitle>
          <p className="text-sm text-aifm-charcoal/60 uppercase tracking-wider">
            Enter password to continue
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-aifm-charcoal/40" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.toUpperCase())}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 transition-all text-sm uppercase"
                  placeholder="Enter password"
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
            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full btn-primary py-3"
            >
              {loading ? 'Verifying...' : 'Enter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
