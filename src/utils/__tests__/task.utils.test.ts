import type { Task, TaskListFilters, TaskStatus } from '@/types';
import {
  DEFAULT_FILTERS,
  describeDueRange,
  resolveDueRange,
  applyFilters,
  countTasks,
  filterTasks,
  isTaskOverdue,
  sortTasks,
  summariseLocation,
  tasksWithCoordinates,
} from '@/utils/task.utils';

const NOW = new Date('2026-07-27T12:00:00.000Z');

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

const filters = (patch: Partial<TaskListFilters> = {}): TaskListFilters => ({
  ...DEFAULT_FILTERS,
  ...patch,
});

describe('filterTasks', () => {
  const tasks = [
    buildTask({ id: 'a', title: 'Replace hydraulic hose', status: 'New' }),
    buildTask({
      id: 'b',
      title: 'Service generator',
      description: 'Oil change',
      status: 'Completed',
    }),
    buildTask({
      id: 'c',
      title: 'Inspect lift',
      location: { address: 'Registan St 12, Samarkand', latitude: null, longitude: null },
      status: 'In Progress',
    }),
  ];

  it('returns everything when no filters are set', () => {
    expect(filterTasks(tasks, filters())).toHaveLength(3);
  });

  it('matches the query against title, description and address', () => {
    expect(filterTasks(tasks, filters({ query: 'hydraulic' })).map((t) => t.id)).toEqual(['a']);
    expect(filterTasks(tasks, filters({ query: 'oil change' })).map((t) => t.id)).toEqual(['b']);
    expect(filterTasks(tasks, filters({ query: 'samarkand' })).map((t) => t.id)).toEqual(['c']);
  });

  it('is case insensitive and ignores surrounding whitespace', () => {
    expect(filterTasks(tasks, filters({ query: '  HYDRAULIC  ' }))).toHaveLength(1);
  });

  it('filters by any of the selected statuses', () => {
    const selected: TaskStatus[] = ['New', 'In Progress'];
    expect(filterTasks(tasks, filters({ statuses: selected })).map((t) => t.id)).toEqual([
      'a',
      'c',
    ]);
  });

  it('combines query and status filters', () => {
    expect(filterTasks(tasks, filters({ query: 'e', statuses: ['Completed'] }))).toHaveLength(1);
  });
});

describe('sortTasks', () => {
  const tasks = [
    buildTask({
      id: 'late',
      dueDate: '2026-08-05T09:00:00.000Z',
      createdAt: '2026-07-01T00:00:00.000Z',
      status: 'Completed',
    }),
    buildTask({
      id: 'soon',
      dueDate: '2026-07-28T09:00:00.000Z',
      createdAt: '2026-07-10T00:00:00.000Z',
      status: 'New',
    }),
    buildTask({
      id: 'mid',
      dueDate: '2026-07-30T09:00:00.000Z',
      createdAt: '2026-07-05T00:00:00.000Z',
      status: 'In Progress',
    }),
  ];

  it('sorts by due date ascending', () => {
    expect(
      sortTasks(tasks, filters({ sortKey: 'dueDate', sortDirection: 'asc' })).map((t) => t.id)
    ).toEqual(['soon', 'mid', 'late']);
  });

  it('reverses for descending', () => {
    expect(
      sortTasks(tasks, filters({ sortKey: 'dueDate', sortDirection: 'desc' })).map((t) => t.id)
    ).toEqual(['late', 'mid', 'soon']);
  });

  it('sorts by date added', () => {
    expect(
      sortTasks(tasks, filters({ sortKey: 'createdAt', sortDirection: 'asc' })).map((t) => t.id)
    ).toEqual(['late', 'mid', 'soon']);
  });

  it('sorts by status in workflow order: in progress, new, then closed', () => {
    expect(
      sortTasks(tasks, filters({ sortKey: 'status', sortDirection: 'asc' })).map((t) => t.id)
    ).toEqual(['mid', 'soon', 'late']);
  });

  it('does not mutate the input array', () => {
    const input = [...tasks];
    sortTasks(input, filters({ sortKey: 'dueDate' }));
    expect(input.map((t) => t.id)).toEqual(tasks.map((t) => t.id));
  });
});

