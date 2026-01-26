/**
 * Media Query Hook
 * 
 * Detekterar skärmstorlek och enhetsfunktioner.
 */

import { useState, useEffect } from 'react';

/**
 * Common breakpoints (matches Tailwind CSS)
 */
export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

/**
 * Hook to check if a media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      // Legacy browsers
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  return matches;
}

/**
 * Hook to check if on mobile device
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.md})`);
}

/**
 * Hook to check if on tablet device
 */
export function useIsTablet(): boolean {
  const aboveSm = useMediaQuery(`(min-width: ${BREAKPOINTS.sm})`);
  const belowLg = useMediaQuery(`(max-width: ${BREAKPOINTS.lg})`);
  return aboveSm && belowLg;
}

/**
 * Hook to check if on desktop
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg})`);
}

/**
 * Hook to check current breakpoint
 */
export function useBreakpoint(): 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' {
  const isSm = useMediaQuery(`(min-width: ${BREAKPOINTS.sm})`);
  const isMd = useMediaQuery(`(min-width: ${BREAKPOINTS.md})`);
  const isLg = useMediaQuery(`(min-width: ${BREAKPOINTS.lg})`);
  const isXl = useMediaQuery(`(min-width: ${BREAKPOINTS.xl})`);
  const is2Xl = useMediaQuery(`(min-width: ${BREAKPOINTS['2xl']})`);

  if (is2Xl) return '2xl';
  if (isXl) return 'xl';
  if (isLg) return 'lg';
  if (isMd) return 'md';
  if (isSm) return 'sm';
  return 'xs';
}

/**
 * Hook to check if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook to check if user prefers dark mode
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/**
 * Hook to check if device is touch-enabled
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore - msMaxTouchPoints is IE-specific
      navigator.msMaxTouchPoints > 0
    );
  }, []);

  return isTouch;
}

/**
 * Hook to check if in standalone PWA mode
 */
export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-ignore - Safari specific
      window.navigator.standalone === true
    );
  }, []);

  return isStandalone;
}

/**
 * Hook for responsive values
 */
export function useResponsiveValue<T>(values: {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
  default: T;
}): T {
  const breakpoint = useBreakpoint();
  
  // Find the closest value for current breakpoint
  const breakpointOrder: ('xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl')[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
  const currentIndex = breakpointOrder.indexOf(breakpoint);
  
  // Look for value at current or lower breakpoint
  for (let i = currentIndex; i >= 0; i--) {
    const bp = breakpointOrder[i];
    if (values[bp] !== undefined) {
      return values[bp]!;
    }
  }
  
  return values.default;
}















