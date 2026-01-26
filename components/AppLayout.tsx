'use client';

import { ReactNode, useState, useEffect, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, Loader2 } from 'lucide-react';
import { MainHeader } from './MainHeader';
import { UnifiedSidebar } from './sidebars/UnifiedSidebar';
import { MobileBottomNav } from './MobileNav';
import { useSidebar } from './SidebarContext';
import { LoadingOverlay } from './LoadingOverlay';
import { SkipLink } from './accessibility/SkipLink';
import { OnboardingGuide, useOnboarding } from './OnboardingGuide';
import { SystemStatusIndicator } from './SystemStatusIndicator';
import { OnboardingChecklistWidget } from './OnboardingChecklist';

interface AppLayoutProps {
  children: ReactNode;
}

// Component that renders the layout
function AppLayoutWithParams({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { showOnboarding, completeOnboarding, closeOnboarding } = useOnboarding();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SkipLink href="#main-content">Hoppa till huvudinnehåll</SkipLink>
      {/* Main Header */}
      <MainHeader />

      <div className="flex flex-1">
        {/* Desktop Sidebar - Fixed position */}
        <div className="hidden lg:block fixed left-0 top-0 h-screen z-40">
          <UnifiedSidebar />
        </div>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 lg:hidden transform transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <UnifiedSidebar />
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="absolute top-4 right-4 w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content - with dynamic left margin for sidebar */}
        <main 
          id="main-content" 
          tabIndex={-1} 
          className={`flex-1 flex flex-col min-h-[calc(100vh-64px)] transition-all duration-300 overflow-x-hidden pb-16 lg:pb-0
                     ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-64'}`}
        >
          {/* Mobile menu button - shown in content area */}
          <div className="lg:hidden px-4 py-2 border-b border-gray-100">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors touch-target"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Page content */}
          <div className="flex-1 p-2 sm:p-4 bg-white overflow-auto">
            <div className="w-full">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* System Status Footer */}
      <div className="hidden lg:block">
        <SystemStatusIndicator />
      </div>

      <LoadingOverlay />
      
      {/* Onboarding Guide (for first-time walkthrough) */}
      <OnboardingGuide 
        isOpen={showOnboarding} 
        onClose={closeOnboarding} 
        onComplete={completeOnboarding} 
      />

      {/* Onboarding Checklist (persistent floating widget) */}
      <OnboardingChecklistWidget />
    </div>
  );
}

// Inner wrapper with Suspense boundary
function AppLayoutInner({ children }: AppLayoutProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-aifm-gold animate-spin" />
      </div>
    }>
      <AppLayoutWithParams>{children}</AppLayoutWithParams>
    </Suspense>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return <AppLayoutInner>{children}</AppLayoutInner>;
}

