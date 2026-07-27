import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { HistoryItem } from '@/components/history/HistoryItem';
import { AttachmentGallery } from '@/components/task/AttachmentGallery';
import { StatusBadge, SyncBadge } from '@/components/task/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { OptionSheet } from '@/components/ui/OptionSheet';
import type { SheetOption } from '@/components/ui/OptionSheet';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { getStatusTone } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';
import { useTasks } from '@/context/TaskContext';
import { useToast } from '@/context/ToastContext';
import type { RootStackScreenProps } from '@/navigation/types';
import {
  captureImageWithCamera,
  pickDocuments,
  pickImagesFromLibrary,
} from '@/services/attachment.service';
import type { AttachmentPickResult } from '@/services/attachment.service';
import type { TaskStatus } from '@/types';
import { formatDateTime, formatRelative } from '@/utils/date.utils';
import { availableStatusTransitions, hasCoordinates, isTaskOverdue } from '@/utils/task.utils';

type Props = RootStackScreenProps<'TaskDetail'>;
type AttachmentSource = 'camera' | 'library' | 'document';

const ATTACHMENT_OPTIONS: SheetOption<AttachmentSource>[] = [
  { value: 'camera', label: 'Take a photo', icon: 'camera-outline' },
  { value: 'library', label: 'Choose from photos', icon: 'images-outline' },
  { value: 'document', label: 'Attach a file', icon: 'document-attach-outline' },
];

interface DetailRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone?: 'default' | 'danger';
}

const DetailRow = ({ icon, label, value, tone = 'default' }: DetailRowProps) => {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
      <Ionicons
        name={icon}
        size={18}
        color={tone === 'danger' ? theme.colors.danger : theme.colors.textSubtle}
        style={{ marginTop: 2 }}
      />
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="caption" color="textSubtle">
          {label}
        </Text>
        <Text variant="body" color={tone === 'danger' ? 'danger' : 'text'}>
          {value}
        </Text>
      </View>
    </View>
  );
};

/**
 * Full task view: every stored field, its attachments, its reminder state and
 * its slice of the audit trail — plus the three actions that matter in the
 * field (change status, attach evidence, delete).
 */
