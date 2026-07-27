import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/constants/storage-keys';
import type { AppSettings, HistoryLog, IdMap, SyncState, Task } from '@/types';
import { logger } from '@/utils/logger';

/**
 * The single place the app talks to AsyncStorage.
 *
 * Two things make this more than a thin wrapper:
 *
 * 1. **Reads never throw.** A corrupt or half-written JSON blob returns the
 *    fallback instead of crashing the app on launch, which is the difference
 *    between "one task lost" and "the app is bricked until reinstall".
 * 2. **Reads are normalised.** Records that came from an older build are coerced
 *    into the current shape, so adding a field to `Task` does not strand data
 *    already on the device.
 *
 * Writes *do* surface failures — a silent save failure is a data-loss bug the
 * user must be told about, so callers can show an error toast.
 */

export class StorageError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn(`[storage] Unreadable value at "${key}", falling back to default.`, error);
    return fallback;
  }
};

const writeJson = async <T>(key: string, value: T): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    throw new StorageError(`Could not save data (${key}).`, error);
  }
};

const TASK_STATUS_VALUES: readonly Task['status'][] = [
  'New',
  'In Progress',
  'Completed',
  'Cancelled',
];
const SYNC_STATUS_VALUES: readonly Task['syncStatus'][] = ['Pending Sync', 'Synced', 'Sync Failed'];
const ATTACHMENT_KIND_VALUES = ['image', 'pdf', 'file'] as const;

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asNumberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

const normaliseAttachment = (raw: unknown, now: string): Task['attachments'] => {
  if (typeof raw !== 'object' || raw === null) return [];
  const record = raw as Record<string, unknown>;
  const id = asString(record.id);
  const uri = asString(record.uri);
  if (!id || !uri) return [];

  return [
    {
      id,
      uri,
      name: asString(record.name, 'Attachment'),
      kind: oneOf(record.kind, ATTACHMENT_KIND_VALUES, 'file'),
      mimeType: typeof record.mimeType === 'string' ? record.mimeType : null,
      size: asNumberOrNull(record.size),
      addedAt: asString(record.addedAt, now),
    },
  ];
};

const normaliseTask = (raw: unknown): Task | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const id = asString(record.id);
  if (!id) return null;

  const location = (record.location ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();

  return {
    id,
    title: asString(record.title, 'Untitled task'),
    description: asString(record.description),
    dueDate: asString(record.dueDate, now),
    location: {
      address: asString(location.address),
      latitude: asNumberOrNull(location.latitude),
      longitude: asNumberOrNull(location.longitude),
    },
    attachments: asArray(record.attachments).flatMap((entry) => normaliseAttachment(entry, now)),
    status: oneOf(record.status, TASK_STATUS_VALUES, 'New'),
    // Anything whose sync state we cannot trust is treated as still needing a push.
    syncStatus: oneOf(record.syncStatus, SYNC_STATUS_VALUES, 'Pending Sync'),
    notificationId: typeof record.notificationId === 'string' ? record.notificationId : null,
    createdAt: asString(record.createdAt, now),
    updatedAt: asString(record.updatedAt, now),
  };
};

const normaliseHistoryLog = (raw: unknown): HistoryLog | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const id = asString(record.id);
  if (!id) return null;

  return {
    id,
    taskId: asString(record.taskId),
    taskTitle: asString(record.taskTitle, 'Unknown task'),
    action: asString(record.action, 'UPDATED') as HistoryLog['action'],
    description: asString(record.description),
    timestamp: asString(record.timestamp, new Date().toISOString()),
    synced: record.synced === true,
  };
};

export const DEFAULT_SETTINGS: AppSettings = {
  themePreference: 'system',
  remindersEnabled: true,
  demoRemindersEnabled: false,
  autoSyncEnabled: true,
  apiBaseUrl: null,
};

export const DEFAULT_SYNC_STATE: SyncState = {
  phase: 'idle',
  lastOutcome: null,
  lastSyncedAt: null,
};

export const StorageService = {
  async getTasks(): Promise<Task[]> {
    const raw = await readJson<unknown>(STORAGE_KEYS.TASKS, []);
    return asArray(raw).flatMap((entry) => {
      const task = normaliseTask(entry);
      return task ? [task] : [];
    });
  },

  saveTasks(tasks: Task[]): Promise<void> {
    return writeJson(STORAGE_KEYS.TASKS, tasks);
  },

  async getHistoryLogs(): Promise<HistoryLog[]> {
    const raw = await readJson<unknown>(STORAGE_KEYS.HISTORY, []);
    return asArray(raw).flatMap((entry) => {
      const log = normaliseHistoryLog(entry);
      return log ? [log] : [];
    });
  },

  saveHistoryLogs(logs: HistoryLog[]): Promise<void> {
    return writeJson(STORAGE_KEYS.HISTORY, logs);
  },

  async getSettings(): Promise<AppSettings> {
    const stored = await readJson<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
    // Spread over defaults so a settings field added later is populated, not undefined.
    return { ...DEFAULT_SETTINGS, ...stored };
  },

  saveSettings(settings: AppSettings): Promise<void> {
    return writeJson(STORAGE_KEYS.SETTINGS, settings);
  },

  async getDeletionQueue(): Promise<string[]> {
    const raw = await readJson<unknown>(STORAGE_KEYS.DELETION_QUEUE, []);
    return asArray(raw).filter((entry): entry is string => typeof entry === 'string');
  },

  saveDeletionQueue(taskIds: string[]): Promise<void> {
    return writeJson(STORAGE_KEYS.DELETION_QUEUE, taskIds);
  },

  async getSyncState(): Promise<SyncState> {
    const stored = await readJson<Partial<SyncState>>(STORAGE_KEYS.SYNC_STATE, {});
    return {
      ...DEFAULT_SYNC_STATE,
      ...stored,
      // A sync interrupted by the app closing must not look like it is still running.
      phase: stored.phase === 'syncing' ? 'idle' : (stored.phase ?? 'idle'),
    };
  },

  saveSyncState(state: SyncState): Promise<void> {
    return writeJson(STORAGE_KEYS.SYNC_STATE, state);
  },

  async getIdMap(): Promise<IdMap> {
    const raw = await readJson<unknown>(STORAGE_KEYS.ID_MAP, {});
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    );
  },

  saveIdMap(idMap: IdMap): Promise<void> {
    return writeJson(STORAGE_KEYS.ID_MAP, idMap);
  },

  /** Wipes app data only — other AsyncStorage consumers are untouched. */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeMany([...Object.values(STORAGE_KEYS)]);
    } catch (error) {
      throw new StorageError('Could not clear local data.', error);
    }
  },
};
