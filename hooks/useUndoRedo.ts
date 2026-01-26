/**
 * Undo/Redo Hook
 * 
 * Hanterar historik för ändringar med möjlighet att ångra och göra om.
 * Stödjer keyboard shortcuts (Ctrl+Z, Ctrl+Y).
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface UndoRedoOptions<T> {
  maxHistory?: number; // Max antal steg att spara (default: 50)
  debounceMs?: number; // Debounce för att gruppera snabba ändringar (default: 300)
  onUndo?: (state: T) => void;
  onRedo?: (state: T) => void;
}

export interface UndoRedoResult<T> {
  state: T;
  setState: (newState: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  history: T[];
  historyIndex: number;
  reset: (initialState?: T) => void;
  saveCheckpoint: () => void; // Force save current state as checkpoint
}

/**
 * Hook for undo/redo functionality
 */
export function useUndoRedo<T>(
  initialState: T,
  options: UndoRedoOptions<T> = {}
): UndoRedoResult<T> {
  const {
    maxHistory = 50,
    debounceMs = 300,
    onUndo,
    onRedo,
  } = options;

  // Store history and current index
  const [history, setHistory] = useState<T[]>([initialState]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<T | null>(null);

  // Current state is the history at current index
  const state = history[historyIndex];

  // Commit pending state to history
  const commitPendingState = useCallback(() => {
    if (pendingStateRef.current !== null) {
      const newState = pendingStateRef.current;
      pendingStateRef.current = null;

      setHistory(prev => {
        // Remove any "future" history after current index
        const newHistory = prev.slice(0, historyIndex + 1);
        
        // Don't add if same as current
        if (JSON.stringify(newHistory[newHistory.length - 1]) === JSON.stringify(newState)) {
          return prev;
        }
        
        // Add new state
        newHistory.push(newState);
        
        // Trim if exceeds max
        if (newHistory.length > maxHistory) {
          newHistory.shift();
          return newHistory;
        }
        
        return newHistory;
      });

      setHistoryIndex(prev => Math.min(prev + 1, maxHistory - 1));
    }
  }, [historyIndex, maxHistory]);

  // Set state with debouncing
  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    const resolvedState = typeof newState === 'function'
      ? (newState as (prev: T) => T)(state)
      : newState;

    pendingStateRef.current = resolvedState;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      commitPendingState();
    }, debounceMs);
  }, [state, debounceMs, commitPendingState]);

  // Undo
  const undo = useCallback(() => {
    // Commit any pending changes first
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      commitPendingState();
    }

    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onUndo?.(history[newIndex]);
    }
  }, [historyIndex, history, onUndo, commitPendingState]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onRedo?.(history[newIndex]);
    }
  }, [historyIndex, history, onRedo]);

  // Reset history
  const reset = useCallback((newInitialState?: T) => {
    const resetState = newInitialState ?? initialState;
    setHistory([resetState]);
    setHistoryIndex(0);
    pendingStateRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, [initialState]);

  // Force save checkpoint
  const saveCheckpoint = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    commitPendingState();
  }, [commitPendingState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Undo: Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return {
    state: pendingStateRef.current ?? state,
    setState,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    history,
    historyIndex,
    reset,
    saveCheckpoint,
  };
}

/**
 * Hook for tracking changes to a specific field
 */
export function useFieldHistory<T>(
  value: T,
  onChange: (value: T) => void,
  options: UndoRedoOptions<T> = {}
) {
  const undoRedo = useUndoRedo(value, options);

  // Sync external value changes
  useEffect(() => {
    if (value !== undoRedo.state) {
      undoRedo.setState(value);
    }
  }, [value]);

  // Sync internal changes to external
  useEffect(() => {
    if (undoRedo.state !== value) {
      onChange(undoRedo.state);
    }
  }, [undoRedo.state, onChange, value]);

  return {
    undo: undoRedo.undo,
    redo: undoRedo.redo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
  };
}

/**
 * Simple undo stack for specific actions
 */
export function useUndoStack<T>(maxSize = 50) {
  const [undoStack, setUndoStack] = useState<T[]>([]);
  const [redoStack, setRedoStack] = useState<T[]>([]);

  const push = useCallback((item: T) => {
    setUndoStack(prev => {
      const newStack = [...prev, item];
      if (newStack.length > maxSize) newStack.shift();
      return newStack;
    });
    // Clear redo stack on new action
    setRedoStack([]);
  }, [maxSize]);

  const undo = useCallback((): T | undefined => {
    let item: T | undefined;
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      item = newStack.pop();
      if (item !== undefined) {
        setRedoStack(redo => [...redo, item as T]);
      }
      return newStack;
    });
    return item;
  }, []);

  const redo = useCallback((): T | undefined => {
    let item: T | undefined;
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      item = newStack.pop();
      if (item !== undefined) {
        setUndoStack(undo => [...undo, item as T]);
      }
      return newStack;
    });
    return item;
  }, []);

  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    push,
    undo,
    redo,
    clear,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
  };
}















