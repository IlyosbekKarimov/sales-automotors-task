import type { Task } from '@/types';
import {
  fromRemoteRecord,
  mergeRemoteTasks,
  pruneIdMap,
  selectTasksToPush,
  summariseSync,
  toRemotePayload,
} from '@/utils/sync.utils';
import type { RemoteRecord } from '@/utils/sync.utils';

const buildTask = (overrides: Partial<Task> & Pick<Task, 'id'>): Task => ({
  title: 'Task',
  description: 'Description',
  dueDate: '2026-07-28T09:00:00.000Z',
  location: { address: 'Somewhere', latitude: null, longitude: null },
  attachments: [],
  status: 'New',
  syncStatus: 'Synced',
  notificationId: null,
  createdAt: '2026-07-20T09:00:00.000Z',
  updatedAt: '2026-07-20T09:00:00.000Z',
  ...overrides,
});

/** Mimics what json-server stores: its own `id`, plus our `clientId`. */
const asServerRecord = (task: Task, remoteId: string): Record<string, unknown> => ({
  ...toRemotePayload(task),
  id: remoteId,
});

const buildRemote = (task: Task, remoteId = `srv_${task.id}`): RemoteRecord => ({ task, remoteId });

describe('toRemotePayload', () => {
  it('strips the device-local fields and the local id from the payload', () => {
    const payload = toRemotePayload(buildTask({ id: 'a', notificationId: 'notif-1' }));

    expect('syncStatus' in payload).toBe(false);
    expect('notificationId' in payload).toBe(false);
    expect('id' in payload).toBe(false);
  });

  // json-server overwrites `id` on POST, so identity has to travel separately.
  it('carries the local id as clientId', () => {
    expect(toRemotePayload(buildTask({ id: 'local-1' })).clientId).toBe('local-1');
  });
});

describe('fromRemoteRecord', () => {
  it('maps a record back to its local id and marks it synced', () => {
    const record = fromRemoteRecord(asServerRecord(buildTask({ id: 'local-1' }), 'srv_abc'));

    expect(record?.task.id).toBe('local-1');
    expect(record?.remoteId).toBe('srv_abc');
    expect(record?.task.syncStatus).toBe('Synced');
    expect(record?.task.notificationId).toBeNull();
  });

  it('does not leak clientId into the local task', () => {
    const record = fromRemoteRecord(asServerRecord(buildTask({ id: 'local-1' }), 'srv_abc'));
    expect('clientId' in (record?.task ?? {})).toBe(false);
  });

  // Hand-written db.json seed rows have no clientId; their server id becomes the local id.
  it('falls back to the server id when there is no clientId', () => {
    const seed = { ...buildTask({ id: 'ignored' }), id: 'task_seed_one' };
    const record = fromRemoteRecord(seed);

    expect(record?.task.id).toBe('task_seed_one');
    expect(record?.remoteId).toBe('task_seed_one');
  });

  it.each([null, undefined, 42, 'nope', {}, { id: 'a' }, { updatedAt: 'x' }])(
    'rejects the malformed record %p',
    (raw) => {
      expect(fromRemoteRecord(raw)).toBeNull();
    }
  );
});

