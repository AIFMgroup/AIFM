'use client';

import { useEffect, useRef, useState } from 'react';

interface AnalysisProgressBarProps {
  /** 0–100 progress value. If not provided, uses indeterminate mode. */
  progress?: number;
  /** Status message shown below the bar */
  message?: string;
  /** Whether the analysis is currently running */
  isActive: boolean;
  /** Number of completed chunks */
  completedChunks?: number;
  /** Total number of chunks */
  totalChunks?: number;
}

/**
 * Smooth progress bar with trickle animation.
 *
 * When real progress updates arrive (via the `progress` prop), the bar eases
 * toward that value. Between updates it "trickles" forward at a decelerating
 * rate so the user always sees movement, even during long AI calls.
 *
 * The trickle slows down as it approaches the next milestone and will never
 * reach 100% on its own – only a real progress=100 event completes the bar.
 */
export default function AnalysisProgressBar({
  progress,
  message,
  isActive,
  completedChunks,
  totalChunks,
}: AnalysisProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [dots, setDots] = useState('');
  const lastRealProgress = useRef(0);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (progress != null) {
      lastRealProgress.current = Math.min(progress, 100);
    }
  }, [progress]);

  useEffect(() => {
    if (!isActive) {
      if (trickleRef.current) {
        clearInterval(trickleRef.current);
        trickleRef.current = null;
      }
      setDisplayProgress(0);
      lastRealProgress.current = 0;
      return;
    }

    // Trickle: every 400ms, nudge the displayed progress forward.
    // The increment shrinks as we get closer to the next "ceiling" so we
    // never overshoot the real value by too much, and we never hit 100.
    trickleRef.current = setInterval(() => {
      setDisplayProgress((prev) => {
        const real = lastRealProgress.current;

        // If real progress is ahead, ease toward it quickly
        if (real > prev + 0.5) {
          const diff = real - prev;
          return prev + diff * 0.12;
        }

        // If we've reached 100, stay there
        if (real >= 100) return 100;

        // Trickle: creep forward slowly between real updates.
        // The ceiling is halfway between current real progress and the next
        // milestone, capped so we never reach 100 on our own.
        const ceiling = Math.min(real + (100 - real) * 0.45, 99);
        if (prev >= ceiling) return prev;

        // Decelerate as we approach the ceiling
        const room = ceiling - prev;
        const increment = Math.max(0.05, room * 0.02);
        return Math.min(prev + increment, ceiling);
      });
    }, 400);

    return () => {
      if (trickleRef.current) {
        clearInterval(trickleRef.current);
        trickleRef.current = null;
      }
    };
  }, [isActive]);

  // When real progress jumps, immediately kick the display forward
  useEffect(() => {
    if (progress == null) return;
    const target = Math.min(progress, 100);
    setDisplayProgress((prev) => {
      if (target > prev) return prev + (target - prev) * 0.3;
      return prev;
    });
  }, [progress]);

  // Animated dots
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(id);
  }, [isActive]);

  if (!isActive) return null;

  const pct = progress != null ? Math.round(displayProgress) : null;

  return (
    <div className="w-full">
      {/* Progress bar container */}
      <div className="relative w-full h-1.5 bg-[#2d2a26]/8 rounded-full overflow-hidden">
        {pct != null ? (
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${displayProgress}%`,
              backgroundColor: '#c0a280',
              transition: 'width 0.4s ease-out',
            }}
          />
        ) : (
          <div
            className="absolute inset-y-0 rounded-full animate-indeterminate"
            style={{ backgroundColor: '#c0a280', width: '40%' }}
          />
        )}
      </div>

      {/* Info row */}
      <div className="flex items-center justify-between mt-2.5">
        <p className="text-xs text-[#2d2a26]/50 tracking-wide">
          {message || 'Analyserar'}{dots}
        </p>
        <div className="flex items-center gap-3">
          {totalChunks != null && totalChunks > 1 && (
            <span className="text-[10px] text-[#2d2a26]/30 font-medium tabular-nums">
              {completedChunks ?? 0}/{totalChunks} delar
            </span>
          )}
          {pct != null && (
            <span className="text-xs font-semibold text-[#c0a280] tabular-nums min-w-[2.5rem] text-right">
              {pct}%
            </span>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes indeterminate {
          0% {
            left: -40%;
          }
          100% {
            left: 100%;
          }
        }
        .animate-indeterminate {
          animation: indeterminate 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
