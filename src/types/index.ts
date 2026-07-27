/**
 * Single source of truth for the application domain model.
 *
 * Everything persisted to AsyncStorage or exchanged with the mock REST server is
 * described here, so a change to the shape of a task is a compile error in every
 * layer that touches it rather than a silent runtime bug.
 */

export const TASK_STATUSES = ['New', 'In Progress', 'Completed', 'Cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SYNC_STATUSES = ['Pending Sync', 'Synced', 'Sync Failed'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export type AttachmentKind = 'image' | 'pdf' | 'file';

export interface TaskLocation {
  /** Free-text address typed by the technician. Always required. */
  address: string;
  /** Optional coordinates. Both are set together or both are null. */
  latitude: number | null;
  longitude: number | null;
}

export interface TaskAttachment {
  id: string;
  /**
   * `file://` URI inside the app's document directory. Pickers hand back cache
   * URIs which the OS may evict, so files are copied somewhere durable before
   * this record is created — see `attachment.service.ts`.
   */
  uri: string;
  name: string;
  kind: AttachmentKind;
  mimeType: string | null;
  size: number | null;
  addedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  /** ISO-8601 date-time the job is due to be executed. */
  dueDate: string;
  location: TaskLocation;
  attachments: TaskAttachment[];
  status: TaskStatus;
  syncStatus: SyncStatus;
  /** Identifier of the scheduled local reminder, so it can be cancelled or replaced. */
  notificationId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The subset of a task the user actually fills in on the form. */
export interface TaskInput {
  title: string;
  description: string;
  dueDate: string;
  location: TaskLocation;
  attachments: TaskAttachment[];
  status: TaskStatus;
}

export const HISTORY_ACTIONS = [
  'CREATED',
  'UPDATED',
  'STATUS_CHANGED',
  'ATTACHMENT_ADDED',
  'ATTACHMENT_REMOVED',
  'DELETED',
  'SYNCED',
  'SYNC_FAILED',
  'REMINDER_SCHEDULED',
] as const;
export type HistoryAction = (typeof HISTORY_ACTIONS)[number];

export interface HistoryLog {
  id: string;
  /** Kept after the task is deleted so the log stays readable. */
  taskId: string;
  taskTitle: string;
  action: HistoryAction;
  description: string;
  timestamp: string;
  /** Whether this entry has been mirrored to the mock server's `history` collection. */
  synced: boolean;
}

export type TaskSortKey = 'createdAt' | 'dueDate' | 'status';
export type SortDirection = 'asc' | 'desc';

export const DUE_RANGE_PRESETS = ['any', 'overdue', 'today', 'next7', 'next30', 'custom'] as const;
export type DueRangePreset = (typeof DUE_RANGE_PRESETS)[number];

export interface DueRange {
  preset: DueRangePreset;
  /** ISO dates; only read when `preset` is `custom`. */
  from: string | null;
  to: string | null;
}

export interface TaskListFilters {
  query: string;
  /** Empty array means "no status filter applied". */
  statuses: TaskStatus[];
  dueRange: DueRange;
  sortKey: TaskSortKey;
  sortDirection: SortDirection;
}

export type SyncPhase = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncOutcome {
  pushed: number;
  pulled: number;
  deleted: number;
  failed: number;
  finishedAt: string;
  error: string | null;
}

export interface SyncState {
  phase: SyncPhase;
  lastOutcome: SyncOutcome | null;
  lastSyncedAt: string | null;
}

/**
 * `localId → remoteId`.
 *
 * Tasks are created offline so the device mints their ids, but json-server
 * assigns its own on `POST`. This mapping is what keeps local ids stable for
 * their whole life instead of being rewritten by a sync — see `utils/sync.utils.ts`.
 */
export type IdMap = Record<string, string>;

export type ThemePreference = 'light' | 'dark' | 'system';

export interface AppSettings {
  themePreference: ThemePreference;
  /** Master switch for the 30-minutes-before local reminder. */
  remindersEnabled: boolean;
  /**
   * Demo mode for the review video: reminders fire N seconds after saving
   * instead of 30 minutes before the due date.
   */
  demoRemindersEnabled: boolean;
  /** Push local changes automatically as soon as connectivity returns. */
  autoSyncEnabled: boolean;
  /** Runtime override for the mock server URL, editable from Settings. */
  apiBaseUrl: string | null;
}

/** Field-keyed validation messages produced by `utils/validation.ts`. */
export type ValidationErrors<TShape> = Partial<Record<keyof TShape, string>>;

export interface ValidationResult<TShape> {
  isValid: boolean;
  errors: ValidationErrors<TShape>;
}
