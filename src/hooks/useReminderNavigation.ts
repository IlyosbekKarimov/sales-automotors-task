import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

import { navigateToTask } from '@/navigation/navigationRef';
import { areRemindersSupported, readTaskIdFromResponse } from '@/services/notification.service';
import { logger } from '@/utils/logger';

/**
 * Opens the relevant task when a reminder is tapped.
 *
 * Two cases have to be handled separately: the app was already running (the
 * listener fires), or it was launched by the tap (the response is waiting in
 * `getLastNotificationResponseAsync`). Missing the second is the classic bug
 * where tapping a notification just opens the home screen.
 */
export const useReminderNavigation = (isNavigationReady: boolean): void => {
  const handledResponseId = useRef<string | null>(null);

  useEffect(() => {
    // Expo Go on Android throws from expo-notifications rather than no-op'ing.
    if (!isNavigationReady || !areRemindersSupported()) return;

    const open = (response: Notifications.NotificationResponse | null | undefined) => {
      if (!response) return;
      const identifier = response.notification.request.identifier;
      // Cold-start responses replay on every mount; only act on each one once.
      if (handledResponseId.current === identifier) return;

      const taskId = readTaskIdFromResponse(response);
      if (!taskId) return;
      if (navigateToTask(taskId)) handledResponseId.current = identifier;
    };

    try {
      void Notifications.getLastNotificationResponseAsync().then(open);
      const subscription = Notifications.addNotificationResponseReceivedListener(open);
      return () => subscription.remove();
    } catch (error) {
      // Never let notification wiring take down the app shell.
      logger.warn('[notifications] Could not subscribe to reminder taps.', error);
      return undefined;
    }
  }, [isNavigationReady]);
};
