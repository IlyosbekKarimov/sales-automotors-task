import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { NOTIFICATION_CONFIG } from '@/constants/config';
import type { AppSettings, Task } from '@/types';
import { formatDateTime, formatTime, parseIso } from '@/utils/date.utils';
import { logger } from '@/utils/logger';

/**
 * Local reminder scheduling.
 *
 * The brief asks for a reminder 30 minutes before a task is due, plus a defined
 * behaviour when the due date is closer than that, plus a demo mode for the
 * review video. Rather than returning a bare id, every scheduling attempt
 * resolves to a tagged `ReminderResult` carrying a message written for the user.
 * The screens simply show `result.message`; deciding *what* happened is this
 * module's job, not the UI's.
 *
 * Only local notifications are used, so everything here also works in Expo Go —
 * remote push has needed a development build since SDK 53.
 */

/** Payload attached to a reminder so tapping it can deep-link to the task. */
export interface ReminderPayload extends Record<string, unknown> {
  taskId: string;
  kind: 'task-reminder';
}

export type ReminderMode = 'lead-time' | 'imminent-fallback' | 'demo';

export type ReminderResult =
  | {
      status: 'scheduled';
      notificationId: string;
      mode: ReminderMode;
      fireAt: string;
      message: string;
    }
  | {
      status: 'skipped';
      reason: 'reminders-disabled' | 'permission-denied' | 'due-date-passed' | 'unsupported-host';
      message: string;
    }
  | { status: 'failed'; message: string };

/**
 * Expo Go on Android cannot host `expo-notifications` since SDK 53: the library
 * throws outright rather than degrading, so any call risks taking the whole app
 * down with a red screen.
 *
 * Every entry point below is therefore short-circuited when running there. The
 * rest of the app stays fully usable in Expo Go for development, and reminders
 * work normally in the development build and the release APK — which is what
 * gets shipped and reviewed.
 */
export const areRemindersSupported = (): boolean =>
  !(isRunningInExpoGo() && Platform.OS === 'android');

export const UNSUPPORTED_HOST_MESSAGE =
  'Reminders need a development build or the release APK — Android removed notification support from Expo Go in SDK 53.';

const unsupportedResult: ReminderResult = {
  status: 'skipped',
  reason: 'unsupported-host',
  message: UNSUPPORTED_HOST_MESSAGE,
};

let handlerConfigured = false;

/**
 * Foreground behaviour + the Android channel. Safe to call more than once; the
 * guard exists only to avoid redundant native calls on every app resume.
 */
export const configureNotifications = async (): Promise<void> => {
  if (!areRemindersSupported()) return;

  if (!handlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  }

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CONFIG.ANDROID_CHANNEL_ID, {
        name: NOTIFICATION_CONFIG.ANDROID_CHANNEL_NAME,
        description: 'Reminders fired shortly before a field task is due.',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
    } catch (error) {
      logger.warn('[notifications] Could not create the Android channel.', error);
    }
  }
};

export interface PermissionState {
  granted: boolean;
  canAskAgain: boolean;
}

export const ensurePermissions = async (): Promise<PermissionState> => {
  if (!areRemindersSupported()) return { granted: false, canAskAgain: false };

  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return { granted: true, canAskAgain: current.canAskAgain };

    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return { granted: requested.granted, canAskAgain: requested.canAskAgain };
  } catch (error) {
    logger.warn('[notifications] Permission check failed.', error);
    return { granted: false, canAskAgain: false };
  }
};

const buildContent = (task: Task, subtitle: string): Notifications.NotificationContentInput => ({
  title: `Upcoming: ${task.title}`,
  body: `${subtitle}\n${task.location.address || 'No address recorded'}`,
  data: { taskId: task.id, kind: 'task-reminder' } satisfies ReminderPayload,
  sound: 'default',
  color: '#2563EB',
});

/** Removing a reminder must never fail loudly — the id may already be gone. */
export const cancelReminder = async (notificationId: string | null): Promise<void> => {
  if (!notificationId || !areRemindersSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    logger.warn('[notifications] Could not cancel reminder.', error);
  }
};

/**
 * Cancels any existing reminder for the task and schedules a new one.
 *
 * Resolution order:
 *   1. reminders switched off in Settings   → skipped
 *   2. OS permission refused                → skipped, with a message that says why
 *   3. demo mode on                         → fires in ~35 s (for the review video)
 *   4. due date more than 30 min away       → fires exactly 30 min before
 *   5. due date within the next 30 min      → fires in ~10 s, clearly labelled
 *   6. due date already passed              → skipped, nothing to remind about
 */
