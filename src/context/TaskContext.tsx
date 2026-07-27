import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type { PropsWithChildren } from 'react';

import { useSettings } from '@/context/SettingsContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { deleteAttachmentFiles, deleteAttachmentFile } from '@/services/attachment.service';
import {
  appendLogs,
  logAttachmentAdded,
  logAttachmentRemoved,
  logStatusChanged,
  logTaskCreated,
  logTaskDeleted,
  logTaskUpdated,
  logReminderScheduled,
} from '@/services/history.service';
import { cancelReminder, scheduleTaskReminder } from '@/services/notification.service';
import { DEFAULT_SYNC_STATE, StorageService } from '@/services/storage.service';
import { SyncService } from '@/services/sync.service';
import type {
  HistoryLog,
  IdMap,
  SyncState,
  Task,
  TaskAttachment,
  TaskInput,
  TaskStatus,
} from '@/types';
import { createTaskId } from '@/utils/id.utils';
import { summariseSync } from '@/utils/sync.utils';

/**
 * The application's single writer.
 *
 * Every mutation follows the same shape: build the next arrays, persist them,
 * then commit to state. Persisting *before* committing means the UI can never
 * show a task that failed to save — the operation returns `{ ok: false }` and
 * the screen surfaces the reason. That ordering is what makes the offline story
 * trustworthy: the device is the source of truth, and the server catches up later.
 *
 * Services do the work (storage, notifications, sync); this context only
 * sequences them and owns the resulting state.
 */

export type OperationResult<TData> =
  { ok: true; data: TData; message?: string } | { ok: false; message: string };

interface TaskState {
  tasks: Task[];
  historyLogs: HistoryLog[];
  /** Local ids removed on this device, awaiting a DELETE against the mock server. */
  deletionQueue: string[];
  /** Local id → server id, maintained by the sync layer. */
  idMap: IdMap;
  sync: SyncState;
  isHydrating: boolean;
  hydrationError: string | null;
}

type CommittablePatch = Partial<
  Pick<TaskState, 'tasks' | 'historyLogs' | 'deletionQueue' | 'sync' | 'idMap'>
>;

type TaskAction =
  | { type: 'hydrated'; payload: Omit<TaskState, 'isHydrating' | 'hydrationError'> }
  | { type: 'hydration-failed'; message: string }
  | { type: 'commit'; payload: CommittablePatch };

const initialState: TaskState = {
  tasks: [],
  historyLogs: [],
  deletionQueue: [],
  idMap: {},
  sync: DEFAULT_SYNC_STATE,
  isHydrating: true,
  hydrationError: null,
};

const taskReducer = (state: TaskState, action: TaskAction): TaskState => {
  switch (action.type) {
    case 'hydrated':
      return { ...state, ...action.payload, isHydrating: false, hydrationError: null };
    case 'hydration-failed':
      return { ...state, isHydrating: false, hydrationError: action.message };
    case 'commit':
      return { ...state, ...action.payload };
  }
};

interface TaskContextValue {
  tasks: Task[];
  historyLogs: HistoryLog[];
  isHydrating: boolean;
  hydrationError: string | null;
  sync: SyncState;
  isOnline: boolean;
  connectionType: string;
  pendingSyncCount: number;

  getTaskById: (taskId: string) => Task | undefined;
  createTask: (input: TaskInput) => Promise<OperationResult<Task>>;
  updateTask: (taskId: string, input: TaskInput) => Promise<OperationResult<Task>>;
  changeTaskStatus: (taskId: string, status: TaskStatus) => Promise<OperationResult<Task>>;
  deleteTask: (taskId: string) => Promise<OperationResult<void>>;
  addAttachments: (taskId: string, attachments: TaskAttachment[]) => Promise<OperationResult<Task>>;
  removeAttachment: (taskId: string, attachmentId: string) => Promise<OperationResult<Task>>;
  rescheduleReminder: (taskId: string) => Promise<OperationResult<Task>>;
  /** Resolves with a user-facing summary; callers decide whether to surface it. */
  runSync: () => Promise<OperationResult<string>>;
  clearAllData: () => Promise<OperationResult<void>>;
}

