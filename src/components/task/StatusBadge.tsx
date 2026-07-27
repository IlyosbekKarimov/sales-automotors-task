import type { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/components/ui/Badge';
import { getStatusTone, getSyncTone } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';
import type { SyncStatus, TaskStatus } from '@/types';

const STATUS_ICONS: Record<TaskStatus, keyof typeof Ionicons.glyphMap> = {
  New: 'sparkles-outline',
  'In Progress': 'play-circle-outline',
  Completed: 'checkmark-circle-outline',
  Cancelled: 'close-circle-outline',
};

const SYNC_ICONS: Record<SyncStatus, keyof typeof Ionicons.glyphMap> = {
  Synced: 'cloud-done-outline',
  'Pending Sync': 'cloud-upload-outline',
  'Sync Failed': 'cloud-offline-outline',
};

export const StatusBadge = ({ status }: { status: TaskStatus }) => {
  const theme = useAppTheme();
  return (
    <Badge label={status} tone={getStatusTone(status, theme.colors)} icon={STATUS_ICONS[status]} />
  );
};

export const SyncBadge = ({ syncStatus }: { syncStatus: SyncStatus }) => {
  const theme = useAppTheme();
  return (
    <Badge
      label={syncStatus}
      tone={getSyncTone(syncStatus, theme.colors)}
      icon={SYNC_ICONS[syncStatus]}
    />
  );
};
