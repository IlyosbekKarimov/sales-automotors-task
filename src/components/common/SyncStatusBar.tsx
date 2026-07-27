import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';
import { useTasks } from '@/context/TaskContext';
import { formatRelative } from '@/utils/date.utils';

interface SyncStatusBarProps {
  onPress: () => void;
}

/**
 * The persistent "where do I stand" strip above the task list.
 *
 * Offline-first only works if the user can see it working, so this collapses
 * connectivity, the pending-change count and the last sync time into one line
 * that is also the manual sync button.
 */
export const SyncStatusBar = ({ onPress }: SyncStatusBarProps) => {
  const theme = useAppTheme();
  const { isOnline, sync, pendingSyncCount } = useTasks();

  const isSyncing = sync.phase === 'syncing';

  const state = (() => {
    if (isSyncing) {
      return {
        tone: theme.colors.info,
        bg: theme.colors.infoSoft,
        icon: 'sync' as const,
        title: 'Syncing…',
        detail: 'Sending local changes to the server.',
      };
    }
    if (!isOnline) {
      return {
        tone: theme.colors.warning,
        bg: theme.colors.warningSoft,
        icon: 'cloud-offline-outline' as const,
        title: 'Working offline',
        detail:
          pendingSyncCount > 0
            ? `${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} will sync when you reconnect.`
            : 'Everything is saved on this device.',
      };
    }
    if (pendingSyncCount > 0) {
      return {
        tone: theme.colors.warning,
        bg: theme.colors.warningSoft,
        icon: 'cloud-upload-outline' as const,
        title: `${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} pending`,
        detail: 'Tap to sync with the mock server now.',
      };
    }
    if (sync.phase === 'error') {
      return {
        tone: theme.colors.danger,
        bg: theme.colors.dangerSoft,
        icon: 'alert-circle-outline' as const,
        title: 'Last sync failed',
        detail: sync.lastOutcome?.error ?? 'Tap to try again.',
      };
    }
    return {
      tone: theme.colors.success,
      bg: theme.colors.successSoft,
      icon: 'cloud-done-outline' as const,
      title: 'All changes synced',
      detail: sync.lastSyncedAt
        ? `Last sync ${formatRelative(sync.lastSyncedAt)}.`
        : 'Tap to sync now.',
    };
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={isSyncing}
      accessibilityRole="button"
      accessibilityLabel={`${state.title}. ${state.detail}`}
      accessibilityHint="Runs a synchronisation with the mock server"
      accessibilityState={{ busy: isSyncing }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: state.bg,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color={state.tone} />
      ) : (
        <Ionicons name={state.icon} size={19} color={state.tone} />
      )}

      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="caption" style={{ color: state.tone, fontWeight: '700' }}>
          {state.title}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {state.detail}
        </Text>
      </View>

      {!isSyncing ? <Ionicons name="refresh" size={17} color={state.tone} /> : null}
    </Pressable>
  );
};
