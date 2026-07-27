import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { AttachmentGallery } from '@/components/task/AttachmentGallery';
import { DueDateField } from '@/components/task/DueDateField';
import { LocationFields } from '@/components/task/LocationFields';
import type { LocationFieldsValue } from '@/components/task/LocationFields';
import { StatusBadge } from '@/components/task/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { OptionSheet } from '@/components/ui/OptionSheet';
import type { SheetOption } from '@/components/ui/OptionSheet';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { VALIDATION_RULES } from '@/constants/config';
import { useAppTheme } from '@/context/ThemeContext';
import { useTasks } from '@/context/TaskContext';
import { useToast } from '@/context/ToastContext';
import type { RootStackScreenProps } from '@/navigation/types';
import {
  captureImageWithCamera,
  deleteAttachmentFiles,
  pickDocuments,
  pickImagesFromLibrary,
} from '@/services/attachment.service';
import type { AttachmentPickResult } from '@/services/attachment.service';
import { TASK_STATUSES } from '@/types';
import type { TaskAttachment, TaskInput, TaskStatus } from '@/types';
import { defaultDueDate, parseIso } from '@/utils/date.utils';
import { validateCoordinates, validateTaskForm } from '@/utils/validation.utils';
import type { TaskFormShape } from '@/utils/validation.utils';

type Props = RootStackScreenProps<'TaskForm'>;
type AttachmentSource = 'camera' | 'library' | 'document';

const ATTACHMENT_OPTIONS: SheetOption<AttachmentSource>[] = [
  {
    value: 'camera',
    label: 'Take a photo',
    description: 'Photograph the site now',
    icon: 'camera-outline',
  },
  {
    value: 'library',
    label: 'Choose from photos',
    description: 'Pick up to 5 images',
    icon: 'images-outline',
  },
  {
    value: 'document',
    label: 'Attach a file',
    description: 'PDF, image or text document',
    icon: 'document-attach-outline',
  },
];

const STATUS_OPTIONS: SheetOption<TaskStatus>[] = TASK_STATUSES.map((status) => ({
  value: status,
  label: status,
}));

/**
 * Create/edit form.
 *
 * Two behaviours are worth calling out:
 *
 * - **Errors appear after a field is touched, not while it is being typed.**
 *   Flagging "title too short" on the first keystroke is noise; validation runs
 *   on blur, and after the first submit attempt every field validates live.
 * - **Picked files are cleaned up on abandon.** An attachment is copied to disk
 *   the moment it is chosen, so leaving without saving deletes those files
 *   rather than leaking them into the app's document directory forever.
 */
