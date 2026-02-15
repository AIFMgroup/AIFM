'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';

interface AgentProgressStep {
  label: string;
  /** Estimated duration in seconds for this step */
  estimatedDuration?: number;
}

interface AgentProgressBannerProps {
  /** Whether the agent is currently running */
  isActive: boolean;
  /** Current step label to display */
  currentStep?: string;
  /** Ordered list of steps (for multi-step progress) */
  steps?: AgentProgressStep[];
  /** Index of the current step (0-based) */
  currentStepIndex?: number;
  /** Total estimated duration in seconds (default: 140) */
  estimatedDuration?: number;
  /** Whether the operation completed successfully */
  isComplete?: boolean;
  /** Error message if something went wrong */
  error?: string | null;
  /** Success message to show on completion */
  successMessage?: string;
  /** Callback when the banner is dismissed */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export default function AgentProgressBanner({
  isActive,
  currentStep,
  steps,
  currentStepIndex = 0,
  estimatedDuration = 140,
  isComplete = false,
  error = null,
  successMessage,
  onDismiss,
  className = '',
}: AgentProgressBannerProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Easing function: starts fast, slows down as it approaches 95%
  const easeProgress = useCallback((elapsed: number, total: number): number => {
    const t = Math.min(elapsed / total, 1);
    // Asymptotic curve: approaches 95% but never reaches 100% until complete
    // Uses a combination of fast start + logarithmic slowdown
    const maxBeforeComplete = 95;
    return maxBeforeComplete * (1 - Math.pow(1 - t, 2.5));
  }, []);

  // Animate progress
  useEffect(() => {
    if (isActive && !isComplete && !error) {
      setVisible(true);
      setDismissed(false);
      startTimeRef.current = Date.now();

      const tick = () => {
        if (!startTimeRef.current) return;
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const newProgress = easeProgress(elapsed, estimatedDuration);
        setProgress(newProgress);
        animFrameRef.current = requestAnimationFrame(tick);
      };

      animFrameRef.current = requestAnimationFrame(tick);

      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }
  }, [isActive, isComplete, error, estimatedDuration, easeProgress]);

  // Snap to 100% on complete
  useEffect(() => {
    if (isComplete) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      // Animate from current to 100%
      const start = progress;
      const startTime = Date.now();
      const duration = 400; // 400ms snap animation

      const snap = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Ease out
        const eased = 1 - Math.pow(1 - t, 3);
        setProgress(start + (100 - start) * eased);
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(snap);
        }
      };
      animFrameRef.current = requestAnimationFrame(snap);

      // Auto-dismiss after 5 seconds
      const timeout = setTimeout(() => {
        setVisible(false);
      }, 5000);

      return () => {
        clearTimeout(timeout);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // Handle error state
  useEffect(() => {
    if (error) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
  }, [error]);

  // Reset when not active
  useEffect(() => {
    if (!isActive && !isComplete && !error) {
      setProgress(0);
      startTimeRef.current = null;
    }
  }, [isActive, isComplete, error]);

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    onDismiss?.();
  };

  if (dismissed || (!isActive && !isComplete && !error && !visible)) return null;

  const progressPercent = Math.round(progress);

  // Determine step info
  const stepLabel = currentStep || (steps && steps[currentStepIndex]?.label) || 'Bearbetar...';
  const totalSteps = steps?.length || 0;

  return (
    <div className={`overflow-hidden rounded-2xl border transition-all duration-500 ${
      error
        ? 'border-red-200/60 bg-red-50/50'
        : isComplete
        ? 'border-aifm-gold/30 bg-aifm-gold/5'
        : 'border-aifm-charcoal/10 bg-white'
    } ${className}`}>
      {/* Main content */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          {/* Left: icon + label */}
          <div className="flex items-center gap-3">
            {/* Animated icon */}
            <div className={`relative flex items-center justify-center w-8 h-8 rounded-full ${
              error
                ? 'bg-red-100'
                : isComplete
                ? 'bg-aifm-gold/20'
                : 'bg-aifm-charcoal/5'
            }`}>
              {error ? (
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : isComplete ? (
                <svg className="w-4 h-4 text-aifm-gold" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <>
                  {/* Spinning ring */}
                  <svg className="w-5 h-5 animate-spin text-aifm-charcoal/30" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="50 14" />
                  </svg>
                  {/* Sparkle in center */}
                  <svg className="absolute w-3 h-3 text-aifm-gold animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
                  </svg>
                </>
              )}
            </div>

            {/* Text */}
            <div>
              <p className={`text-sm font-medium ${
                error ? 'text-red-700' : isComplete ? 'text-aifm-charcoal' : 'text-aifm-charcoal'
              }`}>
                {error ? 'Agentanalys misslyckades' : isComplete ? (successMessage || 'Analys klar!') : stepLabel}
              </p>
              {!error && !isComplete && totalSteps > 0 && (
                <p className="text-xs text-aifm-charcoal/40 mt-0.5">
                  Steg {currentStepIndex + 1} av {totalSteps}
                </p>
              )}
              {error && (
                <p className="text-xs text-red-500 mt-0.5">{error}</p>
              )}
            </div>
          </div>

          {/* Right: percentage + dismiss */}
          <div className="flex items-center gap-3">
            {!error && (
              <span className={`text-sm font-semibold tabular-nums ${
                isComplete ? 'text-aifm-gold' : 'text-aifm-charcoal/60'
              }`}>
                {progressPercent}%
              </span>
            )}
            {(isComplete || error) && (
              <button
                onClick={handleDismiss}
                className="p-1 rounded-full hover:bg-aifm-charcoal/5 transition-colors"
              >
                <svg className="w-4 h-4 text-aifm-charcoal/40" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-1.5 bg-aifm-charcoal/5 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${
              error
                ? 'bg-red-400'
                : isComplete
                ? 'bg-aifm-gold duration-400'
                : 'bg-gradient-to-r from-aifm-charcoal via-aifm-gold to-aifm-charcoal/70'
            }`}
            style={{ width: `${error ? progress : progressPercent}%` }}
          />
          {/* Shimmer effect while loading */}
          {isActive && !isComplete && !error && (
            <div
              className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
            </div>
          )}
        </div>

        {/* Step indicators (if multi-step) */}
        {steps && steps.length > 1 && !error && (
          <div className="flex items-center gap-1.5 mt-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                  i < currentStepIndex
                    ? 'bg-aifm-gold/15 text-aifm-gold'
                    : i === currentStepIndex
                    ? 'bg-aifm-charcoal text-white'
                    : 'bg-aifm-charcoal/5 text-aifm-charcoal/30'
                }`}>
                  {i < currentStepIndex ? (
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : null}
                  {step.label}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-3 h-px ${i < currentStepIndex ? 'bg-aifm-gold/30' : 'bg-aifm-charcoal/10'}`} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
