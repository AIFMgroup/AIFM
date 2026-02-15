'use client';

import { Suspense } from 'react';
import { useSearchParams, redirect } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import ComplianceContent from './compliance-content';

function RootPageContent() {
  const searchParams = useSearchParams();
  const view = searchParams?.get('view');
  const tab = searchParams?.get('tab') || 'chat';
  const companyId = searchParams?.get('companyId');

  // If view=compliance, render compliance content
  if (view === 'compliance') {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <ComplianceContent activeTab={tab} initialCompanyId={companyId || undefined} />
      </div>
    );
  }

  // Redirect to fullscreen chat as default landing page
  redirect('/chat');
}

export default function RootPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-aifm-gold animate-spin" />
      </div>
    }>
      <RootPageContent />
    </Suspense>
  );
}