describe('mergeRemoteTasks', () => {
  it('adopts server records this device has never seen', () => {
    const result = mergeRemoteTasks({
      local: [],
      remote: [buildRemote(buildTask({ id: 'remote-only' }), 'srv_1')],
      deletionQueue: [],
    });

    expect(result.added).toBe(1);
    expect(result.merged.map((t) => t.id)).toEqual(['remote-only']);
    expect(result.idMap).toEqual({ 'remote-only': 'srv_1' });
  });

  it('keeps local tasks the server does not know about', () => {
    const result = mergeRemoteTasks({
      local: [buildTask({ id: 'local-only', syncStatus: 'Pending Sync' })],
      remote: [],
      deletionQueue: [],
    });

    expect(result.merged.map((t) => t.id)).toEqual(['local-only']);
    expect(result.idMap).toEqual({});
  });

  it('takes the newer server copy when the local one is clean (last write wins)', () => {
    const result = mergeRemoteTasks({
      local: [buildTask({ id: 'a', title: 'Old title', updatedAt: '2026-07-20T09:00:00.000Z' })],
      remote: [
        buildRemote(
          buildTask({ id: 'a', title: 'New title', updatedAt: '2026-07-21T09:00:00.000Z' })
        ),
      ],
      deletionQueue: [],
    });

    expect(result.updated).toBe(1);
    expect(result.merged[0]?.title).toBe('New title');
  });

  it('ignores an older server copy', () => {
    const result = mergeRemoteTasks({
      local: [buildTask({ id: 'a', title: 'Local', updatedAt: '2026-07-22T09:00:00.000Z' })],
      remote: [
        buildRemote(buildTask({ id: 'a', title: 'Stale', updatedAt: '2026-07-21T09:00:00.000Z' })),
      ],
      deletionQueue: [],
    });

    expect(result.keptLocal).toBe(1);
    expect(result.merged[0]?.title).toBe('Local');
  });

  // The guard that protects offline work from a fast or skewed server clock.
  it('keeps unpushed local edits even when the server record is newer', () => {
    const result = mergeRemoteTasks({
      local: [
        buildTask({
          id: 'a',
          title: 'Typed in the field',
          syncStatus: 'Pending Sync',
          updatedAt: '2026-07-20T09:00:00.000Z',
        }),
      ],
      remote: [
        buildRemote(
          buildTask({ id: 'a', title: 'Server version', updatedAt: '2026-07-25T09:00:00.000Z' })
        ),
      ],
      deletionQueue: [],
    });

    expect(result.keptLocal).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.merged[0]?.title).toBe('Typed in the field');
  });

  it('still learns the id mapping when the local copy wins', () => {
    const result = mergeRemoteTasks({
      local: [buildTask({ id: 'a', syncStatus: 'Pending Sync' })],
      remote: [buildRemote(buildTask({ id: 'a' }), 'srv_9')],
      deletionQueue: [],
    });

    expect(result.idMap).toEqual({ a: 'srv_9' });
  });

  it('does not resurrect a task that is queued for deletion', () => {
    const result = mergeRemoteTasks({
      local: [],
      remote: [buildRemote(buildTask({ id: 'deleted-offline' }))],
      deletionQueue: ['deleted-offline'],
    });

    expect(result.merged).toHaveLength(0);
    expect(result.added).toBe(0);
    expect(result.idMap).toEqual({});
  });

  it('preserves the local reminder id when adopting a newer server record', () => {
    const result = mergeRemoteTasks({
      local: [
        buildTask({ id: 'a', notificationId: 'notif-1', updatedAt: '2026-07-20T09:00:00.000Z' }),
      ],
      remote: [buildRemote(buildTask({ id: 'a', updatedAt: '2026-07-25T09:00:00.000Z' }))],
      deletionQueue: [],
    });

    expect(result.merged[0]?.notificationId).toBe('notif-1');
  });
});

describe('pruneIdMap', () => {
  it('drops mappings for tasks that no longer exist locally', () => {
    expect(pruneIdMap({ a: 'srv_a', b: 'srv_b' }, ['a'])).toEqual({ a: 'srv_a' });
  });
});

describe('selectTasksToPush', () => {
  it('selects only unsynced tasks, oldest edit first', () => {
    const tasks = [
      buildTask({ id: 'synced' }),
      buildTask({ id: 'newer', syncStatus: 'Pending Sync', updatedAt: '2026-07-25T09:00:00.000Z' }),
      buildTask({ id: 'older', syncStatus: 'Sync Failed', updatedAt: '2026-07-21T09:00:00.000Z' }),
    ];

    expect(selectTasksToPush(tasks).map((t) => t.id)).toEqual(['older', 'newer']);
  });
});

describe('summariseSync', () => {
  it('reports a no-op run', () => {
    expect(summariseSync({ pushed: 0, pulled: 0, deleted: 0, failed: 0 })).toBe(
      'Everything was already up to date.'
    );
  });

  it('lists only the non-zero counts', () => {
    expect(summariseSync({ pushed: 2, pulled: 0, deleted: 1, failed: 0 })).toBe(
      '2 uploaded, 1 deleted.'
    );
  });
});
