import { createContext, useCallback, useContext, useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import type { ThemePreference } from '@/types';

/**
 * Resolves the stored preference (`light` / `dark` / `system`) against the OS
 * setting and exposes the resulting token set. Components read tokens from here
 * instead of importing a palette, which is what makes the toggle instant and
 * total — there is no screen that can be left behind in the wrong scheme.
 */

interface ThemeContextValue {
  theme: AppTheme;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Cycles light → dark → system, for the single-tap header toggle. */
  cyclePreference: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const CYCLE: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const { settings, updateSettings } = useSettings();
  const systemScheme = useColorScheme();

  const preference = settings.themePreference;
  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  const setPreference = useCallback(
    (next: ThemePreference) => {
      void updateSettings({ themePreference: next });
    },
    [updateSettings]
  );

  const cyclePreference = useCallback(() => {
    void updateSettings({ themePreference: CYCLE[preference] });
  }, [preference, updateSettings]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: isDark ? darkTheme : lightTheme,
      isDark,
      preference,
      setPreference,
      cyclePreference,
    }),
    [isDark, preference, setPreference, cyclePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return context;
};

/** Convenience for the common case of only needing the token set. */
export const useAppTheme = (): AppTheme => useTheme().theme;
