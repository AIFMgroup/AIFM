import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let toastListeners: Array<(toast: Toast) => void> = [];
let removeListeners: Array<(id: string) => void> = [];

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((
    message: string,
    type: ToastType = 'info',
    duration: number = 4000
  ) => {
    const id = `${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, toast]);

    // Notify global listeners
    toastListeners.forEach((listener) => listener(toast));

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    removeListeners.forEach((listener) => listener(id));
  }, []);

  return { toasts, addToast, removeToast };
};

// Global toast manager
export const showToast = (message: string, type: ToastType = 'info', duration?: number) => {
  const id = `${Date.now()}-${Math.random()}`;
  const toast: Toast = { id, message, type, duration };
  toastListeners.forEach((listener) => listener(toast));

  if (duration ?? 4000 > 0) {
    setTimeout(() => {
      removeListeners.forEach((listener) => listener(id));
    }, duration ?? 4000);
  }
};

export const successToast = (message: string) => showToast(message, 'success');
export const errorToast = (message: string) => showToast(message, 'error');
export const infoToast = (message: string) => showToast(message, 'info');
export const warningToast = (message: string) => showToast(message, 'warning');

// Allow external components to listen for toast events
export const onToastAdded = (listener: (toast: Toast) => void) => {
  toastListeners.push(listener);
  return () => {
    toastListeners = toastListeners.filter((l) => l !== listener);
  };
};

export const onToastRemoved = (listener: (id: string) => void) => {
  removeListeners.push(listener);
  return () => {
    removeListeners = removeListeners.filter((l) => l !== listener);
  };
};
