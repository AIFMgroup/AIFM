'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Settings, CheckCircle2, BarChart3, Target } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to overview page
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/overview');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-aifm-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    router.push('/sign-in');
    return null;
  }

  const userRole = (session.user as any)?.role?.toLowerCase() || 'client';

  const roleConfig = {
    admin: {
      title: 'Admin Dashboard',
      description: 'Manage system, clients, and configuration',
      href: '/admin/dashboard',
      icon: Settings,
    },
    coordinator: {
      title: 'Coordinator Inbox',
      description: 'Review and approve pending tasks',
      href: '/coordinator/inbox',
      icon: CheckCircle2,
    },
    specialist: {
      title: 'Specialist Board',
      description: 'Draft and finalize expert reports',
      href: '/specialist/board',
      icon: BarChart3,
    },
  };

  const config = roleConfig[userRole as keyof typeof roleConfig] || roleConfig.admin;
  const IconComponent = config.icon;

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
            <span className="text-sm text-aifm-charcoal/60">{session.user?.email}</span>
            <span className="text-xs font-medium bg-aifm-gold/10 text-aifm-gold px-3 py-1 rounded-full uppercase tracking-wider">
              {userRole}
            </span>
            <button
              onClick={() => signOut({ redirect: true, callbackUrl: '/' })}
              className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="mb-6 flex justify-center">
            <div className="w-24 h-24 bg-aifm-gold/10 rounded-2xl flex items-center justify-center">
              <IconComponent className="w-12 h-12 text-aifm-gold" />
            </div>
          </div>
          <h2 className="heading-2 mb-4">{config.title}</h2>
          <p className="text-lg text-aifm-charcoal/60 mb-10">{config.description}</p>
          <Link href={config.href}>
            <button className="btn-primary">
              Enter Dashboard
            </button>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center hover:border-aifm-gold/30 hover:shadow-lg transition-all cursor-pointer group">
            <div className="mb-4 flex justify-center">
              <div className="w-14 h-14 bg-aifm-gold/10 rounded-xl flex items-center justify-center group-hover:bg-aifm-gold/20 transition-colors">
                <BarChart3 className="w-7 h-7 text-aifm-gold" />
              </div>
            </div>
            <h3 className="font-medium text-aifm-charcoal uppercase tracking-wider mb-2">Tasks</h3>
            <p className="text-3xl font-medium text-aifm-charcoal">12</p>
            <p className="text-sm text-aifm-charcoal/60 mt-2">Pending</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center hover:border-aifm-gold/30 hover:shadow-lg transition-all cursor-pointer group">
            <div className="mb-4 flex justify-center">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
            </div>
            <h3 className="font-medium text-aifm-charcoal uppercase tracking-wider mb-2">Completed</h3>
            <p className="text-3xl font-medium text-aifm-charcoal">48</p>
            <p className="text-sm text-aifm-charcoal/60 mt-2">This month</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center hover:border-aifm-gold/30 hover:shadow-lg transition-all cursor-pointer group">
            <div className="mb-4 flex justify-center">
              <div className="w-14 h-14 bg-aifm-gold/10 rounded-xl flex items-center justify-center group-hover:bg-aifm-gold/20 transition-colors">
                <Target className="w-7 h-7 text-aifm-gold" />
              </div>
            </div>
            <h3 className="font-medium text-aifm-charcoal uppercase tracking-wider mb-2">Efficiency</h3>
            <p className="text-3xl font-medium text-aifm-charcoal">94%</p>
            <p className="text-sm text-aifm-charcoal/60 mt-2">On target</p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
