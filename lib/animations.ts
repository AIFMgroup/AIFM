/**
 * Animation utilities and Tailwind animation class generators
 */

// ============================================================================
// Stagger Animation Helper
// ============================================================================

/**
 * Returns a style object for staggered animations
 * @param index - The index of the item in the list
 * @param baseDelay - Base delay in ms (default: 50)
 * @param maxDelay - Maximum delay in ms (default: 500)
 */
export function staggerDelay(index: number, baseDelay = 50, maxDelay = 500): React.CSSProperties {
  const delay = Math.min(index * baseDelay, maxDelay);
  return { animationDelay: `${delay}ms` };
}

/**
 * Returns inline style for transition delay
 */
export function transitionDelay(index: number, baseDelay = 30): React.CSSProperties {
  return { transitionDelay: `${index * baseDelay}ms` };
}

// ============================================================================
// Animation Variants for Framer Motion (if used)
// ============================================================================

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

export const fadeInDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const fadeInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export const fadeInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const slideInFromRight = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
};

export const slideInFromLeft = {
  initial: { x: '-100%' },
  animate: { x: 0 },
  exit: { x: '-100%' },
};

export const slideInFromTop = {
  initial: { y: '-100%' },
  animate: { y: 0 },
  exit: { y: '-100%' },
};

export const slideInFromBottom = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
};

// ============================================================================
// Stagger Container Variants
// ============================================================================

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

// ============================================================================
// CSS Animation Classes (for use without Framer Motion)
// ============================================================================

/**
 * CSS classes for common animations using Tailwind's animate-in utility
 * These require tailwindcss-animate plugin
 */
export const cssAnimations = {
  fadeIn: 'animate-in fade-in duration-200',
  fadeInUp: 'animate-in fade-in slide-in-from-bottom-2 duration-300',
  fadeInDown: 'animate-in fade-in slide-in-from-top-2 duration-300',
  fadeInLeft: 'animate-in fade-in slide-in-from-left-2 duration-300',
  fadeInRight: 'animate-in fade-in slide-in-from-right-2 duration-300',
  scaleIn: 'animate-in fade-in zoom-in-95 duration-200',
  slideInRight: 'animate-in slide-in-from-right duration-300',
  slideInLeft: 'animate-in slide-in-from-left duration-300',
  slideInTop: 'animate-in slide-in-from-top duration-300',
  slideInBottom: 'animate-in slide-in-from-bottom duration-300',
  
  // Exit animations
  fadeOut: 'animate-out fade-out duration-200',
  fadeOutUp: 'animate-out fade-out slide-out-to-top-2 duration-200',
  fadeOutDown: 'animate-out fade-out slide-out-to-bottom-2 duration-200',
  scaleOut: 'animate-out fade-out zoom-out-95 duration-150',
};

// ============================================================================
// Spring Configurations
// ============================================================================

export const springs = {
  // Snappy, responsive feel
  snappy: { type: 'spring', stiffness: 500, damping: 30 },
  // Smooth, gentle feel
  gentle: { type: 'spring', stiffness: 200, damping: 20 },
  // Bouncy, playful feel
  bouncy: { type: 'spring', stiffness: 300, damping: 15 },
  // Very stiff, almost no bounce
  stiff: { type: 'spring', stiffness: 700, damping: 35 },
  // Slow and smooth
  slow: { type: 'spring', stiffness: 100, damping: 20 },
};

// ============================================================================
// Easing Functions
// ============================================================================

export const easings = {
  // Smooth ease out - good for entrances
  easeOut: [0.16, 1, 0.3, 1],
  // Quick ease in-out - good for UI interactions
  easeInOut: [0.4, 0, 0.2, 1],
  // Emphasis ease - draws attention
  emphasis: [0.68, -0.6, 0.32, 1.6],
  // Apple-like ease
  apple: [0.25, 0.1, 0.25, 1],
};

// ============================================================================
// Duration Presets
// ============================================================================

export const durations = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
  slower: 0.6,
};