describe('applyFilters', () => {
  it('filters first, then sorts the survivors', () => {
    const tasks = [
      buildTask({ id: 'a', title: 'alpha hose', dueDate: '2026-08-05T09:00:00.000Z' }),
      buildTask({ id: 'b', title: 'beta hose', dueDate: '2026-07-28T09:00:00.000Z' }),
      buildTask({ id: 'c', title: 'gamma pump', dueDate: '2026-07-27T09:00:00.000Z' }),
    ];
    expect(applyFilters(tasks, filters({ query: 'hose' })).map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('isTaskOverdue', () => {
  it('flags an open task past its due date', () => {
    expect(isTaskOverdue(buildTask({ id: 'a', dueDate: '2026-07-26T09:00:00.000Z' }), NOW)).toBe(
      true
    );
  });

  it('does not flag a future task', () => {
    expect(isTaskOverdue(buildTask({ id: 'a', dueDate: '2026-07-28T09:00:00.000Z' }), NOW)).toBe(
      false
    );
  });

  // Chasing a finished or abandoned job helps nobody.
  it.each(['Completed', 'Cancelled'] as const)('does not flag a %s task', (status) => {
    const task = buildTask({ id: 'a', dueDate: '2026-07-26T09:00:00.000Z', status });
    expect(isTaskOverdue(task, NOW)).toBe(false);
  });
});

describe('countTasks', () => {
  it('counts totals, statuses, overdue and unsynced tasks', () => {
    const counts = countTasks(
      [
        buildTask({ id: 'a', status: 'New', dueDate: '2026-07-26T09:00:00.000Z' }),
        buildTask({ id: 'b', status: 'In Progress', syncStatus: 'Pending Sync' }),
        buildTask({ id: 'c', status: 'Completed', syncStatus: 'Sync Failed' }),
      ],
      NOW
    );

    expect(counts.total).toBe(3);
    expect(counts.byStatus).toEqual({ New: 1, 'In Progress': 1, Completed: 1, Cancelled: 0 });
    expect(counts.overdue).toBe(1);
    expect(counts.pendingSync).toBe(2);
  });
});

describe('location helpers', () => {
  const located = buildTask({
    id: 'a',
    location: { address: 'Registan St 12', latitude: 39.654, longitude: 66.975 },
  });
  const unlocated = buildTask({ id: 'b' });

  it('keeps only tasks that carry both coordinates', () => {
    expect(tasksWithCoordinates([located, unlocated]).map((t) => t.id)).toEqual(['a']);
  });

  it('summarises an address with its pin', () => {
    expect(summariseLocation(located)).toBe('Registan St 12 · 39.6540, 66.9750');
  });

  it('summarises an address without a pin', () => {
    expect(summariseLocation(unlocated)).toBe('Somewhere');
  });

  it('handles a task with no address at all', () => {
    const blank = buildTask({
      id: 'c',
      location: { address: '  ', latitude: null, longitude: null },
    });
    expect(summariseLocation(blank)).toBe('No address');
  });
});

describe('resolveDueRange', () => {
  it('places no bounds on "any"', () => {
    expect(resolveDueRange({ preset: 'any', from: null, to: null }, NOW)).toEqual({
      from: null,
      to: null,
    });
  });

  it('bounds "overdue" by now, with no lower bound', () => {
    const bounds = resolveDueRange({ preset: 'overdue', from: null, to: null }, NOW);
    expect(bounds.from).toBeNull();
    expect(bounds.to).toBe(NOW.getTime());
  });

  it('covers the whole of today', () => {
    const bounds = resolveDueRange({ preset: 'today', from: null, to: null }, NOW);
    expect(new Date(bounds.from!).getHours()).toBe(0);
    expect(new Date(bounds.to!).getHours()).toBe(23);
  });

  // Widening to whole days is the point: picking a single day must include it.
  it('widens a custom range to whole days', () => {
    const bounds = resolveDueRange(
      { preset: 'custom', from: '2026-08-03T15:00:00.000Z', to: '2026-08-05T02:00:00.000Z' },
      NOW
    );
    expect(new Date(bounds.from!).getHours()).toBe(0);
    expect(new Date(bounds.to!).getHours()).toBe(23);
    expect(bounds.to!).toBeGreaterThan(bounds.from!);
  });

  it('allows an open-ended custom range', () => {
    const bounds = resolveDueRange({ preset: 'custom', from: null, to: null }, NOW);
    expect(bounds).toEqual({ from: null, to: null });
  });
});

describe('filterTasks by due range', () => {
  const tasks = [
    buildTask({ id: 'past', dueDate: '2026-07-20T09:00:00.000Z' }),
    buildTask({ id: 'today', dueDate: '2026-07-27T18:00:00.000Z' }),
    buildTask({ id: 'soon', dueDate: '2026-07-31T09:00:00.000Z' }),
    buildTask({ id: 'far', dueDate: '2026-10-01T09:00:00.000Z' }),
  ];

  const withRange = (preset: TaskListFilters['dueRange']['preset']) =>
    filterTasks(tasks, filters({ dueRange: { preset, from: null, to: null } }), NOW).map(
      (t) => t.id
    );

  it('returns everything for "any"', () => {
    expect(withRange('any')).toHaveLength(4);
  });

  it('returns only past-due tasks for "overdue"', () => {
    expect(withRange('overdue')).toEqual(['past']);
  });

  it('returns only tasks due today', () => {
    expect(withRange('today')).toEqual(['today']);
  });

  it('returns tasks inside the next 7 days', () => {
    expect(withRange('next7')).toEqual(['today', 'soon']);
  });

  it('honours an explicit custom range', () => {
    const ids = filterTasks(
      tasks,
      filters({
        dueRange: {
          preset: 'custom',
          from: '2026-07-28T00:00:00.000Z',
          to: '2026-08-31T00:00:00.000Z',
        },
      }),
      NOW
    ).map((t) => t.id);
    expect(ids).toEqual(['soon']);
  });

  it('combines with the search query and status filters', () => {
    const ids = filterTasks(
      [...tasks, buildTask({ id: 'match', title: 'pump', dueDate: '2026-07-27T10:00:00.000Z' })],
      filters({ query: 'pump', dueRange: { preset: 'today', from: null, to: null } }),
      NOW
    ).map((t) => t.id);
    expect(ids).toEqual(['match']);
  });

  it('excludes tasks whose due date cannot be parsed', () => {
    const ids = filterTasks(
      [buildTask({ id: 'broken', dueDate: 'not-a-date' })],
      filters({ dueRange: { preset: 'today', from: null, to: null } }),
      NOW
    );
    expect(ids).toHaveLength(0);
  });
});

describe('describeDueRange', () => {
  it('uses the preset label for non-custom ranges', () => {
    expect(describeDueRange({ preset: 'next7', from: null, to: null })).toBe('Next 7 days');
  });

  it('describes open-ended and closed custom ranges', () => {
    expect(describeDueRange({ preset: 'custom', from: '2026-08-03T00:00:00.000Z', to: null })).toBe(
      'From 3 Aug 2026'
    );
    expect(describeDueRange({ preset: 'custom', from: null, to: '2026-08-05T00:00:00.000Z' })).toBe(
      'Until 5 Aug 2026'
    );
    expect(
      describeDueRange({
        preset: 'custom',
        from: '2026-08-03T00:00:00.000Z',
        to: '2026-08-05T00:00:00.000Z',
      })
    ).toBe('3 Aug 2026 – 5 Aug 2026');
  });
});
