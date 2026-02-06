'use client';

import { useEffect, useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Command, Search, Home, Users, Shield, Calculator, 
  FolderOpen, Settings, Bell, HelpCircle, X, Keyboard, Sparkles
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Shortcut {
  key: string;
  modifiers: ('ctrl' | 'meta' | 'alt' | 'shift')[];
  description: string;
  category: 'navigation' | 'actions' | 'global';
  action: () => void;
}

interface KeyboardShortcutsContextValue {
  shortcuts: Shortcut[];
  registerShortcut: (shortcut: Shortcut) => void;
  unregisterShortcut: (key: string) => void;
  showHelp: () => void;
  hideHelp: () => void;
  isHelpVisible: boolean;
}

// ============================================================================
// Context
// ============================================================================

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  // Return a safe no-op implementation during SSR
  if (!context) {
    return {
      registerShortcut: () => {},
      unregisterShortcut: () => {},
      showHelp: () => {},
      hideHelp: () => {},
    };
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
}

export function KeyboardShortcutsProvider({ children }: KeyboardShortcutsProviderProps) {
  const router = useRouter();
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [isHelpVisible, setIsHelpVisible] = useState(false);

  // Default shortcuts
  const defaultShortcuts: Shortcut[] = [
    // Global
    {
      key: 'k',
      modifiers: ['meta'],
      description: 'Öppna global sökning',
      category: 'global',
      action: () => {
        // Dispatch custom event to open search
        window.dispatchEvent(new CustomEvent('openGlobalSearch'));
      },
    },
    {
      key: '/',
      modifiers: [],
      description: 'Fokusera sökfält',
      category: 'global',
      action: () => {
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="Sök"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
    },
    {
      key: '?',
      modifiers: ['shift'],
      description: 'Visa tangentbordsgenvägar',
      category: 'global',
      action: () => setIsHelpVisible(true),
    },
    {
      key: 'Escape',
      modifiers: [],
      description: 'Stäng dialog/modal',
      category: 'global',
      action: () => {
        setIsHelpVisible(false);
        // Dispatch event for other components to handle
        window.dispatchEvent(new CustomEvent('escapePressed'));
      },
    },
    {
      key: 'j',
      modifiers: ['meta'],
      description: 'Öppna AIFM Assistent (helskärm)',
      category: 'global',
      action: () => router.push('/chat'),
    },
    
    // Navigation
    {
      key: 'g',
      modifiers: [],
      description: 'Gå till Översikt',
      category: 'navigation',
      action: () => router.push('/overview'),
    },
    {
      key: 'c',
      modifiers: [],
      description: 'Gå till CRM',
      category: 'navigation',
      action: () => router.push('/crm'),
    },
    {
      key: 'm',
      modifiers: [],
      description: 'Gå till Compliance Manager',
      category: 'navigation',
      action: () => router.push('/?view=compliance'),
    },
    {
      key: 'b',
      modifiers: [],
      description: 'Gå till Bokföring',
      category: 'navigation',
      action: () => router.push('/accounting/dashboard'),
    },
    {
      key: 'i',
      modifiers: [],
      description: 'Gå till Investerare',
      category: 'navigation',
      action: () => router.push('/investors'),
    },
    {
      key: 'd',
      modifiers: [],
      description: 'Gå till Datarum',
      category: 'navigation',
      action: () => router.push('/data-rooms'),
    },
    {
      key: 's',
      modifiers: [],
      description: 'Gå till Inställningar',
      category: 'navigation',
      action: () => router.push('/settings'),
    },
    
    // Actions
    {
      key: 'n',
      modifiers: ['meta'],
      description: 'Ny kontakt (i CRM)',
      category: 'actions',
      action: () => router.push('/crm/contacts?new=true'),
    },
    {
      key: 'n',
      modifiers: ['meta', 'shift'],
      description: 'Ny affär (i CRM)',
      category: 'actions',
      action: () => router.push('/crm/pipeline?new=true'),
    },
    {
      key: 'u',
      modifiers: ['meta'],
      description: 'Ladda upp dokument',
      category: 'actions',
      action: () => router.push('/accounting/upload'),
    },
    {
      key: 'r',
      modifiers: ['meta'],
      description: 'Uppdatera sidan',
      category: 'actions',
      action: () => window.location.reload(),
    },
  ];

  // Merge default and registered shortcuts
  const allShortcuts = [...defaultShortcuts, ...shortcuts];

  const registerShortcut = useCallback((shortcut: Shortcut) => {
    setShortcuts(prev => [...prev.filter(s => s.key !== shortcut.key), shortcut]);
  }, []);

  const unregisterShortcut = useCallback((key: string) => {
    setShortcuts(prev => prev.filter(s => s.key !== key));
  }, []);

  const showHelp = useCallback(() => setIsHelpVisible(true), []);
  const hideHelp = useCallback(() => setIsHelpVisible(false), []);

  // Handle keyboard events
  useEffect(() => {
    let lastKeyTime = 0;
    let lastKey = '';
    const COMBO_TIMEOUT = 500; // ms for key combos like 'g' then 'h'

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape in inputs
        if (e.key !== 'Escape') return;
      }

      const now = Date.now();
      const isMeta = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;

      // Find matching shortcut
      const matchingShortcut = allShortcuts.find(shortcut => {
        const keyMatch = shortcut.key.toLowerCase() === e.key.toLowerCase();
        const metaMatch = shortcut.modifiers.includes('meta') ? isMeta : !isMeta;
        const shiftMatch = shortcut.modifiers.includes('shift') ? isShift : !isShift;
        const altMatch = shortcut.modifiers.includes('alt') ? isAlt : !isAlt;
        
        return keyMatch && metaMatch && shiftMatch && altMatch;
      });

      if (matchingShortcut) {
        e.preventDefault();
        matchingShortcut.action();
      }

      lastKey = e.key;
      lastKeyTime = now;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allShortcuts]);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        shortcuts: allShortcuts,
        registerShortcut,
        unregisterShortcut,
        showHelp,
        hideHelp,
        isHelpVisible,
      }}
    >
      {children}
      {isHelpVisible && <KeyboardShortcutsHelp onClose={hideHelp} shortcuts={allShortcuts} />}
    </KeyboardShortcutsContext.Provider>
  );
}

