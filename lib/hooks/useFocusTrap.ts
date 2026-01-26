import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface UseFocusTrapOptions {
  /** Whether the focus trap is currently active */
  enabled?: boolean;
  /** Callback when escape is pressed */
  onEscape?: () => void;
  /** Return focus to this element when trap is deactivated */
  returnFocusOnDeactivate?: boolean;
}

/**
 * Hook to trap focus within a container element.
 * Useful for modals, dialogs, and other overlay components.
 * 
 * @example
 * const modalRef = useFocusTrap<HTMLDivElement>({
 *   enabled: isOpen,
 *   onEscape: () => setIsOpen(false),
 * });
 * 
 * return <div ref={modalRef}>Modal content</div>
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>({
  enabled = true,
  onEscape,
  returnFocusOnDeactivate = true,
}: UseFocusTrapOptions = {}) {
  const containerRef = useRef<T>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Store the element that was focused before the trap was activated
  useEffect(() => {
    if (enabled) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
    }
  }, [enabled]);

  // Return focus when trap is deactivated
  useEffect(() => {
    return () => {
      if (returnFocusOnDeactivate && previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [returnFocusOnDeactivate]);

  // Focus the first focusable element when trap is activated
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
    const firstElement = focusableElements[0];
    
    if (firstElement) {
      // Small delay to ensure the element is fully rendered
      requestAnimationFrame(() => {
        firstElement.focus();
      });
    }
  }, [enabled]);

  // Handle tab key to cycle through focusable elements
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled || !containerRef.current) return;

    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      onEscape();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // If shift + tab on first element, go to last
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement?.focus();
      return;
    }

    // If tab on last element, go to first
    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement?.focus();
      return;
    }
  }, [enabled, onEscape]);

  // Add keydown listener
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  return containerRef;
}

/**
 * Hook to manage focus within a roving tabindex pattern.
 * Useful for menus, toolbars, and other composite widgets.
 * 
 * @example
 * const { activeIndex, handleKeyDown, setActiveIndex } = useRovingTabIndex(items.length);
 */
export function useRovingTabIndex(itemCount: number, options?: {
  /** Initial active index */
  initialIndex?: number;
  /** Whether navigation wraps around */
  wrap?: boolean;
  /** Orientation for arrow key navigation */
  orientation?: 'horizontal' | 'vertical' | 'both';
}) {
  const {
    initialIndex = 0,
    wrap = true,
    orientation = 'vertical',
  } = options || {};

  const activeIndexRef = useRef(initialIndex);

  const setActiveIndex = useCallback((index: number) => {
    activeIndexRef.current = index;
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const { key } = event;
    let newIndex = activeIndexRef.current;
    
    const isVertical = orientation === 'vertical' || orientation === 'both';
    const isHorizontal = orientation === 'horizontal' || orientation === 'both';

    if ((key === 'ArrowDown' && isVertical) || (key === 'ArrowRight' && isHorizontal)) {
      event.preventDefault();
      newIndex = activeIndexRef.current + 1;
      if (newIndex >= itemCount) {
        newIndex = wrap ? 0 : itemCount - 1;
      }
    } else if ((key === 'ArrowUp' && isVertical) || (key === 'ArrowLeft' && isHorizontal)) {
      event.preventDefault();
      newIndex = activeIndexRef.current - 1;
      if (newIndex < 0) {
        newIndex = wrap ? itemCount - 1 : 0;
      }
    } else if (key === 'Home') {
      event.preventDefault();
      newIndex = 0;
    } else if (key === 'End') {
      event.preventDefault();
      newIndex = itemCount - 1;
    }

    if (newIndex !== activeIndexRef.current) {
      activeIndexRef.current = newIndex;
    }

    return newIndex;
  }, [itemCount, wrap, orientation]);

  return {
    activeIndex: activeIndexRef.current,
    setActiveIndex,
    handleKeyDown,
  };
}

