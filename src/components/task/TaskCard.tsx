import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { View } from 'react-native';

import { StatusBadge, SyncBadge } from '@/components/task/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';
import type { Task } from '@/types';
import { formatDateTime, formatRelative } from '@/utils/date.utils';
import { isTaskOverdue, summariseLocation } from '@/utils/task.utils';

interface TaskCardProps {
  task: Task;
  onPress: (taskId: string) => void;
}

/**
 * List row for a task. Memoised because the list re-renders on every sync tick
 * and every keystroke in the search field, and rows that did not change should
 * not pay for it.
 *
 * The card leads with what a technician scans for — title, when it is due, and
 * whether it is late — and keeps location and sync state as supporting detail.
 */
const TaskCardComponent = ({ task, onPress }: TaskCardProps) => {
  const theme = useAppTheme();
  const overdue = isTaskOverdue(task);
  const attachmentCount = task.attachments.length;

  return (
    <Card
      onPress={() => onPress(task.id)}
      accessibilityLabel={`${task.title}, ${task.status}, due ${formatDateTime(task.dueDate)}`}
      accessibilityHint="Opens the task details"
      style={{ gap: theme.spacing.xs }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subheading" numberOfLines={2}>
            {task.title}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {task.description}
          </Text>
        </View>
        <StatusBadge status={task.status} />
      </View>

      <View style={{ height: 1, backgroundColor: theme.colors.border }} />

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons
            name={overdue ? 'alert-circle' : 'time-outline'}
            size={15}
            color={overdue ? theme.colors.danger : theme.colors.textSubtle}
          />
          <Text variant="caption" color={overdue ? 'danger' : 'textMuted'} style={{ flex: 1 }}>
            {formatDateTime(task.dueDate)}
            <Text variant="caption" color={overdue ? 'danger' : 'textSubtle'}>
              {`  ·  ${overdue ? 'overdue' : formatRelative(task.dueDate)}`}
            </Text>
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="location-outline" size={15} color={theme.colors.textSubtle} />
          <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
            {summariseLocation(task)}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.xs,
        }}
      >
        <SyncBadge syncStatus={task.syncStatus} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {attachmentCount > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="attach-outline" size={15} color={theme.colors.textSubtle} />
              <Text variant="caption" color="textSubtle">
                {attachmentCount}
              </Text>
            </View>
          ) : null}
          {task.location.latitude !== null ? (
            <Ionicons name="map-outline" size={15} color={theme.colors.textSubtle} />
          ) : null}
          {task.notificationId ? (
            <Ionicons name="notifications-outline" size={15} color={theme.colors.textSubtle} />
          ) : null}
        </View>
      </View>
    </Card>
  );
};

export const TaskCard = memo(TaskCardComponent);
