'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

export default function SignInPage() {
  const router = useRouter();
  const preferCognito = process.env.NEXT_PUBLIC_AUTH_PROVIDER === 'cognito';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!preferCognito) return;
    signIn('cognito', { callbackUrl: '/dashboard' });
  }, [preferCognito]);

  const handleAwsLogin = async () => {
    await signIn('cognito', { callbackUrl: '/dashboard' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else if (result?.ok) {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300">
      <div className="w-full max-w-md bg-white border-2 border-gray-300 rounded-3xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">AIFM Portal</h1>
        <p className="text-gray-600 text-center mb-8">Logga in på ditt konto</p>

        <div className="space-y-4">
          <Button type="button" onClick={handleAwsLogin} className="w-full">
            Logga in med AWS
          </Button>
        </div>

        <div className="my-6 text-center text-sm text-gray-500">eller</div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-100 border-2 border-red-300 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-gray-700 font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-300 rounded-2xl px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="admin@aifm.com"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-300 rounded-2xl px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Password1!"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="text-gray-600 text-center mt-6">
          Demo logins:<br />
          <span className="font-mono text-sm">admin@aifm.com / Password1!</span>
        </p>
      </div>
    </div>
  );
}