const TaskContext = createContext<TaskContextValue | null>(null);

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export const TaskProvider = ({ children }: PropsWithChildren) => {
  const [state, dispatch] = useReducer(taskReducer, initialState);
  const { settings, apiBaseUrl } = useSettings();
  const { isOnline, connectionType, justCameOnline } = useNetworkStatus();

  /** Guards against two sync runs interleaving and double-pushing the same task. */
  const isSyncing = useRef(false);
  /** Latest state for callbacks that must not re-create on every keystroke. */
  const stateRef = useRef(state);
  stateRef.current = state;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /* ------------------------------- hydration ------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const [tasks, historyLogs, deletionQueue, sync, idMap] = await Promise.all([
          StorageService.getTasks(),
          StorageService.getHistoryLogs(),
          StorageService.getDeletionQueue(),
          StorageService.getSyncState(),
          StorageService.getIdMap(),
        ]);
        if (!cancelled) {
          dispatch({
            type: 'hydrated',
            payload: { tasks, historyLogs, deletionQueue, sync, idMap },
          });
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({
            type: 'hydration-failed',
            message: errorMessage(error, 'Saved tasks could not be loaded.'),
          });
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------- persistence ----------------------------- */

  /**
   * Writes the parts that changed, then commits. Any storage failure aborts the
   * commit so state and disk cannot disagree.
   */
  const persistAndCommit = useCallback(async (patch: CommittablePatch): Promise<void> => {
    const writes: Promise<void>[] = [];
    if (patch.tasks) writes.push(StorageService.saveTasks(patch.tasks));
    if (patch.historyLogs) writes.push(StorageService.saveHistoryLogs(patch.historyLogs));
    if (patch.deletionQueue) writes.push(StorageService.saveDeletionQueue(patch.deletionQueue));
    if (patch.sync) writes.push(StorageService.saveSyncState(patch.sync));
    if (patch.idMap) writes.push(StorageService.saveIdMap(patch.idMap));

    await Promise.all(writes);
    dispatch({ type: 'commit', payload: patch });
  }, []);

  /* --------------------------------- writes -------------------------------- */

  const createTask = useCallback(
    async (input: TaskInput): Promise<OperationResult<Task>> => {
      const now = new Date().toISOString();
      const task: Task = {
        id: createTaskId(),
        ...input,
        title: input.title.trim(),
        description: input.description.trim(),
        location: { ...input.location, address: input.location.address.trim() },
        syncStatus: 'Pending Sync',
        notificationId: null,
        createdAt: now,
        updatedAt: now,
      };

      const reminder = await scheduleTaskReminder(task, settingsRef.current);
      const saved: Task = {
        ...task,
        notificationId: reminder.status === 'scheduled' ? reminder.notificationId : null,
      };

      const logs: HistoryLog[] = [logTaskCreated(saved)];
      if (reminder.status === 'scheduled') logs.push(logReminderScheduled(saved, reminder.message));

      try {
        await persistAndCommit({
          tasks: [...stateRef.current.tasks, saved],
          historyLogs: appendLogs(stateRef.current.historyLogs, logs),
        });
        return { ok: true, data: saved, message: reminder.message };
      } catch (error) {
        // Roll the reminder back so an unsaved task cannot fire a notification.
        await cancelReminder(saved.notificationId);
        return { ok: false, message: errorMessage(error, 'The task could not be saved.') };
      }
    },
    [persistAndCommit]
  );

  const updateTask = useCallback(
    async (taskId: string, input: TaskInput): Promise<OperationResult<Task>> => {
      const previous = stateRef.current.tasks.find((task) => task.id === taskId);
      if (!previous) return { ok: false, message: 'That task no longer exists.' };

      const draft: Task = {
        ...previous,
        ...input,
        title: input.title.trim(),
        description: input.description.trim(),
        location: { ...input.location, address: input.location.address.trim() },
        syncStatus: 'Pending Sync',
        updatedAt: new Date().toISOString(),
      };

      // Only touch the OS scheduler when the trigger time actually moved.
      const dueDateChanged = previous.dueDate !== draft.dueDate;
      const reminder = dueDateChanged
        ? await scheduleTaskReminder(draft, settingsRef.current)
        : null;

      const next: Task = reminder
        ? {
            ...draft,
            notificationId: reminder.status === 'scheduled' ? reminder.notificationId : null,
          }
        : draft;

      const logs: HistoryLog[] = [];
      const updateLog = logTaskUpdated(previous, next);
      if (updateLog) logs.push(updateLog);
      if (previous.status !== next.status) logs.push(logStatusChanged(next, previous.status));
      if (reminder?.status === 'scheduled') logs.push(logReminderScheduled(next, reminder.message));

      try {
        await persistAndCommit({
          tasks: stateRef.current.tasks.map((task) => (task.id === taskId ? next : task)),
          historyLogs: appendLogs(stateRef.current.historyLogs, logs),
        });
        return { ok: true, data: next, message: reminder?.message };
      } catch (error) {
        return { ok: false, message: errorMessage(error, 'The changes could not be saved.') };
      }
    },
    [persistAndCommit]
  );

  const changeTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus): Promise<OperationResult<Task>> => {
      const previous = stateRef.current.tasks.find((task) => task.id === taskId);
      if (!previous) return { ok: false, message: 'That task no longer exists.' };
      if (previous.status === status) return { ok: true, data: previous };

      const next: Task = {
        ...previous,
        status,
        syncStatus: 'Pending Sync',
        updatedAt: new Date().toISOString(),
      };

      // A closed task should not keep nagging the technician.
      const isClosing = status === 'Completed' || status === 'Cancelled';
      if (isClosing && previous.notificationId) {
        await cancelReminder(previous.notificationId);
        next.notificationId = null;
      }

      try {
        await persistAndCommit({
          tasks: stateRef.current.tasks.map((task) => (task.id === taskId ? next : task)),
          historyLogs: appendLogs(stateRef.current.historyLogs, [
            logStatusChanged(next, previous.status),
          ]),
        });
        return { ok: true, data: next };
      } catch (error) {
        return { ok: false, message: errorMessage(error, 'The status change could not be saved.') };
      }
    },
    [persistAndCommit]
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<OperationResult<void>> => {
      const task = stateRef.current.tasks.find((entry) => entry.id === taskId);
      if (!task) return { ok: false, message: 'That task no longer exists.' };

      try {
        await persistAndCommit({
          tasks: stateRef.current.tasks.filter((entry) => entry.id !== taskId),
          historyLogs: appendLogs(stateRef.current.historyLogs, [logTaskDeleted(task)]),
          // Queued rather than sent: deletion must work with no connection at all.
          deletionQueue: [...new Set([...stateRef.current.deletionQueue, taskId])],
        });
      } catch (error) {
        return { ok: false, message: errorMessage(error, 'The task could not be deleted.') };
      }

      // Side effects only after the delete is durably recorded.
      await cancelReminder(task.notificationId);
      deleteAttachmentFiles(task.attachments);

      return { ok: true, data: undefined };
    },
    [persistAndCommit]
  );

  const addAttachments = useCallback(
    async (taskId: string, attachments: TaskAttachment[]): Promise<OperationResult<Task>> => {
      const previous = stateRef.current.tasks.find((task) => task.id === taskId);
      if (!previous) return { ok: false, message: 'That task no longer exists.' };
      if (attachments.length === 0) return { ok: true, data: previous };

      const next: Task = {
        ...previous,
        attachments: [...previous.attachments, ...attachments],
        syncStatus: 'Pending Sync',
        updatedAt: new Date().toISOString(),
      };

      try {
        await persistAndCommit({
          tasks: stateRef.current.tasks.map((task) => (task.id === taskId ? next : task)),
          historyLogs: appendLogs(
            stateRef.current.historyLogs,
            attachments.map((attachment) => logAttachmentAdded(next, attachment))
          ),
        });
        return { ok: true, data: next };
      } catch (error) {
        // The files are already on disk; drop them so nothing is orphaned.
        deleteAttachmentFiles(attachments);
        return { ok: false, message: errorMessage(error, 'The attachment could not be saved.') };
      }
    },
    [persistAndCommit]
  );

  const removeAttachment = useCallback(
    async (taskId: string, attachmentId: string): Promise<OperationResult<Task>> => {
      const previous = stateRef.current.tasks.find((task) => task.id === taskId);
      if (!previous) return { ok: false, message: 'That task no longer exists.' };

      const attachment = previous.attachments.find((entry) => entry.id === attachmentId);
      if (!attachment) return { ok: true, data: previous };

      const next: Task = {
        ...previous,
        attachments: previous.attachments.filter((entry) => entry.id !== attachmentId),
        syncStatus: 'Pending Sync',
        updatedAt: new Date().toISOString(),
      };

      try {
        await persistAndCommit({
          tasks: stateRef.current.tasks.map((task) => (task.id === taskId ? next : task)),
          historyLogs: appendLogs(stateRef.current.historyLogs, [
            logAttachmentRemoved(next, attachment),
          ]),
        });
      } catch (error) {
        return { ok: false, message: errorMessage(error, 'The attachment could not be removed.') };
      }

      deleteAttachmentFile(attachment);
      return { ok: true, data: next };
    },
    [persistAndCommit]
  );

  /** Re-applies the reminder rules — used after toggling demo mode or reminders. */
  const rescheduleReminder = useCallback(
    async (taskId: string): Promise<OperationResult<Task>> => {
      const previous = stateRef.current.tasks.find((task) => task.id === taskId);
      if (!previous) return { ok: false, message: 'That task no longer exists.' };

      const reminder = await scheduleTaskReminder(previous, settingsRef.current);
      const next: Task = {
        ...previous,
        notificationId: reminder.status === 'scheduled' ? reminder.notificationId : null,
      };

      try {
        await persistAndCommit({
          tasks: stateRef.current.tasks.map((task) => (task.id === taskId ? next : task)),
          historyLogs:
            reminder.status === 'scheduled'
              ? appendLogs(stateRef.current.historyLogs, [
                  logReminderScheduled(next, reminder.message),
                ])
              : stateRef.current.historyLogs,
        });
        return { ok: true, data: next, message: reminder.message };
      } catch (error) {
        return { ok: false, message: errorMessage(error, 'The reminder could not be updated.') };
      }
    },
    [persistAndCommit]
  );

  /* --------------------------------- sync ---------------------------------- */

  const runSync = useCallback(async (): Promise<OperationResult<string>> => {
    if (isSyncing.current) {
      return { ok: false, message: 'A sync is already running.' };
    }

    const current = stateRef.current;
    const nothingToDo =
      current.tasks.every((task) => task.syncStatus === 'Synced') &&
      current.deletionQueue.length === 0;

    isSyncing.current = true;
    dispatch({ type: 'commit', payload: { sync: { ...current.sync, phase: 'syncing' } } });

    try {
      const result = await SyncService.synchronise({
        baseUrl: apiBaseUrl,
        tasks: current.tasks,
        historyLogs: current.historyLogs,
        deletionQueue: current.deletionQueue,
        idMap: current.idMap,
      });

      const succeeded = result.outcome.error === null && result.outcome.failed === 0;
      const nextSync: SyncState = {
        phase: succeeded ? 'success' : 'error',
        lastOutcome: result.outcome,
        lastSyncedAt: succeeded ? result.outcome.finishedAt : current.sync.lastSyncedAt,
      };

      await persistAndCommit({
        tasks: result.tasks,
        historyLogs: appendLogs(result.historyLogs, result.newLogs),
        deletionQueue: result.deletionQueue,
        idMap: result.idMap,
        sync: nextSync,
      });

      const message =
        result.outcome.error ??
        (nothingToDo && result.outcome.pulled === 0
          ? 'Already up to date.'
          : summariseSync(result.outcome));

      return succeeded ? { ok: true, data: message } : { ok: false, message };
    } catch (error) {
      const message = errorMessage(error, 'Sync failed.');
      dispatch({
        type: 'commit',
        payload: { sync: { ...stateRef.current.sync, phase: 'error' } },
      });
      return { ok: false, message };
    } finally {
      isSyncing.current = false;
    }
  }, [apiBaseUrl, persistAndCommit]);

  /**
   * Auto-sync on reconnect. Deliberately only fires on the offline → online
   * transition and only when something is actually pending, so a flaky
   * connection does not hammer the server.
   */
  useEffect(() => {
    if (!justCameOnline || !settings.autoSyncEnabled || state.isHydrating) return;

    const hasPending =
      state.deletionQueue.length > 0 || state.tasks.some((task) => task.syncStatus !== 'Synced');
    if (!hasPending) return;

    void runSync();
  }, [
    justCameOnline,
    settings.autoSyncEnabled,
    state.isHydrating,
    state.deletionQueue.length,
    state.tasks,
    runSync,
  ]);

  /* --------------------------------- reset --------------------------------- */

  const clearAllData = useCallback(async (): Promise<OperationResult<void>> => {
    try {
      await Promise.all(stateRef.current.tasks.map((task) => cancelReminder(task.notificationId)));
      stateRef.current.tasks.forEach((task) => deleteAttachmentFiles(task.attachments));
      await StorageService.clearAll();
      dispatch({
        type: 'commit',
        payload: {
          tasks: [],
          historyLogs: [],
          deletionQueue: [],
          idMap: {},
          sync: DEFAULT_SYNC_STATE,
        },
      });
      return { ok: true, data: undefined };
    } catch (error) {
      return { ok: false, message: errorMessage(error, 'Local data could not be cleared.') };
    }
  }, []);

  /* --------------------------------- value --------------------------------- */

  const getTaskById = useCallback(
    (taskId: string) => stateRef.current.tasks.find((task) => task.id === taskId),
    []
  );

  const pendingSyncCount = useMemo(
    () =>
      state.tasks.filter((task) => task.syncStatus !== 'Synced').length +
      state.deletionQueue.length,
    [state.tasks, state.deletionQueue]
  );

  const value = useMemo<TaskContextValue>(
    () => ({
      tasks: state.tasks,
      historyLogs: state.historyLogs,
      isHydrating: state.isHydrating,
      hydrationError: state.hydrationError,
      sync: state.sync,
      isOnline,
      connectionType,
      pendingSyncCount,
      getTaskById,
      createTask,
      updateTask,
      changeTaskStatus,
      deleteTask,
      addAttachments,
      removeAttachment,
      rescheduleReminder,
      runSync,
      clearAllData,
    }),
    [
      state.tasks,
      state.historyLogs,
      state.isHydrating,
      state.hydrationError,
      state.sync,
      isOnline,
      connectionType,
      pendingSyncCount,
      getTaskById,
      createTask,
      updateTask,
      changeTaskStatus,
      deleteTask,
      addAttachments,
      removeAttachment,
      rescheduleReminder,
      runSync,
      clearAllData,
    ]
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};

export const useTasks = (): TaskContextValue => {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be used inside <TaskProvider>.');
  return context;
};
