'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/Button';

export function Header() {
  const { data: session } = useSession();
  const router = useRouter();

  const userRole = session ? ((session.user as any)?.role?.toLowerCase() || 'client') : null;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href={session ? "/dashboard" : "/"} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-aifm-gold rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <span className="text-lg font-medium tracking-widest text-aifm-charcoal uppercase">AIFM</span>
            </Link>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <div className="text-right">
                  <p className="text-sm font-medium text-aifm-charcoal">{session.user?.email}</p>
                  <p className="text-xs text-aifm-charcoal/60 uppercase tracking-wider">{userRole}</p>
                </div>
                <button
                  onClick={() => signOut({ redirect: true, callbackUrl: '/' })}
                  className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/how-it-works" 
                  className="text-sm font-medium text-aifm-charcoal/60 hover:text-aifm-gold transition-colors uppercase tracking-wider"
                >
                  How It Works
                </Link>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => router.push('/sign-in')}
                  className="text-sm font-medium uppercase tracking-wider"
                >
                  Sign In
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
