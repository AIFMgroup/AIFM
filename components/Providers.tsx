'use client';

import { ReactNode } from 'react';
import { CompanyProvider } from './CompanyContext';
import { UserProfileProvider } from './UserProfileContext';
import { ToastProvider } from './Toast';
import { SidebarProvider } from './SidebarContext';
import { WebSocketProvider } from '@/lib/websocket';
import { InstallBanner } from './InstallBanner';
import { KeyboardShortcutsProvider } from './KeyboardShortcuts';
import { ErrorBoundary } from './ErrorBoundary';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <CompanyProvider>
        <UserProfileProvider>
          <SidebarProvider>
            <WebSocketProvider>
              <ToastProvider>
                <KeyboardShortcutsProvider>
                  {children}
                  <InstallBanner />
                </KeyboardShortcutsProvider>
              </ToastProvider>
            </WebSocketProvider>
          </SidebarProvider>
        </UserProfileProvider>
      </CompanyProvider>
    </ErrorBoundary>
  );
}






