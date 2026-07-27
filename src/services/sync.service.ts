import { ApiError, createApiClient } from '@/services/api.client';
import type { ApiClient } from '@/services/api.client';
import { logSyncEvent } from '@/services/history.service';
import type { HistoryLog, IdMap, SyncOutcome, Task } from '@/types';
import {
  fromRemoteRecord,
  mergeRemoteTasks,
  pruneIdMap,
  selectTasksToPush,
  summariseSync,
  toRemotePayload,
} from '@/utils/sync.utils';

/**
 * Offline-first synchronisation against the json-server mock API.
 *
 * The device is always the source of truth for the user's own edits; the server
 * is a mirror reconciled opportunistically. A run is a strict sequence:
 *
 *   1. **Replay deletions** queued while offline (`DELETE /tasks/:remoteId`).
 *   2. **Push** every task marked `Pending Sync` / `Sync Failed`.
 *   3. **Pull** the server list and merge it.
 *   4. **Mirror history** entries, best effort.
 *
 * Nothing here touches AsyncStorage. The service takes the current state in and
 * hands new state back, so `TaskContext` remains the only writer — which means a
 * sync run can never half-commit. Identity mapping and conflict rules live in
 * `utils/sync.utils.ts`, where they are unit tested without a server.
 */

export interface SyncInput {
  baseUrl: string;
  tasks: Task[];
  historyLogs: HistoryLog[];
  /** Local ids of tasks deleted on this device. */
  deletionQueue: string[];
  idMap: IdMap;
}

export interface SyncResult {
  tasks: Task[];
  historyLogs: HistoryLog[];
  deletionQueue: string[];
  idMap: IdMap;
  outcome: SyncOutcome;
  /** Sync-level entries to append to the history log. */
  newLogs: HistoryLog[];
}

const isRecoverableMissing = (error: unknown): boolean =>
  error instanceof ApiError && error.isNotFound;

const isUnreachable = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.isNetworkError;

export type ServerDiagnosis =
  { ok: true; taskCount: number; message: string } | { ok: false; message: string; hint: string };

/**
 * One-shot connectivity check for the Settings screen.
 *
 * "Sync failed" is not a useful thing to tell someone standing in a workshop, so
 * this separates the three failures that actually happen — no route to the host,
 * host reachable but nothing listening, and a server that answers with something
 * other than the expected collection — and pairs each with the next thing to try.
 */
export const diagnoseServer = async (baseUrl: string): Promise<ServerDiagnosis> => {
  try {
    const tasks = await createApiClient(baseUrl).get<unknown>('/tasks');

    if (!Array.isArray(tasks)) {
      return {
        ok: false,
        message: `${baseUrl} answered, but /tasks was not a list.`,
        hint: 'Is this really a json-server started from db.json?',
      };
    }

    return {
      ok: true,
      taskCount: tasks.length,
      message: `Connected. ${tasks.length} task${tasks.length === 1 ? '' : 's'} on the server.`,
    };
  } catch (error) {
    if (!(error instanceof ApiError)) {
      return { ok: false, message: 'Unexpected error while testing the connection.', hint: '' };
    }

    if (error.isTimeout) {
      return {
        ok: false,
        message: error.message,
        hint: 'The address is routable but nothing answered. Check the port and that `pnpm mock-server` is running.',
      };
    }

    if (error.isNetworkError) {
      return {
        ok: false,
        message: error.message,
        hint: 'The phone has no route to that address. Both devices must be on the same network — or use `adb reverse tcp:3000 tcp:3000` over USB and set the URL to http://localhost:3000.',
      };
    }

    return {
      ok: false,
      message: error.message,
      hint: 'The server answered but rejected the request. Check the URL path and port.',
    };
  }
};

/**
 * Resolves the server-side id for a task, creating the record if needed.
 *
 * The `clientId` lookup is what makes this idempotent after the local mapping is
 * lost (app data cleared, reinstall): without it, every previously-pushed task
 * would be duplicated on the server the next time it syncs.
 */
const pushTask = async (api: ApiClient, task: Task, knownRemoteId?: string): Promise<string> => {
  const payload = toRemotePayload(task);

  if (knownRemoteId) {
    try {
      await api.put(`/tasks/${knownRemoteId}`, payload);
      return knownRemoteId;
    } catch (error) {
      // Deleted server-side; fall through and re-create it.
      if (!isRecoverableMissing(error)) throw error;
    }
  }

  const existing = await api.get<unknown>(`/tasks?clientId=${encodeURIComponent(task.id)}`);
  const match = Array.isArray(existing) ? fromRemoteRecord(existing[0]) : null;
  if (match) {
    await api.put(`/tasks/${match.remoteId}`, payload);
    return match.remoteId;
  }

  const created = await api.post<unknown>('/tasks', payload);
  const createdId = (created as { id?: unknown } | null)?.id;
  // json-server assigns the id; falling back to the local id keeps the map total.
  return typeof createdId === 'string' ? createdId : task.id;
};

