'use client';

import { ReactNode } from 'react';

interface SkipLinkProps {
  href: string;
  children: ReactNode;
}

/**
 * Skip link component for keyboard navigation accessibility.
 * Becomes visible only when focused, allowing keyboard users to
 * skip repetitive navigation and go directly to main content.
 * 
 * @example
 * <SkipLink href="#main-content">Hoppa till huvudinnehåll</SkipLink>
 */
export function SkipLink({ href, children }: SkipLinkProps) {
  return (
    <a
      href={href}
      className="
        sr-only focus:not-sr-only
        focus:fixed focus:top-4 focus:left-4 focus:z-[300]
        focus:px-4 focus:py-2 
        focus:bg-[#2d2a26] focus:text-white
        focus:rounded-lg focus:shadow-lg
        focus:outline-none focus:ring-2 focus:ring-[#c0a280] focus:ring-offset-2
        transition-all duration-200
      "
    >
      {children}
    </a>
  );
}

/**
 * Visually hidden component - hides content visually but keeps it
 * accessible to screen readers.
 * 
 * @example
 * <VisuallyHidden>Lägg till i kundvagn</VisuallyHidden>
 */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}

/**
 * Announcement component for screen readers.
 * Uses aria-live to announce dynamic content changes.
 * 
 * @example
 * <LiveRegion aria-live="polite">{statusMessage}</LiveRegion>
 */
export function LiveRegion({ 
  children, 
  politeness = 'polite' 
}: { 
  children: ReactNode; 
  politeness?: 'polite' | 'assertive';
}) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {children}
    </div>
  );
}

