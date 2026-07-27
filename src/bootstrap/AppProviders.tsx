import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SettingsProvider } from '@/context/SettingsContext';
import { TaskProvider } from '@/context/TaskContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';

/**
 * Order is deliberate: the theme is a stored preference, the toast needs the
 * theme, and task operations read settings and report through toasts.
 */
export const AppProviders = ({ children }: PropsWithChildren) => (
  <SafeAreaProvider>
    <SettingsProvider>
      <ThemeProvider>
        <ToastProvider>
          <TaskProvider>{children}</TaskProvider>
        </ToastProvider>
      </ThemeProvider>
    </SettingsProvider>
  </SafeAreaProvider>
);
