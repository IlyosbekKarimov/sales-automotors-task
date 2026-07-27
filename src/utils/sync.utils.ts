import type { IdMap, Task } from '@/types';

/**
 * Pure identity and conflict-resolution logic, kept out of `sync.service.ts` so
 * it is testable without a server.
 *
 * **Ids are mapped, not shared.** Tasks are created offline so the device mints
 * their ids, but json-server overwrites `id` on `POST`. Rewriting the local id to
 * match would invalidate history entries, notification payloads and any open
 * screen, so a persisted `IdMap` holds the pairing instead. The local id also
 * travels as `clientId`, which lets the map be rebuilt after a reinstall rather
 * than duplicating every task on the server.
 *
 * **Conflicts are last-write-wins on `updatedAt`, with one exception:** a local
 * task with unpushed changes always wins. A device clock running behind the
 * server would otherwise silently discard notes typed offline.
 */

/** What the mock server stores: the task's fields, its own id, and our id. */
export interface RemoteRecord {
  task: Task;
  remoteId: string;
}

/**
 * Payload sent to the server. `id` is omitted deliberately — the server controls
 * it — and the device-local fields never leave the device.
 */
export const toRemotePayload = (task: Task): Record<string, unknown> => {
  const { id, syncStatus: _syncStatus, notificationId: _notificationId, ...fields } = task;
  return { ...fields, clientId: id };
};

/**
 * Defensive parse — `db.json` is hand-editable, and seed records written by hand
 * have no `clientId`. Those fall back to using the server id as the local id,
 * which is exactly right: the device has never seen them before.
 */
export const fromRemoteRecord = (raw: unknown): RemoteRecord | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const remoteId = typeof record.id === 'string' ? record.id : null;
  if (!remoteId) return null;
  if (typeof record.updatedAt !== 'string') return null;

  const localId = typeof record.clientId === 'string' ? record.clientId : remoteId;
  const { clientId: _clientId, ...fields } = record;

  return {
    remoteId,
    task: {
      ...(fields as unknown as Task),
      id: localId,
      syncStatus: 'Synced',
      notificationId: null,
    },
  };
};

const isNewer = (candidate: Task, reference: Task): boolean =>
  new Date(candidate.updatedAt).getTime() > new Date(reference.updatedAt).getTime();

const hasUnpushedChanges = (task: Task): boolean => task.syncStatus !== 'Synced';

export interface MergeInput {
  local: Task[];
  remote: RemoteRecord[];
  /** Local ids removed on this device but not yet deleted on the server. */
  deletionQueue: string[];
}

export interface MergeResult {
  merged: Task[];
  /** Mapping entries learned from this pull, to fold into the stored `IdMap`. */
  idMap: IdMap;
  /** Server records that were new to this device. */
  added: number;
  /** Local records replaced by a newer server version. */
  updated: number;
  /** Server records ignored because the local copy won. */
  keptLocal: number;
}

export const mergeRemoteTasks = ({ local, remote, deletionQueue }: MergeInput): MergeResult => {
  const deleted = new Set(deletionQueue);
  const byId = new Map(local.map((task) => [task.id, task]));
  const idMap: IdMap = {};

  let added = 0;
  let updated = 0;
  let keptLocal = 0;

  for (const { task: remoteTask, remoteId } of remote) {
    // A task the user deleted offline must not be resurrected by the pull.
    if (deleted.has(remoteTask.id)) continue;

    // Learned regardless of who wins the merge — the mapping is about identity,
    // not about content.
    idMap[remoteTask.id] = remoteId;

    const localTask = byId.get(remoteTask.id);

    if (!localTask) {
      byId.set(remoteTask.id, remoteTask);
      added += 1;
      continue;
    }

    if (hasUnpushedChanges(localTask) || !isNewer(remoteTask, localTask)) {
      keptLocal += 1;
      continue;
    }

    byId.set(remoteTask.id, {
      ...remoteTask,
      // The reminder belongs to this device, not to the server record.
      notificationId: localTask.notificationId,
    });
    updated += 1;
  }

  return { merged: [...byId.values()], idMap, added, updated, keptLocal };
};

/** Tasks that still need pushing, oldest edit first so the server log reads in order. */
export const selectTasksToPush = (tasks: Task[]): Task[] =>
  tasks
    .filter(hasUnpushedChanges)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

/** Drops mapping entries for tasks that no longer exist locally. */
export const pruneIdMap = (idMap: IdMap, liveLocalIds: Iterable<string>): IdMap => {
  const live = new Set(liveLocalIds);
  return Object.fromEntries(Object.entries(idMap).filter(([localId]) => live.has(localId)));
};

/** Human-readable one-liner describing what a sync run achieved. */
export const summariseSync = (counts: {
  pushed: number;
  pulled: number;
  deleted: number;
  failed: number;
}): string => {
  const parts: string[] = [];
  if (counts.pushed > 0) parts.push(`${counts.pushed} uploaded`);
  if (counts.pulled > 0) parts.push(`${counts.pulled} downloaded`);
  if (counts.deleted > 0) parts.push(`${counts.deleted} deleted`);
  if (counts.failed > 0) parts.push(`${counts.failed} failed`);
  if (parts.length === 0) return 'Everything was already up to date.';
  return `${parts.join(', ')}.`;
};
