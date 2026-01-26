'use client';

import { ReactNode } from 'react';

interface CrmLayoutProps {
  children: ReactNode;
}

export function CrmLayout({ children }: CrmLayoutProps) {
  return (
    <div className="min-h-full pb-16 lg:pb-0">
      {/* Main Content - no top sub-navigation, using sidebar instead */}
      <div className="min-h-[calc(100vh-180px)]">
        {children}
      </div>
    </div>
  );
}