export const synchronise = async ({
  baseUrl,
  tasks,
  historyLogs,
  deletionQueue,
  idMap,
}: SyncInput): Promise<SyncResult> => {
  const api = createApiClient(baseUrl);
  const finishedAt = () => new Date().toISOString();
  const nextIdMap: IdMap = { ...idMap };

  let pushed = 0;
  let pulled = 0;
  let deleted = 0;
  let failed = 0;

  /** Ends the run early, preserving whatever progress was already made. */
  const abort = (params: {
    tasks: Task[];
    deletionQueue: string[];
    message: string;
  }): SyncResult => ({
    tasks: params.tasks,
    historyLogs,
    deletionQueue: params.deletionQueue,
    idMap: nextIdMap,
    outcome: { pushed, pulled, deleted, failed, finishedAt: finishedAt(), error: params.message },
    newLogs: [logSyncEvent('SYNC_FAILED', params.message)],
  });

  /* ------------------------------ 1. deletions ----------------------------- */

  const remainingDeletions: string[] = [];

  for (let index = 0; index < deletionQueue.length; index += 1) {
    const localId = deletionQueue[index]!;
    // Tasks pulled straight from db.json share their id with the server.
    const remoteId = nextIdMap[localId] ?? localId;

    try {
      await api.delete(`/tasks/${remoteId}`);
      deleted += 1;
      delete nextIdMap[localId];
    } catch (error) {
      if (isRecoverableMissing(error)) {
        // Already absent server-side: the intent is satisfied, drop it from the queue.
        deleted += 1;
        delete nextIdMap[localId];
        continue;
      }
      if (isUnreachable(error)) {
        return abort({
          tasks,
          deletionQueue: [...remainingDeletions, ...deletionQueue.slice(index)],
          message: error.message,
        });
      }
      remainingDeletions.push(localId);
      failed += 1;
    }
  }

  /* -------------------------------- 2. push -------------------------------- */

  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  for (const task of selectTasksToPush(tasks)) {
    try {
      nextIdMap[task.id] = await pushTask(api, task, nextIdMap[task.id]);
      tasksById.set(task.id, { ...task, syncStatus: 'Synced' });
      pushed += 1;
    } catch (error) {
      tasksById.set(task.id, { ...task, syncStatus: 'Sync Failed' });
      failed += 1;
      if (isUnreachable(error)) {
        return abort({
          tasks: [...tasksById.values()],
          deletionQueue: remainingDeletions,
          message: error.message,
        });
      }
    }
  }

  /* -------------------------------- 3. pull -------------------------------- */

  const pushedTasks = [...tasksById.values()];
  let mergedTasks = pushedTasks;

  try {
    const remoteRaw = await api.get<unknown>('/tasks');
    const remote = (Array.isArray(remoteRaw) ? remoteRaw : []).flatMap((entry) => {
      const record = fromRemoteRecord(entry);
      return record ? [record] : [];
    });

    const merge = mergeRemoteTasks({
      local: pushedTasks,
      remote,
      deletionQueue: remainingDeletions,
    });

    mergedTasks = merge.merged;
    pulled = merge.added + merge.updated;
    Object.assign(nextIdMap, merge.idMap);
  } catch (error) {
    failed += 1;
    return abort({
      tasks: mergedTasks,
      deletionQueue: remainingDeletions,
      message: error instanceof ApiError ? error.message : 'Could not download server tasks.',
    });
  }

  /* ------------------------------- 4. history ------------------------------ */

  const mirroredHistory = await mirrorHistoryLogs(api, historyLogs);

  return {
    tasks: mergedTasks,
    historyLogs: mirroredHistory,
    deletionQueue: remainingDeletions,
    // Mappings for tasks that no longer exist locally are dead weight.
    idMap: pruneIdMap(
      nextIdMap,
      mergedTasks.map((task) => task.id)
    ),
    outcome: { pushed, pulled, deleted, failed, finishedAt: finishedAt(), error: null },
    newLogs: [
      logSyncEvent(
        failed > 0 ? 'SYNC_FAILED' : 'SYNCED',
        summariseSync({ pushed, pulled, deleted, failed })
      ),
    ],
  };
};

/**
 * Mirrors the audit trail into the server's `history` collection.
 *
 * Deliberately best-effort and capped: the log is a local artefact first, and a
 * failure to mirror it must never fail the task sync the user actually cares about.
 */
const HISTORY_MIRROR_BATCH = 50;

const mirrorHistoryLogs = async (
  api: ApiClient,
  historyLogs: HistoryLog[]
): Promise<HistoryLog[]> => {
  const pending = historyLogs.filter((log) => !log.synced).slice(0, HISTORY_MIRROR_BATCH);
  if (pending.length === 0) return historyLogs;

  const syncedIds = new Set<string>();

  for (const log of pending) {
    try {
      const { synced: _synced, id, ...payload } = log;
      // Carries `logId` for the same reason tasks carry `clientId`: the server
      // mints its own `id` and would otherwise discard ours.
      await api.post('/history', { ...payload, logId: id });
      syncedIds.add(log.id);
    } catch {
      // Stop at the first failure; the rest are retried on the next run.
      break;
    }
  }

  if (syncedIds.size === 0) return historyLogs;
  return historyLogs.map((log) => (syncedIds.has(log.id) ? { ...log, synced: true } : log));
};

export const SyncService = {
  diagnoseServer,
  synchronise,
};
