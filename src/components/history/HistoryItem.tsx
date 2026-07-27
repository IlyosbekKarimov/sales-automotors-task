import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';
import type { HistoryAction, HistoryLog } from '@/types';
import { formatTime } from '@/utils/date.utils';
import { describeHistoryAction } from '@/utils/format.utils';

const ACTION_ICONS: Record<HistoryAction, keyof typeof Ionicons.glyphMap> = {
  CREATED: 'add-circle-outline',
  UPDATED: 'create-outline',
  STATUS_CHANGED: 'swap-horizontal-outline',
  ATTACHMENT_ADDED: 'attach-outline',
  ATTACHMENT_REMOVED: 'trash-bin-outline',
  DELETED: 'trash-outline',
  SYNCED: 'cloud-done-outline',
  SYNC_FAILED: 'cloud-offline-outline',
  REMINDER_SCHEDULED: 'notifications-outline',
};

const actionTone = (action: HistoryAction, colors: ThemeColors): { fg: string; bg: string } => {
  switch (action) {
    case 'CREATED':
      return { fg: colors.info, bg: colors.infoSoft };
    case 'DELETED':
    case 'SYNC_FAILED':
    case 'ATTACHMENT_REMOVED':
      return { fg: colors.danger, bg: colors.dangerSoft };
    case 'SYNCED':
      return { fg: colors.success, bg: colors.successSoft };
    case 'REMINDER_SCHEDULED':
      return { fg: colors.warning, bg: colors.warningSoft };
    default:
      return { fg: colors.primary, bg: colors.primarySoft };
  }
};

interface HistoryItemProps {
  log: HistoryLog;
  /** Absent when the referenced task has been deleted. */
  onPress?: (taskId: string) => void;
  isLast: boolean;
}

/**
 * One timeline entry. The connecting rail is drawn per row rather than as a
 * separate element so it survives `FlatList` recycling and section boundaries.
 */
const HistoryItemComponent = ({ log, onPress, isLast }: HistoryItemProps) => {
  const theme = useAppTheme();
  const tone = actionTone(log.action, theme.colors);
  const isPressable = Boolean(onPress && log.taskId);

  const body = (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      <View style={{ alignItems: 'center', width: 34 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tone.bg,
          }}
        >
          <Ionicons name={ACTION_ICONS[log.action]} size={17} color={tone.fg} />
        </View>
        {!isLast ? (
          <View style={{ flex: 1, width: 2, backgroundColor: theme.colors.border, marginTop: 4 }} />
        ) : null}
      </View>

      <View style={{ flex: 1, paddingBottom: isLast ? 0 : theme.spacing.md, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
            {describeHistoryAction(log.action)}
          </Text>
          <Text variant="caption" color="textSubtle">
            {formatTime(log.timestamp)}
          </Text>
        </View>

        <Text variant="caption" color="textMuted">
          {log.description}
        </Text>

        <Text variant="caption" color="textSubtle" numberOfLines={1}>
          {log.taskTitle}
        </Text>
      </View>
    </View>
  );

  if (!isPressable) return body;

  return (
    <Pressable
      onPress={() => onPress?.(log.taskId)}
      accessibilityRole="button"
      accessibilityLabel={`${describeHistoryAction(log.action)}. ${log.description}`}
      accessibilityHint="Opens the related task"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
};

export const HistoryItem = memo(HistoryItemComponent);
