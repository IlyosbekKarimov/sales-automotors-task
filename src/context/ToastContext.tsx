import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { Toast } from '@/components/ui/Toast';
import type { ToastData, ToastVariant } from '@/components/ui/Toast';
import { createId } from '@/utils/id.utils';

/**
 * App-wide feedback channel.
 *
 * Every success, warning and failure message goes through here instead of
 * `Alert.alert`: alerts block the thread, cannot be themed, and force the user
 * to dismiss them before continuing. Only the newest message is shown — stacked
 * toasts are noise, and the most recent event is the one that matters.
 */

export interface ShowToastOptions {
  message: string;
  title?: string;
  variant?: ToastVariant;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  showToast: (options: ShowToastOptions) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  dismissToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Errors linger; successes get out of the way. */
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 2600,
  info: 3000,
  warning: 4200,
  error: 5000,
};

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = useCallback((options: ShowToastOptions) => {
    const variant = options.variant ?? 'info';
    setToast({
      id: createId('toast'),
      message: options.message,
      title: options.title,
      variant,
      durationMs: options.durationMs ?? DEFAULT_DURATION[variant],
      actionLabel: options.actionLabel,
      onAction: options.onAction,
    });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismissToast,
      showSuccess: (message, title) => showToast({ message, title, variant: 'success' }),
      showError: (message, title) => showToast({ message, title, variant: 'error' }),
      showWarning: (message, title) => showToast({ message, title, variant: 'warning' }),
      showInfo: (message, title) => showToast({ message, title, variant: 'info' }),
    }),
    [showToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {toast ? <Toast toast={toast} onDismiss={dismissToast} /> : null}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
};
