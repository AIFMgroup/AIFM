'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload } from 'lucide-react';

interface FullPageDropZoneProps {
  onFiles: (files: File[]) => void;
  accept?: RegExp;
  maxSizeMB?: number;
  children: React.ReactNode;
  disabled?: boolean;
}

/**
 * Wraps the entire page content and intercepts drag-and-drop anywhere
 * within the viewport. Shows a full-screen overlay when files are dragged in.
 */
export default function FullPageDropZone({
  onFiles,
  accept = /\.(pdf|docx?|xlsx?)$/i,
  maxSizeMB = 50,
  children,
  disabled = false,
}: FullPageDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounter.current++;
      if (e.dataTransfer?.types?.includes('Files')) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    },
    []
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      if (disabled) return;

      const droppedFiles = Array.from(e.dataTransfer?.files || []);
      const maxBytes = maxSizeMB * 1024 * 1024;
      const valid = droppedFiles.filter(
        (f) => accept.test(f.name) && f.size <= maxBytes
      );
      if (valid.length > 0) {
        onFiles(valid);
      }
    },
    [onFiles, accept, maxSizeMB, disabled]
  );

  useEffect(() => {
    const win = window;
    win.addEventListener('dragenter', handleDragEnter);
    win.addEventListener('dragleave', handleDragLeave);
    win.addEventListener('dragover', handleDragOver);
    win.addEventListener('drop', handleDrop);
    return () => {
      win.removeEventListener('dragenter', handleDragEnter);
      win.removeEventListener('dragleave', handleDragLeave);
      win.removeEventListener('dragover', handleDragOver);
      win.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return (
    <>
      {children}

      {/* Full-screen overlay when dragging files */}
      {isDragging && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />

          {/* Dashed border zone */}
          <div className="relative m-6 w-[calc(100%-3rem)] h-[calc(100%-3rem)] rounded-3xl border-[3px] border-dashed border-aifm-gold/50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 animate-pulse">
              <div className="w-20 h-20 rounded-2xl bg-aifm-gold/10 flex items-center justify-center">
                <Upload className="w-10 h-10 text-aifm-gold" />
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-aifm-charcoal">
                  Släpp filer här
                </p>
                <p className="text-sm text-aifm-charcoal/50 mt-1">
                  PDF, Word, Excel – max {maxSizeMB} MB per fil
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