export const TaskFormScreen = ({ navigation, route }: Props) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { getTaskById, createTask, updateTask } = useTasks();

  const taskId = route.params?.taskId;
  const existingTask = useMemo(
    () => (taskId ? getTaskById(taskId) : undefined),
    [taskId, getTaskById]
  );
  const isEditing = Boolean(existingTask);

  const [title, setTitle] = useState(existingTask?.title ?? '');
  const [description, setDescription] = useState(existingTask?.description ?? '');
  const [dueDate, setDueDate] = useState<Date>(
    () => (existingTask ? parseIso(existingTask.dueDate) : null) ?? defaultDueDate()
  );
  const [status, setStatus] = useState<TaskStatus>(existingTask?.status ?? 'New');
  const [location, setLocation] = useState<LocationFieldsValue>({
    address: existingTask?.location.address ?? '',
    latitude: existingTask?.location.latitude?.toString() ?? '',
    longitude: existingTask?.location.longitude?.toString() ?? '',
  });
  const [attachments, setAttachments] = useState<TaskAttachment[]>(existingTask?.attachments ?? []);

  const [touched, setTouched] = useState<Partial<Record<keyof TaskFormShape, boolean>>>({});
  const [didAttemptSubmit, setDidAttemptSubmit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [isStatusSheetOpen, setStatusSheetOpen] = useState(false);
  const [isDiscardDialogOpen, setDiscardDialogOpen] = useState(false);

  /** Files written to disk during this session; discarded if the form is abandoned. */
  const sessionAttachments = useRef<TaskAttachment[]>([]);
  const didSave = useRef(false);

  useEffect(
    () => () => {
      if (!didSave.current && sessionAttachments.current.length > 0) {
        deleteAttachmentFiles(sessionAttachments.current);
      }
    },
    []
  );

  const form: TaskFormShape = useMemo(
    () => ({
      title,
      description,
      dueDate: dueDate.toISOString(),
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
    }),
    [title, description, dueDate, location]
  );

  const validation = useMemo(() => validateTaskForm(form), [form]);

  /** An error is only shown once the user has left the field, or tried to submit. */
  const errorFor = (field: keyof TaskFormShape): string | undefined =>
    didAttemptSubmit || touched[field] ? validation.errors[field] : undefined;

  const markTouched = (field: keyof TaskFormShape) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const isDirty =
    title !== (existingTask?.title ?? '') ||
    description !== (existingTask?.description ?? '') ||
    dueDate.toISOString() !== (existingTask?.dueDate ?? '') ||
    status !== (existingTask?.status ?? 'New') ||
    location.address !== (existingTask?.location.address ?? '') ||
    attachments.length !== (existingTask?.attachments.length ?? 0);

  /* ------------------------------ attachments ------------------------------ */

  const handlePickResult = useCallback(
    (result: AttachmentPickResult) => {
      switch (result.status) {
        case 'picked':
          sessionAttachments.current = [...sessionAttachments.current, ...result.attachments];
          setAttachments((current) => [...current, ...result.attachments]);
          showSuccess(
            `${result.attachments.length} file${result.attachments.length === 1 ? '' : 's'} attached.`
          );
          return;
        case 'denied':
          showWarning(result.message, 'Permission needed');
          return;
        case 'error':
          showError(result.message, 'Attachment failed');
          return;
        case 'cancelled':
          return;
      }
    },
    [showSuccess, showWarning, showError]
  );

  const addAttachmentFrom = useCallback(
    async (source: AttachmentSource) => {
      setSourceSheetOpen(false);
      const pick =
        source === 'camera'
          ? captureImageWithCamera
          : source === 'library'
            ? pickImagesFromLibrary
            : pickDocuments;
      handlePickResult(await pick());
    },
    [handlePickResult]
  );

  const removeAttachmentFromDraft = useCallback((attachmentId: string) => {
    setAttachments((current) => current.filter((entry) => entry.id !== attachmentId));

    // A file picked in this session was never part of a saved task, so it can go
    // immediately. Files belonging to the stored task are only deleted once the
    // save succeeds — see `handleSave`.
    const sessionFile = sessionAttachments.current.find((entry) => entry.id === attachmentId);
    if (sessionFile) {
      deleteAttachmentFiles([sessionFile]);
      sessionAttachments.current = sessionAttachments.current.filter(
        (entry) => entry.id !== attachmentId
      );
    }
  }, []);

  /* --------------------------------- save ---------------------------------- */

  const handleSave = useCallback(async () => {
    setDidAttemptSubmit(true);

    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      showError(firstError ?? 'Please correct the highlighted fields.', 'Task not saved');
      return;
    }

    const coordinates = validateCoordinates(location.latitude, location.longitude);
    const input: TaskInput = {
      title,
      description,
      dueDate: dueDate.toISOString(),
      status,
      location: {
        address: location.address,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      },
      attachments,
    };

    setIsSaving(true);
    const result = existingTask
      ? await updateTask(existingTask.id, input)
      : await createTask(input);
    setIsSaving(false);

    if (!result.ok) {
      showError(result.message, 'Task not saved');
      return;
    }

    didSave.current = true;

    // Files dropped from an existing task are only deleted once the save landed.
    if (existingTask) {
      const removed = existingTask.attachments.filter(
        (original) => !attachments.some((kept) => kept.id === original.id)
      );
      deleteAttachmentFiles(removed);
    }

    showSuccess(
      result.message ?? 'Saved on this device and queued for sync.',
      isEditing ? 'Task updated' : 'Task created'
    );
    navigation.goBack();
  }, [
    validation,
    location,
    title,
    description,
    dueDate,
    status,
    attachments,
    existingTask,
    updateTask,
    createTask,
    showError,
    showSuccess,
    isEditing,
    navigation,
  ]);

  const handleCancel = useCallback(() => {
    if (isDirty) setDiscardDialogOpen(true);
    else navigation.goBack();
  }, [isDirty, navigation]);

  /* --------------------------------- render -------------------------------- */

  // Editing a task that was deleted from another surface: fail gracefully.
  if (taskId && !existingTask) {
    return (
      <Screen>
        <ScreenHeader title="Task unavailable" onBack={() => navigation.goBack()} />
        <View style={{ padding: theme.spacing.lg }}>
          <Text variant="body" color="textMuted">
            This task no longer exists. It may have been deleted on another screen.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={isEditing ? 'Edit task' : 'New task'}
        subtitle={isEditing ? existingTask?.title : 'All fields marked * are required'}
        onBack={handleCancel}
        showThemeToggle={false}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={12}
      >
        <ScrollView
          contentContainerStyle={{
            padding: theme.layout.screenPadding,
            paddingBottom: insets.bottom + 120,
            gap: theme.spacing.md,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Section title="Task details">
            <Card style={{ gap: theme.spacing.sm }}>
              <TextField
                label="Task title"
                required
                icon="clipboard-outline"
                value={title}
                onChangeText={setTitle}
                onBlur={() => markTouched('title')}
                error={errorFor('title')}
                placeholder="Replace hydraulic hose, unit 12"
                maxLength={VALIDATION_RULES.TITLE_MAX}
                showCounter
                autoCapitalize="sentences"
              />

              <TextField
                label="Description"
                required
                icon="document-text-outline"
                value={description}
                onChangeText={setDescription}
                onBlur={() => markTouched('description')}
                error={errorFor('description')}
                placeholder="What needs doing, parts required, access notes…"
                maxLength={VALIDATION_RULES.DESCRIPTION_MAX}
                showCounter
                multiline
                numberOfLines={5}
                inputStyle={{ minHeight: 108 }}
              />
            </Card>
          </Section>

          <Section title="Schedule">
            <Card style={{ gap: theme.spacing.sm }}>
              <DueDateField value={dueDate} onChange={setDueDate} error={errorFor('dueDate')} />

              <View style={{ gap: theme.spacing.xxs }}>
                <Text variant="caption" color="textMuted">
                  Status
                </Text>
                <Button
                  label={`Status: ${status}`}
                  icon="flag-outline"
                  variant="secondary"
                  fullWidth
                  onPress={() => setStatusSheetOpen(true)}
                  accessibilityHint="Opens the status picker"
                />
                <View style={{ marginTop: 2 }}>
                  <StatusBadge status={status} />
                </View>
              </View>
            </Card>
          </Section>

          <Section title="Location">
            <Card>
              <LocationFields
                value={location}
                errors={{
                  address: errorFor('address'),
                  latitude: errorFor('latitude'),
                  longitude: errorFor('longitude'),
                }}
                onChange={(patch) => {
                  setLocation((current) => ({ ...current, ...patch }));
                  Object.keys(patch).forEach((key) => markTouched(key as keyof TaskFormShape));
                }}
              />
            </Card>
          </Section>

          <Section title={`Attachments (${attachments.length})`}>
            <Card style={{ gap: theme.spacing.sm }}>
              <AttachmentGallery
                attachments={attachments}
                onRemove={removeAttachmentFromDraft}
                emptyHint="Attach a photo of the site or a PDF work order. Optional, but it helps the next technician."
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
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.xs,
            padding: theme.layout.screenPadding,
            paddingBottom: insets.bottom + theme.spacing.xs,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.background,
          }}
        >
          <Button
            label="Cancel"
            variant="secondary"
            onPress={handleCancel}
            style={{ flex: 1 }}
            disabled={isSaving}
          />
          <Button
            label={isEditing ? 'Save changes' : 'Create task'}
            icon="checkmark"
            onPress={handleSave}
            loading={isSaving}
            style={{ flex: 2 }}
            accessibilityHint="Validates and saves the task on this device"
          />
        </View>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={isSourceSheetOpen}
        title="Add an attachment"
        subtitle="Files are copied into the app so they survive a restart"
        options={ATTACHMENT_OPTIONS}
        onSelect={(source) => void addAttachmentFrom(source)}
        onClose={() => setSourceSheetOpen(false)}
      />

      <OptionSheet
        visible={isStatusSheetOpen}
        title="Task status"
        options={STATUS_OPTIONS}
        selectedValue={status}
        onSelect={(next) => {
          setStatus(next);
          setStatusSheetOpen(false);
          if (next === 'Completed' || next === 'Cancelled') {
            showInfo('Closing a task cancels its reminder when you save.');
          }
        }}
        onClose={() => setStatusSheetOpen(false)}
      />

      <ConfirmDialog
        visible={isDiscardDialogOpen}
        title="Discard changes?"
        message="Your edits and any files you attached in this session will be discarded."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        icon="trash-outline"
        onCancel={() => setDiscardDialogOpen(false)}
        onConfirm={() => {
          setDiscardDialogOpen(false);
          navigation.goBack();
        }}
      />
    </Screen>
  );
};
