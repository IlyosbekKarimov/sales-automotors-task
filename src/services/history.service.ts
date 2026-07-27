import type { HistoryAction, HistoryLog, Task, TaskAttachment } from '@/types';
import { formatDateTime } from '@/utils/date.utils';
import { createHistoryId } from '@/utils/id.utils';
import { truncate } from '@/utils/format.utils';

/**
 * Builds the audit-trail entries shown on the History screen.
 *
 * These are pure factories: they take the before/after state and return a log
 * record. Persistence is the caller's job (`TaskContext` writes tasks and logs in
 * the same commit), which keeps the log honest — an entry can never be written
 * for a change that failed to save.
 */

/** Newest first, and never let the log grow without bound on a long-lived device. */
export const MAX_HISTORY_ENTRIES = 500;

interface LogParams {
  taskId: string;
  taskTitle: string;
  action: HistoryAction;
  description: string;
}

const buildLog = ({ taskId, taskTitle, action, description }: LogParams): HistoryLog => ({
  id: createHistoryId(),
  taskId,
  taskTitle,
  action,
  description,
  timestamp: new Date().toISOString(),
  synced: false,
});

/** Prepends new entries and trims the tail. */
export const appendLogs = (existing: HistoryLog[], additions: HistoryLog[]): HistoryLog[] =>
  [...additions, ...existing].slice(0, MAX_HISTORY_ENTRIES);

export const logTaskCreated = (task: Task): HistoryLog =>
  buildLog({
    taskId: task.id,
    taskTitle: task.title,
    action: 'CREATED',
    description: `Created with status "${task.status}", due ${formatDateTime(task.dueDate)}.`,
  });

export const logStatusChanged = (task: Task, previousStatus: Task['status']): HistoryLog =>
  buildLog({
    taskId: task.id,
    taskTitle: task.title,
    action: 'STATUS_CHANGED',
    description: `Status changed from "${previousStatus}" to "${task.status}".`,
  });

export const logTaskDeleted = (task: Task): HistoryLog =>
  buildLog({
    taskId: task.id,
    taskTitle: task.title,
    action: 'DELETED',
    description: `Task deleted (was "${task.status}", ${task.attachments.length} attachment${
      task.attachments.length === 1 ? '' : 's'
    }).`,
  });

export const logAttachmentAdded = (task: Task, attachment: TaskAttachment): HistoryLog =>
  buildLog({
    taskId: task.id,
    taskTitle: task.title,
    action: 'ATTACHMENT_ADDED',
    description: `Attached ${attachment.kind} "${truncate(attachment.name, 40)}".`,
  });

export const logAttachmentRemoved = (task: Task, attachment: TaskAttachment): HistoryLog =>
  buildLog({
    taskId: task.id,
    taskTitle: task.title,
    action: 'ATTACHMENT_REMOVED',
    description: `Removed attachment "${truncate(attachment.name, 40)}".`,
  });

export const logReminderScheduled = (task: Task, description: string): HistoryLog =>
  buildLog({
    taskId: task.id,
    taskTitle: task.title,
    action: 'REMINDER_SCHEDULED',
    description,
  });

export const logSyncEvent = (
  action: Extract<HistoryAction, 'SYNCED' | 'SYNC_FAILED'>,
  description: string
): HistoryLog =>
  buildLog({
    // Sync is an app-level event, not a task-level one; the empty id keeps it out
    // of per-task history while still showing on the global History screen.
    taskId: '',
    taskTitle: 'Synchronisation',
    action,
    description,
  });

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'description',
  dueDate: 'due date',
  address: 'location',
  coordinates: 'coordinates',
  attachments: 'attachments',
};

/** Lists which fields actually changed, so the log says something useful. */
export const diffTaskFields = (previous: Task, next: Task): string[] => {
  const changed: string[] = [];

  if (previous.title !== next.title) changed.push(FIELD_LABELS.title!);
  if (previous.description !== next.description) changed.push(FIELD_LABELS.description!);
  if (previous.dueDate !== next.dueDate) changed.push(FIELD_LABELS.dueDate!);
  if (previous.location.address !== next.location.address) changed.push(FIELD_LABELS.address!);
  if (
    previous.location.latitude !== next.location.latitude ||
    previous.location.longitude !== next.location.longitude
  ) {
    changed.push(FIELD_LABELS.coordinates!);
  }
  if (previous.attachments.length !== next.attachments.length) {
    changed.push(FIELD_LABELS.attachments!);
  }

  return changed;
};

const joinWithAnd = (items: string[]): string => {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

/**
 * Produces the UPDATED entry, or `null` when an edit changed nothing meaningful —
 * a log full of "Task edited: nothing" entries is worse than no log.
 */
export const logTaskUpdated = (previous: Task, next: Task): HistoryLog | null => {
  const changed = diffTaskFields(previous, next);
  if (changed.length === 0) return null;

  return buildLog({
    taskId: next.id,
    taskTitle: next.title,
    action: 'UPDATED',
    description: `Updated ${joinWithAnd(changed)}.`,
  });
};
