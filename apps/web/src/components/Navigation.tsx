'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  const userRole = (session.user as any)?.role?.toLowerCase() || 'client';
  
  const dashboardLinks = {
    admin: [
      { label: 'Dashboard', href: '/admin/dashboard' },
      { label: 'Documents', href: '/admin/documents' },
      { label: 'Q&A', href: '/admin/qa' },
      { label: 'Q&A History', href: '/admin/qa/history' },
      { label: 'Compliance', href: '/admin/compliance' },
      { label: 'Policies', href: '/admin/policies' },
    ],
    coordinator: [
      { label: 'Inbox', href: '/coordinator/inbox' },
    ],
    specialist: [
      { label: 'Board', href: '/specialist/board' },
    ],
  };

  const links = dashboardLinks[userRole as keyof typeof dashboardLinks] || [];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-aifm-gold rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-lg font-medium tracking-widest text-aifm-charcoal uppercase">AIFM</span>
          </Link>
          
          <div className="flex gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium uppercase tracking-wider transition ${
                  pathname === link.href
                    ? 'text-aifm-gold'
                    : 'text-aifm-charcoal/60 hover:text-aifm-gold'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-aifm-charcoal/60">
            {session.user?.email}
          </span>
          <span className="text-xs font-medium bg-aifm-gold/10 text-aifm-gold px-3 py-1 rounded-full uppercase tracking-wider">
            {userRole}
          </span>
          <button
            onClick={() => signOut({ redirect: true, callbackUrl: '/' })}
            className="btn-primary py-2 px-4 text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
