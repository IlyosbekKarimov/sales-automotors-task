import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { AppProviders } from '@/bootstrap/AppProviders';
import { useTheme } from '@/context/ThemeContext';
import { useReminderNavigation } from '@/hooks/useReminderNavigation';
import { RootNavigator } from '@/navigation/RootNavigator';
import { configureNotifications } from '@/services/notification.service';

/**
 * Everything below the providers. Split out from `App` so it can use the theme
 * and navigation hooks that only exist inside the provider tree.
 */
const AppContent = () => {
  const { isDark } = useTheme();
  const [isNavigationReady, setNavigationReady] = useState(false);

  // Notification channel + foreground behaviour, set up once per launch. Doing
  // this at the root rather than on first use means a reminder scheduled from
  // any screen already has its Android channel to land in.
  useEffect(() => {
    void configureNotifications();
  }, []);

  useReminderNavigation(isNavigationReady);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator onReady={() => setNavigationReady(true)} />
    </>
  );
};

export const App = () => (
  <AppProviders>
    <AppContent />
  </AppProviders>
);
