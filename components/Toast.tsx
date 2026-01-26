'use client';

import { createContext, useContext, useState, useCallback, Fragment, ReactNode } from 'react';
import { Transition } from '@headlessui/react';
import { 
  CheckCircle2, AlertCircle, Info, XCircle, X, 
  Loader2, ArrowRight 
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void;
  // Convenience methods
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  loading: (title: string, message?: string) => string;
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ) => Promise<T>;
}

// ============================================================================
// Context
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  // Return a safe no-op implementation during SSR
  if (!context) {
    const noOp = () => {};
    return {
      toasts: [],
      addToast: noOp as (toast: any) => void,
      removeToast: noOp as (id: string) => void,
      success: noOp as (opts: any) => void,
      error: noOp as (opts: any) => void,
      warning: noOp as (opts: any) => void,
      info: noOp as (opts: any) => void,
      loading: (() => () => {}) as (opts: any) => () => void,
      promise: ((promise: Promise<any>) => promise) as <T>(promise: Promise<T>, opts: any) => Promise<T>,
    };
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? (toast.type === 'loading' ? Infinity : 5000),
      dismissible: toast.dismissible ?? true,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss
    if (newToast.duration !== Infinity) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, 'id'>>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );

    // If updating to a non-loading type, set auto-dismiss
    if (updates.type && updates.type !== 'loading') {
      const duration = updates.duration ?? 5000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  // Convenience methods
  const success = useCallback((title: string, message?: string) => {
    return addToast({ type: 'success', title, message });
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    return addToast({ type: 'error', title, message, duration: 7000 });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    return addToast({ type: 'warning', title, message });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    return addToast({ type: 'info', title, message });
  }, [addToast]);

  const loading = useCallback((title: string, message?: string) => {
    return addToast({ type: 'loading', title, message, dismissible: false });
  }, [addToast]);

  const promise = useCallback(async <T,>(
    promiseArg: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ) => {
    const id = addToast({ type: 'loading', title: options.loading, dismissible: false });

    try {
      const data = await promiseArg;
      const successMsg = typeof options.success === 'function' 
        ? options.success(data) 
        : options.success;
      updateToast(id, { type: 'success', title: successMsg, dismissible: true });
      return data;
    } catch (err) {
      const errorMsg = typeof options.error === 'function' 
        ? options.error(err) 
        : options.error;
      updateToast(id, { type: 'error', title: errorMsg, dismissible: true });
      throw err;
    }
  }, [addToast, updateToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        updateToast,
        success,
        error,
        warning,
        info,
        loading,
        promise,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

// ============================================================================
// Toast Container & Individual Toast
// ============================================================================

function ToastContainer({ 
  toasts, 
  removeToast 
}: { 
  toasts: Toast[]; 
  removeToast: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icons: Record<ToastType, typeof CheckCircle2> = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
    loading: Loader2,
  };

  const colors: Record<ToastType, { bg: string; icon: string; border: string }> = {
    success: { 
      bg: 'bg-emerald-50', 
      icon: 'text-emerald-600', 
      border: 'border-emerald-200' 
    },
    error: { 
      bg: 'bg-red-50', 
      icon: 'text-red-600', 
      border: 'border-red-200' 
    },
    warning: { 
      bg: 'bg-amber-50', 
      icon: 'text-amber-600', 
      border: 'border-amber-200' 
    },
    info: { 
      bg: 'bg-blue-50', 
      icon: 'text-blue-600', 
      border: 'border-blue-200' 
    },
    loading: { 
      bg: 'bg-gray-50', 
      icon: 'text-[#c0a280]', 
      border: 'border-gray-200' 
    },
  };

  const Icon = icons[toast.type];
  const color = colors[toast.type];

  return (
    <Transition
      appear
      show
      as={Fragment}
      enter="transform ease-out duration-300 transition"
      enterFrom="translate-y-2 opacity-0 scale-95"
      enterTo="translate-y-0 opacity-100 scale-100"
      leave="transition ease-in duration-200"
      leaveFrom="opacity-100 scale-100"
      leaveTo="opacity-0 scale-95"
    >
      <div
        className={`
          pointer-events-auto w-full rounded-xl border shadow-lg
          ${color.bg} ${color.border}
          animate-in slide-in-from-right-5 duration-300
        `}
        role="alert"
      >
        <div className="flex items-start gap-3 p-4">
          {/* Icon */}
          <div className={`flex-shrink-0 ${color.icon}`}>
            <Icon className={`w-5 h-5 ${toast.type === 'loading' ? 'animate-spin' : ''}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{toast.title}</p>
            {toast.message && (
              <p className="text-sm text-gray-600 mt-0.5">{toast.message}</p>
            )}
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-[#c0a280] hover:text-[#a08060] transition-colors"
              >
                {toast.action.label}
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Dismiss button */}
          {toast.dismissible && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </Transition>
  );
}

// ============================================================================
// Export
// ============================================================================

export { ToastContext };
