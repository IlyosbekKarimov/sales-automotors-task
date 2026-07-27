import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { APP_CONFIG } from '@/constants/config';
import { DEFAULT_SETTINGS, StorageService } from '@/services/storage.service';
import type { AppSettings } from '@/types';
import { logger } from '@/utils/logger';

/**
 * User preferences, hydrated from AsyncStorage on launch and written back on
 * every change. Kept separate from `TaskContext` so that changing the theme does
 * not re-render the task list, and so `ThemeProvider` can sit above the task
 * layer without a circular dependency.
 */

interface SettingsContextValue {
  settings: AppSettings;
  /** False until the stored settings have been read, to avoid a theme flash. */
  isHydrated: boolean;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  /** Effective mock-server URL: the runtime override, else the build-time default. */
  apiBaseUrl: string;
  resetSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider = ({ children }: PropsWithChildren) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    StorageService.getSettings()
      .then((stored) => {
        if (!cancelled) setSettings(stored);
      })
      .catch((error) => logger.warn('[settings] Falling back to defaults.', error))
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Optimistic: the toggle moves immediately and the write happens behind it. A
   * failed write only means the preference does not survive a restart, which is
   * far better UX than a switch that lags or springs back.
   */
  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) =>
      new Promise<void>((resolve) => {
        setSettings((current) => {
          const next = { ...current, ...patch };
          void StorageService.saveSettings(next)
            .catch((error) => logger.warn('[settings] Could not persist settings.', error))
            .finally(resolve);
          return next;
        });
      }),
    []
  );

  const resetSettings = useCallback(() => updateSettings(DEFAULT_SETTINGS), [updateSettings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      isHydrated,
      updateSettings,
      resetSettings,
      apiBaseUrl: settings.apiBaseUrl?.trim() || APP_CONFIG.MOCK_API_URL,
    }),
    [settings, isHydrated, updateSettings, resetSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside <SettingsProvider>.');
  return context;
};