// ============================================================================
// Help Dialog
// ============================================================================

interface KeyboardShortcutsHelpProps {
  onClose: () => void;
  shortcuts: Shortcut[];
}

function KeyboardShortcutsHelp({ onClose, shortcuts }: KeyboardShortcutsHelpProps) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  const formatKey = (key: string, modifiers: string[]) => {
    const parts: string[] = [];
    
    if (modifiers.includes('meta')) {
      parts.push(isMac ? '⌘' : 'Ctrl');
    }
    if (modifiers.includes('alt')) {
      parts.push(isMac ? '⌥' : 'Alt');
    }
    if (modifiers.includes('shift')) {
      parts.push('⇧');
    }
    
    // Format special keys
    const keyDisplay = key === 'Escape' ? 'Esc' : key.toUpperCase();
    parts.push(keyDisplay);
    
    return parts;
  };

  const groupedShortcuts = {
    global: shortcuts.filter(s => s.category === 'global'),
    navigation: shortcuts.filter(s => s.category === 'navigation'),
    actions: shortcuts.filter(s => s.category === 'actions'),
  };

  const categoryLabels = {
    global: 'Globalt',
    navigation: 'Navigering',
    actions: 'Åtgärder',
  };

  const categoryIcons = {
    global: <Command className="w-4 h-4" />,
    navigation: <Home className="w-4 h-4" />,
    actions: <Keyboard className="w-4 h-4" />,
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2d2a26] flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Tangentbordsgenvägar</h2>
              <p className="text-sm text-gray-500">Navigera snabbare med tangentbordet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid gap-6 md:grid-cols-2">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-gray-400">{categoryIcons[category as keyof typeof categoryIcons]}</span>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </h3>
                </div>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, i) => (
                    <div 
                      key={i}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm text-gray-600">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {formatKey(shortcut.key, shortcut.modifiers).map((part, j) => (
                          <kbd
                            key={j}
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-md shadow-sm"
                          >
                            {part}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            Tryck <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-medium">?</kbd> när som helst för att visa denna hjälp
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Keyboard Shortcut Hint Component
// ============================================================================

interface ShortcutHintProps {
  keys: string[];
  className?: string;
}

export function ShortcutHint({ keys, className = '' }: ShortcutHintProps) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  const formatKey = (key: string) => {
    if (key === 'meta') return isMac ? '⌘' : 'Ctrl';
    if (key === 'alt') return isMac ? '⌥' : 'Alt';
    if (key === 'shift') return '⇧';
    return key.toUpperCase();
  };

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {keys.map((key, i) => (
        <kbd
          key={i}
          className="px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded"
        >
          {formatKey(key)}
        </kbd>
      ))}
    </span>
  );
}



