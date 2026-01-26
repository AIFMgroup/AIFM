'use client';

import { Keyboard } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';
import { ProfileMenu } from './ProfileMenu';
import { GlobalSearch } from './GlobalSearch';
import { useKeyboardShortcuts } from './KeyboardShortcuts';
import { HelpCenterButton } from './HelpCenter';

export function MainHeader() {
  const { showHelp } = useKeyboardShortcuts();

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
          </div>
        </div>
      </div>
    </header>
  );
}

