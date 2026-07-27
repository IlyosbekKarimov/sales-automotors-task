/** Every AsyncStorage key the app owns, namespaced so a `clearAll` can never overreach. */
export const STORAGE_KEYS = {
  TASKS: '@fieldtasks/tasks',
  HISTORY: '@fieldtasks/history',
  SETTINGS: '@fieldtasks/settings',
  /** Ids of tasks deleted while offline, replayed as DELETE requests on next sync. */
  DELETION_QUEUE: '@fieldtasks/deletion-queue',
  SYNC_STATE: '@fieldtasks/sync-state',
  /** localId → server id, because json-server mints its own — see `sync.utils.ts`. */
  ID_MAP: '@fieldtasks/id-map',
} as const;
