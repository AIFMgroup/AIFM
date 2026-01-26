/**
 * Keyboard Navigation Hook
 * 
 * Tangentbordsnavigering för listor och formulär.
 * Stöder ↑/↓ för att bläddra, Enter för att välja, etc.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface KeyboardNavigationOptions {
  items: { id: string }[];
  onSelect?: (id: string) => void;
  onActivate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEscape?: () => void;
  enabled?: boolean;
  loop?: boolean; // Wrap around at ends
  initialSelectedId?: string | null;
}

export interface KeyboardNavigationResult {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  getItemProps: (id: string) => {
    tabIndex: number;
    'aria-selected': boolean;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onClick: () => void;
  };
}

/**
 * Hook for keyboard navigation in lists
 */
export function useKeyboardNavigation({
  items,
  onSelect,
  onActivate,
  onDelete,
  onEscape,
  enabled = true,
  loop = true,
  initialSelectedId = null,
}: KeyboardNavigationOptions): KeyboardNavigationResult {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const containerRef = useRef<HTMLElement | null>(null);

  // Update selection when items change
  useEffect(() => {
    if (selectedId && !items.find(item => item.id === selectedId)) {
      setSelectedId(items[0]?.id || null);
    }
  }, [items, selectedId]);

  const selectItem = useCallback((id: string) => {
    setSelectedId(id);
    onSelect?.(id);
  }, [onSelect]);

  const moveSelection = useCallback((direction: 'up' | 'down') => {
    if (!items.length) return;

    const currentIndex = selectedId 
      ? items.findIndex(item => item.id === selectedId)
      : -1;

    let newIndex: number;

    if (direction === 'up') {
      if (currentIndex <= 0) {
        newIndex = loop ? items.length - 1 : 0;
      } else {
        newIndex = currentIndex - 1;
      }
    } else {
      if (currentIndex >= items.length - 1) {
        newIndex = loop ? 0 : items.length - 1;
      } else {
        newIndex = currentIndex + 1;
      }
    }

    const newItem = items[newIndex];
    if (newItem) {
      selectItem(newItem.id);
      
      // Scroll into view
      const element = document.querySelector(`[data-item-id="${newItem.id}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [items, selectedId, loop, selectItem]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!enabled) return;

    switch (e.key) {
      case 'ArrowUp':
      case 'k': // Vim-style
        e.preventDefault();
        moveSelection('up');
        break;

      case 'ArrowDown':
      case 'j': // Vim-style
        e.preventDefault();
        moveSelection('down');
        break;

      case 'Enter':
      case ' ':
        if (selectedId) {
          e.preventDefault();
          onActivate?.(selectedId);
        }
        break;

      case 'Delete':
      case 'Backspace':
        if (selectedId && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onDelete?.(selectedId);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setSelectedId(null);
        onEscape?.();
        break;

      case 'Home':
        e.preventDefault();
        if (items[0]) selectItem(items[0].id);
        break;

      case 'End':
        e.preventDefault();
        if (items[items.length - 1]) selectItem(items[items.length - 1].id);
        break;
    }
  }, [enabled, selectedId, moveSelection, onActivate, onDelete, onEscape, items, selectItem]);

  const getItemProps = useCallback((id: string) => ({
    tabIndex: id === selectedId ? 0 : -1,
    'aria-selected': id === selectedId,
    'data-item-id': id,
    onKeyDown: handleKeyDown,
    onClick: () => selectItem(id),
  }), [selectedId, handleKeyDown, selectItem]);

  // Global keyboard listener
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Only handle if not in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      handleKeyDown(e as unknown as React.KeyboardEvent);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, handleKeyDown]);

  return {
    selectedId,
    setSelectedId,
    handleKeyDown,
    getItemProps,
  };
}

/**
 * Keyboard shortcuts definitions
 */
export const KEYBOARD_SHORTCUTS = {
  // Navigation
  NEXT_ITEM: ['ArrowDown', 'j'],
  PREV_ITEM: ['ArrowUp', 'k'],
  FIRST_ITEM: ['Home'],
  LAST_ITEM: ['End'],
  
  // Actions
  SELECT: ['Enter', ' '],
  DELETE: ['Delete', 'Backspace'],
  ESCAPE: ['Escape'],
  
  // Accounting specific
  APPROVE: ['a', 'g'], // 'a' for approve, 'g' for godkänn
  SEND: ['s'],         // Send to Fortnox
  EDIT: ['e'],         // Edit
  VIEW: ['v'],         // View document
  
  // Batch operations
  SELECT_ALL: ['Ctrl+a', 'Meta+a'],
  DESELECT_ALL: ['Ctrl+d', 'Meta+d'],
  
  // Undo/Redo
  UNDO: ['Ctrl+z', 'Meta+z'],
  REDO: ['Ctrl+y', 'Meta+y', 'Ctrl+Shift+z', 'Meta+Shift+z'],
};

/**
 * Hook for custom keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: Record<string, () => void>,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Don't trigger in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Build key string
      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.metaKey) parts.push('Meta');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      parts.push(e.key);

      const keyCombo = parts.join('+');

      // Check if any shortcut matches
      for (const [action, callback] of Object.entries(shortcuts)) {
        const actionKeys = KEYBOARD_SHORTCUTS[action as keyof typeof KEYBOARD_SHORTCUTS] || [action];
        if (actionKeys.includes(keyCombo) || actionKeys.includes(e.key)) {
          e.preventDefault();
          callback();
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, enabled]);
}

/**
 * Hook for detecting specific key press
 */
export function useKeyPress(targetKey: string): boolean {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const downHandler = (e: KeyboardEvent) => {
      if (e.key === targetKey) setPressed(true);
    };

    const upHandler = (e: KeyboardEvent) => {
      if (e.key === targetKey) setPressed(false);
    };

    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);

    return () => {
      window.removeEventListener('keydown', downHandler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [targetKey]);

  return pressed;
}