export const TaskDetailScreen = ({ navigation, route }: Props) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { tasks, historyLogs, changeTaskStatus, deleteTask, addAttachments, removeAttachment } =
    useTasks();

  const { taskId } = route.params;
  // Read from the list rather than a snapshot so the screen tracks live updates.
  const task = useMemo(() => tasks.find((entry) => entry.id === taskId), [tasks, taskId]);

  const [isStatusSheetOpen, setStatusSheetOpen] = useState(false);
  const [isSourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const taskHistory = useMemo(
    () => historyLogs.filter((log) => log.taskId === taskId),
    [historyLogs, taskId]
  );

  const handleStatusChange = useCallback(
    async (status: TaskStatus) => {
      setStatusSheetOpen(false);
      if (!task) return;
      const result = await changeTaskStatus(task.id, status);
      if (result.ok) showSuccess(`Status set to "${status}".`, 'Task updated');
      else showError(result.message, 'Status not changed');
    },
    [task, changeTaskStatus, showSuccess, showError]
  );

  const handleAttachmentPick = useCallback(
    async (source: AttachmentSource) => {
      setSourceSheetOpen(false);
      if (!task) return;

      const pick =
        source === 'camera'
          ? captureImageWithCamera
          : source === 'library'
            ? pickImagesFromLibrary
            : pickDocuments;

      const picked: AttachmentPickResult = await pick();
      if (picked.status === 'denied') return showWarning(picked.message, 'Permission needed');
      if (picked.status === 'error') return showError(picked.message, 'Attachment failed');
      if (picked.status === 'cancelled') return;

      const result = await addAttachments(task.id, picked.attachments);
      if (result.ok) showSuccess(`${picked.attachments.length} file attached.`);
      else showError(result.message, 'Attachment not saved');
    },
    [task, addAttachments, showSuccess, showError, showWarning]
  );

  const handleRemoveAttachment = useCallback(
    async (attachmentId: string) => {
      if (!task) return;
      const result = await removeAttachment(task.id, attachmentId);
      if (result.ok) showInfo('Attachment removed.');
      else showError(result.message, 'Could not remove attachment');
    },
    [task, removeAttachment, showInfo, showError]
  );

  const handleDelete = useCallback(async () => {
    if (!task) return;
    setIsDeleting(true);
    const result = await deleteTask(task.id);
    setIsDeleting(false);
    setDeleteDialogOpen(false);

    if (!result.ok) return showError(result.message, 'Task not deleted');
    showSuccess('Task deleted. The server is updated on the next sync.', 'Deleted');
    navigation.goBack();
  }, [task, deleteTask, showError, showSuccess, navigation]);

  if (!task) {
    return (
      <Screen>
        <ScreenHeader title="Task" onBack={() => navigation.goBack()} showThemeToggle={false} />
        <EmptyState
          icon="help-circle-outline"
          title="Task not found"
          description="This task has been deleted. Nothing else was affected."
          actionLabel="Back to tasks"
          onAction={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const overdue = isTaskOverdue(task);
  const statusTone = getStatusTone(task.status, theme.colors);

  return (
    <Screen>
      <ScreenHeader
        title="Task details"
        subtitle={task.title}
        onBack={() => navigation.goBack()}
        showThemeToggle={false}
        actions={
          <IconButton
            icon="create-outline"
            accessibilityLabel="Edit this task"
            onPress={() => navigation.navigate('TaskForm', { taskId: task.id })}
          />
        }
      />

      <ScrollView
        contentContainerStyle={{
          padding: theme.layout.screenPadding,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.md,
        }}
      >
        <Card style={{ gap: theme.spacing.sm, borderLeftWidth: 4, borderLeftColor: statusTone.fg }}>
          <Text variant="title">{task.title}</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
            <StatusBadge status={task.status} />
            <SyncBadge syncStatus={task.syncStatus} />
          </View>
          <Text variant="body" color="textMuted">
            {task.description}
          </Text>
        </Card>

        <Section title="Schedule and location">
          <Card style={{ gap: theme.spacing.sm }}>
            <DetailRow
              icon={overdue ? 'alert-circle-outline' : 'calendar-outline'}
              label={overdue ? 'Due (overdue)' : 'Due'}
              value={`${formatDateTime(task.dueDate)} · ${formatRelative(task.dueDate)}`}
              tone={overdue ? 'danger' : 'default'}
            />
            <DetailRow
              icon="location-outline"
              label="Address"
              value={task.location.address || 'No address recorded'}
            />
            {hasCoordinates(task) ? (
              <>
                <DetailRow
                  icon="navigate-outline"
                  label="Coordinates"
                  value={`${task.location.latitude!.toFixed(6)}, ${task.location.longitude!.toFixed(6)}`}
                />
                <Button
                  label="Show on map"
                  icon="map-outline"
                  variant="secondary"
                  fullWidth
                  onPress={() =>
                    navigation.navigate('Tabs', {
                      screen: 'Map',
                      params: { focusTaskId: task.id },
                    })
                  }
                />
              </>
            ) : (
              <Text variant="caption" color="textSubtle">
                No coordinates set, so this task does not appear on the map. Add them by editing the
                task.
              </Text>
            )}
            <DetailRow
              icon="notifications-outline"
              label="Reminder"
              value={
                task.notificationId
                  ? 'Scheduled — you will be notified before this task is due.'
                  : 'No reminder scheduled for this task.'
              }
            />
          </Card>
        </Section>

        <Section title={`Attachments (${task.attachments.length})`}>
          <Card style={{ gap: theme.spacing.sm }}>
            <AttachmentGallery
              attachments={task.attachments}
              onRemove={(attachmentId) => void handleRemoveAttachment(attachmentId)}
              emptyHint="Nothing attached to this task yet."
            />
            <Button
              label="Add attachment"
              icon="add-circle-outline"
              variant="secondary"
              fullWidth
              onPress={() => setSourceSheetOpen(true)}
            />
          </Card>
        </Section>

        <Section title="Record">
          <Card style={{ gap: theme.spacing.sm }}>
            <DetailRow
              icon="add-circle-outline"
              label="Created"
              value={formatDateTime(task.createdAt)}
            />
            <DetailRow
              icon="time-outline"
              label="Last modified"
              value={`${formatDateTime(task.updatedAt)} · ${formatRelative(task.updatedAt)}`}
            />
          </Card>
        </Section>

        <Section title={`History (${taskHistory.length})`}>
          <Card>
            {taskHistory.length === 0 ? (
              <Text variant="caption" color="textSubtle">
                No history recorded for this task yet.
              </Text>
            ) : (
              taskHistory.map((log, index) => (
                <HistoryItem key={log.id} log={log} isLast={index === taskHistory.length - 1} />
              ))
            )}
          </Card>
        </Section>

        <View style={{ gap: theme.spacing.xs }}>
          <Button
            label="Change status"
            icon="swap-horizontal-outline"
            fullWidth
            onPress={() => setStatusSheetOpen(true)}
          />
          <Button
            label="Delete task"
            icon="trash-outline"
            variant="danger"
            fullWidth
            onPress={() => setDeleteDialogOpen(true)}
          />
        </View>
      </ScrollView>

      <OptionSheet
        visible={isStatusSheetOpen}
        title="Change status"
        subtitle="Every change is timestamped in the history log"
        options={availableStatusTransitions(task.status).map((status) => ({
          value: status,
          label: status,
          tint: getStatusTone(status, theme.colors).fg,
        }))}
        selectedValue={task.status}
        onSelect={(status) => void handleStatusChange(status)}
        onClose={() => setStatusSheetOpen(false)}
      />

      <OptionSheet
        visible={isSourceSheetOpen}
        title="Add an attachment"
        options={ATTACHMENT_OPTIONS}
        onSelect={(source) => void handleAttachmentPick(source)}
        onClose={() => setSourceSheetOpen(false)}
      />

      <ConfirmDialog
        visible={isDeleteDialogOpen}
        title="Delete this task?"
        message={`"${task.title}" and its ${task.attachments.length} attachment${
          task.attachments.length === 1 ? '' : 's'
        } will be removed from this device. The deletion is sent to the server on the next sync.`}
        confirmLabel="Delete"
        loading={isDeleting}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </Screen>
  );
};
