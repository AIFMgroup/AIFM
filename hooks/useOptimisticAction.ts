/**
 * Optimistic UI Hook
 * 
 * Ger omedelbar visuell feedback innan API-anrop slutförts.
 * Rullar tillbaka vid fel.
 */

import { useState, useCallback, useRef } from 'react';

export interface OptimisticState<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
  isOptimistic: boolean; // True if showing optimistic state
}

export interface OptimisticActionResult<T> {
  state: OptimisticState<T>;
  execute: (
    optimisticUpdate: (current: T) => T,
    action: () => Promise<T>,
    rollbackOnError?: boolean
  ) => Promise<T | undefined>;
  reset: () => void;
  setData: (data: T) => void;
}

/**
 * Hook for optimistic UI updates
 */
export function useOptimisticAction<T>(
  initialData: T,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error, rollbackData: T) => void;
  }
): OptimisticActionResult<T> {
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    isLoading: false,
    error: null,
    isOptimistic: false,
  });

  const rollbackRef = useRef<T>(initialData);

  const execute = useCallback(async (
    optimisticUpdate: (current: T) => T,
    action: () => Promise<T>,
    rollbackOnError = true
  ): Promise<T | undefined> => {
    // Save current state for rollback
    rollbackRef.current = state.data;

    // Apply optimistic update immediately
    const optimisticData = optimisticUpdate(state.data);
    setState(prev => ({
      ...prev,
      data: optimisticData,
      isLoading: true,
      error: null,
      isOptimistic: true,
    }));

    try {
      // Perform actual action
      const result = await action();

      // Update with real data
      setState({
        data: result,
        isLoading: false,
        error: null,
        isOptimistic: false,
      });

      options?.onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (rollbackOnError) {
        // Rollback to previous state
        setState({
          data: rollbackRef.current,
          isLoading: false,
          error,
          isOptimistic: false,
        });
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error,
          isOptimistic: false,
        }));
      }

      options?.onError?.(error, rollbackRef.current);
      return undefined;
    }
  }, [state.data, options]);

  const reset = useCallback(() => {
    setState({
      data: initialData,
      isLoading: false,
      error: null,
      isOptimistic: false,
    });
  }, [initialData]);

  const setData = useCallback((data: T) => {
    setState(prev => ({
      ...prev,
      data,
      isOptimistic: false,
    }));
  }, []);

  return { state, execute, reset, setData };
}

/**
 * Hook for optimistic list operations (add, remove, update)
 */
export function useOptimisticList<T extends { id: string }>(
  initialItems: T[],
  options?: {
    onSuccess?: (items: T[]) => void;
    onError?: (error: Error) => void;
  }
) {
  const { state, execute, setData } = useOptimisticAction(initialItems, options);

  const addItem = useCallback(async (
    newItem: T,
    action: () => Promise<T>
  ) => {
    return execute(
      (items) => [...items, newItem],
      async () => {
        const result = await action();
        // Replace optimistic item with real one
        return state.data.map(item => 
          item.id === newItem.id ? result : item
        );
      }
    );
  }, [execute, state.data]);

  const removeItem = useCallback(async (
    itemId: string,
    action: () => Promise<void>
  ) => {
    return execute(
      (items) => items.filter(item => item.id !== itemId),
      async () => {
        await action();
        return state.data.filter(item => item.id !== itemId);
      }
    );
  }, [execute, state.data]);

  const updateItem = useCallback(async (
    itemId: string,
    updates: Partial<T>,
    action: () => Promise<T>
  ) => {
    return execute(
      (items) => items.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ),
      async () => {
        const result = await action();
        return state.data.map(item => 
          item.id === itemId ? result : item
        );
      }
    );
  }, [execute, state.data]);

  const moveItem = useCallback(async (
    fromIndex: number,
    toIndex: number,
    action?: () => Promise<void>
  ) => {
    return execute(
      (items) => {
        const newItems = [...items];
        const [removed] = newItems.splice(fromIndex, 1);
        newItems.splice(toIndex, 0, removed);
        return newItems;
      },
      async () => {
        if (action) await action();
        const newItems = [...state.data];
        const [removed] = newItems.splice(fromIndex, 1);
        newItems.splice(toIndex, 0, removed);
        return newItems;
      }
    );
  }, [execute, state.data]);

  return {
    items: state.data,
    isLoading: state.isLoading,
    error: state.error,
    isOptimistic: state.isOptimistic,
    addItem,
    removeItem,
    updateItem,
    moveItem,
    setItems: setData,
  };
}

/**
 * Hook for optimistic form submit
 */
export function useOptimisticSubmit<TInput, TOutput>(
  onSubmit: (data: TInput) => Promise<TOutput>,
  options?: {
    onSuccess?: (result: TOutput, input: TInput) => void;
    onError?: (error: Error, input: TInput) => void;
  }
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOptimistic, setIsOptimistic] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(async (
    data: TInput,
    onOptimisticStart?: () => void
  ): Promise<TOutput | undefined> => {
    setIsSubmitting(true);
    setIsOptimistic(true);
    setError(null);

    // Call optimistic start callback immediately
    onOptimisticStart?.();

    try {
      const result = await onSubmit(data);
      setIsOptimistic(false);
      options?.onSuccess?.(result, data);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsOptimistic(false);
      options?.onError?.(error, data);
      return undefined;
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit, options]);

  return {
    submit,
    isSubmitting,
    isOptimistic,
    error,
    clearError: () => setError(null),
  };
}















