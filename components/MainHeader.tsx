'use client';

import { Keyboard, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NotificationPanel } from './NotificationPanel';
import { ProfileMenu } from './ProfileMenu';
import { GlobalSearch } from './GlobalSearch';
import { useKeyboardShortcuts } from './KeyboardShortcuts';
import { HelpCenterButton } from './HelpCenter';

export function MainHeader() {
  const { showHelp } = useKeyboardShortcuts();
  const router = useRouter();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-end h-14">
          {/* Right: Search, Notifications & Profile */}
          <div className="flex items-center gap-2">
            {/* Global Search */}
            <div className="hidden sm:block">
              <GlobalSearch />
            </div>

            {/* Keyboard Shortcuts Help */}
            <button
              onClick={showHelp}
              className="hidden sm:flex p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Tangentbordsgenvägar (Shift + ?)"
            >
              <Keyboard className="w-5 h-5" />
            </button>

            {/* Help Center */}
            <HelpCenterButton />

            {/* Notifications */}
            <NotificationPanel />

            {/* Profile Menu */}
            <ProfileMenu />

            {/* AI Chat Button - Fullscreen */}
            <button
              onClick={() => router.push('/chat')}
              className="group relative ml-1 p-2.5 rounded-xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 
                         text-white shadow-lg shadow-aifm-charcoal/20
                         hover:shadow-xl hover:shadow-aifm-gold/20 hover:scale-105
                         active:scale-95 transition-all duration-300"
              title="AIFM Assistent (⌘J)"
            >
              {/* Subtle glow effect */}
              <div className="absolute inset-0 rounded-xl bg-aifm-gold/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* Icon with animation */}
              <Sparkles className="relative w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
              
              {/* Pulse indicator */}
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-aifm-gold rounded-full animate-pulse" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

