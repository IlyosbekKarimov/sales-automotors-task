import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/types';

/**
 * Navigation for callers outside the React tree — the notification listener can
 * fire before any screen is mounted when a reminder cold-starts the app.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const navigateToTask = (taskId: string): boolean => {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate('TaskDetail', { taskId });
  return true;
};
