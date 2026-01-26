import { useEffect, useCallback } from 'react';

type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta';

interface ShortcutConfig {
  key: string;
  modifiers?: ModifierKey[];
  callback: (e: KeyboardEvent) => void;
  preventDefault?: boolean;
  enabled?: boolean;
}

/**
 * Hook for registering keyboard shortcuts
 * 
 * @example
 * useKeyboardShortcut({
 *   key: 'k',
 *   modifiers: ['meta'], // ⌘K on Mac
 *   callback: () => setSearchOpen(true),
 * });
 */
export function useKeyboardShortcut({
  key,
  modifiers = [],
  callback,
  preventDefault = true,
  enabled = true,
}: ShortcutConfig) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Check modifiers
      const ctrlRequired = modifiers.includes('ctrl');
      const altRequired = modifiers.includes('alt');
      const shiftRequired = modifiers.includes('shift');
      const metaRequired = modifiers.includes('meta');

      const ctrlMatch = ctrlRequired ? event.ctrlKey : !event.ctrlKey;
      const altMatch = altRequired ? event.altKey : !event.altKey;
      const shiftMatch = shiftRequired ? event.shiftKey : !event.shiftKey;
      const metaMatch = metaRequired ? event.metaKey : !event.metaKey;

      // Check if key matches (case-insensitive)
      const keyMatch = event.key.toLowerCase() === key.toLowerCase();

      if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch) {
        if (preventDefault) {
          event.preventDefault();
        }
        callback(event);
      }
    },
    [key, modifiers, callback, preventDefault, enabled]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Hook for registering multiple keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const modifiers = shortcut.modifiers || [];
        const ctrlRequired = modifiers.includes('ctrl');
        const altRequired = modifiers.includes('alt');
        const shiftRequired = modifiers.includes('shift');
        const metaRequired = modifiers.includes('meta');

        const ctrlMatch = ctrlRequired ? event.ctrlKey : !event.ctrlKey;
        const altMatch = altRequired ? event.altKey : !event.altKey;
        const shiftMatch = shiftRequired ? event.shiftKey : !event.shiftKey;
        const metaMatch = metaRequired ? event.metaKey : !event.metaKey;

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.callback(event);
          break; // Only trigger first matching shortcut
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Formats keyboard shortcut for display
 * 
 * @example
 * formatShortcut(['meta'], 'k') // '⌘K' on Mac, 'Ctrl+K' on Windows
 */
export function formatShortcut(modifiers: ModifierKey[], key: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  
  const modifierSymbols: Record<ModifierKey, string> = isMac
    ? { ctrl: '⌃', alt: '⌥', shift: '⇧', meta: '⌘' }
    : { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Win' };

  const parts = modifiers.map((mod) => modifierSymbols[mod]);
  parts.push(key.toUpperCase());

  return isMac ? parts.join('') : parts.join('+');
}

