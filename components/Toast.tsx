'use client';

import { useEffect, useState } from 'react';
import { Toast as ToastType, onToastAdded, onToastRemoved } from '@/lib/toast';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const toastColors = {
  success: 'bg-green-50 border-green-200 text-green-900',
  error: 'bg-red-50 border-red-200 text-red-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
};

const iconColors = {
  success: 'text-green-600',
  error: 'text-red-600',
  info: 'text-blue-600',
  warning: 'text-yellow-600',
};

interface ToastItemProps {
  toast: ToastType;
  onRemove: (id: string) => void;
}

const ToastItem = ({ toast, onRemove }: ToastItemProps) => {
  const Icon = toastIcons[toast.type];

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border
        ${toastColors[toast.type]}
        animate-in fade-in slide-in-from-right
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColors[toast.type]}`} />
      <p className="flex-1">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 text-current hover:opacity-70"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  useEffect(() => {
    const unsubscribeAdd = onToastAdded((toast) => {
      setToasts((prev) => [...prev, toast]);
    });

    const unsubscribeRemove = onToastRemoved((id) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    });

    return () => {
      unsubscribeAdd();
      unsubscribeRemove();
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] space-y-3 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        />
      ))}
    </div>
  );
};
