'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Settings, CheckCircle2, BarChart3, Target } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { useEffect } from 'react';

export default function DashboardPage() {
  const router = useRouter();

  // Redirect to overview page
  useEffect(() => {
    router.push('/overview');
  }, [router]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-aifm-gold rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-lg font-medium tracking-widest text-aifm-charcoal uppercase">AIFM</span>
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="/auth/logout"
              className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </a>
          </div>
        </div>
      </div>

      {/* Loading */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-aifm-gold border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
