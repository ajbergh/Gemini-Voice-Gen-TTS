/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ToastProvider.tsx — Global Toast Notification System
 *
 * Provides a React context for showing dismissible toast notifications from
 * anywhere in the component tree. Supports success, error, info, and warning
 * variants with auto-dismiss and manual close. Renders toasts in a fixed
 * bottom-right container with slide-up animation.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Access the toast dispatcher from components inside ToastProvider. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const TOAST_STYLES: Record<ToastType, { bg: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
    icon: <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0" />,
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    icon: <AlertCircle size={16} className="text-red-500 dark:text-red-400 shrink-0" />,
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    icon: <Info size={16} className="text-blue-500 dark:text-blue-400 shrink-0" />,
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    icon: <AlertTriangle size={16} className="text-amber-500 dark:text-amber-400 shrink-0" />,
  },
};

const AUTO_DISMISS_MS = 4000;

/** Provide transient toast notifications for the application. */
const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(1);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextIdRef.current++;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), AUTO_DISMISS_MS);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container — fixed bottom-right, above modals */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map(toast => {
          const style = TOAST_STYLES[toast.type];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm text-sm font-medium animate-slide-up max-w-sm ${style.bg}`}
              role="alert"
            >
              {style.icon}
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