export const scheduleTaskReminder = async (
  task: Task,
  settings: AppSettings
): Promise<ReminderResult> => {
  if (!areRemindersSupported()) return unsupportedResult;

  await cancelReminder(task.notificationId);

  if (!settings.remindersEnabled) {
    return {
      status: 'skipped',
      reason: 'reminders-disabled',
      message: 'Reminders are turned off in Settings, so none was scheduled.',
    };
  }

  const permission = await ensurePermissions();
  if (!permission.granted) {
    return {
      status: 'skipped',
      reason: 'permission-denied',
      message: permission.canAskAgain
        ? 'Notification permission was declined, so no reminder was scheduled.'
        : 'Notifications are blocked for this app. Enable them in system settings to get reminders.',
    };
  }

  const dueDate = parseIso(task.dueDate);
  if (!dueDate) {
    return { status: 'failed', message: 'The due date could not be read, so no reminder was set.' };
  }

  const now = Date.now();
  const leadTimeMs = NOTIFICATION_CONFIG.LEAD_TIME_MINUTES * 60_000;
  const reminderTime = dueDate.getTime() - leadTimeMs;

  try {
    await configureNotifications();

    if (settings.demoRemindersEnabled) {
      const seconds = NOTIFICATION_CONFIG.DEMO_DELAY_SECONDS;
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: buildContent(task, `Demo reminder · due ${formatDateTime(task.dueDate)}`),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          channelId: NOTIFICATION_CONFIG.ANDROID_CHANNEL_ID,
        },
      });

      return {
        status: 'scheduled',
        notificationId,
        mode: 'demo',
        fireAt: new Date(now + seconds * 1000).toISOString(),
        message: `Demo mode is on — this reminder arrives in ${seconds} seconds.`,
      };
    }

    if (reminderTime > now) {
      const fireAt = new Date(reminderTime);
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: buildContent(
          task,
          `Due at ${formatTime(task.dueDate)} — starts in ${NOTIFICATION_CONFIG.LEAD_TIME_MINUTES} minutes`
        ),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: NOTIFICATION_CONFIG.ANDROID_CHANNEL_ID,
        },
      });

      return {
        status: 'scheduled',
        notificationId,
        mode: 'lead-time',
        fireAt: fireAt.toISOString(),
        message: `Reminder set for ${formatDateTime(fireAt.toISOString())}.`,
      };
    }

    if (dueDate.getTime() > now) {
      // Under the 30-minute lead time: schedule immediately rather than drop it.
      const seconds = NOTIFICATION_CONFIG.IMMINENT_FALLBACK_SECONDS;
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: buildContent(task, `Due very soon — ${formatDateTime(task.dueDate)}`),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          channelId: NOTIFICATION_CONFIG.ANDROID_CHANNEL_ID,
        },
      });

      return {
        status: 'scheduled',
        notificationId,
        mode: 'imminent-fallback',
        fireAt: new Date(now + seconds * 1000).toISOString(),
        message: `This task is due in under ${NOTIFICATION_CONFIG.LEAD_TIME_MINUTES} minutes, so the reminder arrives right away.`,
      };
    }

    return {
      status: 'skipped',
      reason: 'due-date-passed',
      message: 'The due date has already passed, so no reminder was scheduled.',
    };
  } catch (error) {
    logger.warn('[notifications] Scheduling failed.', error);
    return {
      status: 'failed',
      message: 'The reminder could not be scheduled. The task itself was saved.',
    };
  }
};

/** Settings-screen affordance so the reviewer can verify delivery on its own. */
export const sendTestReminder = async (): Promise<ReminderResult> => {
  if (!areRemindersSupported()) return unsupportedResult;

  const permission = await ensurePermissions();
  if (!permission.granted) {
    return {
      status: 'skipped',
      reason: 'permission-denied',
      message: 'Notifications are blocked for this app. Enable them in system settings.',
    };
  }

  try {
    await configureNotifications();
    const seconds = 5;
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Field Task Manager',
        body: 'Test reminder delivered. Scheduling works on this device.',
        data: { kind: 'test-reminder' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: NOTIFICATION_CONFIG.ANDROID_CHANNEL_ID,
      },
    });

    return {
      status: 'scheduled',
      notificationId,
      mode: 'demo',
      fireAt: new Date(Date.now() + seconds * 1000).toISOString(),
      message: `Test reminder arrives in ${seconds} seconds.`,
    };
  } catch (error) {
    logger.warn('[notifications] Test reminder failed.', error);
    return { status: 'failed', message: 'Could not send the test reminder.' };
  }
};

export const getScheduledReminderCount = async (): Promise<number> => {
  if (!areRemindersSupported()) return 0;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.length;
  } catch {
    return 0;
  }
};

/** Extracts a task id from a tapped notification, if it carries one. */
export const readTaskIdFromResponse = (
  response: Notifications.NotificationResponse
): string | null => {
  const data = response.notification.request.content.data as Partial<ReminderPayload> | undefined;
  return typeof data?.taskId === 'string' ? data.taskId : null;
};
