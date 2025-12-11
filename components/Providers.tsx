'use client';

import { ReactNode } from 'react';
import { CompanyProvider } from './CompanyContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CompanyProvider>
      {children}
    </CompanyProvider>
  );
}






