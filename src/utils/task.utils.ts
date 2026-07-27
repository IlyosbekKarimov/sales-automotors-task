import type { DueRange, DueRangePreset, Task, TaskListFilters, TaskStatus } from '@/types';
import { formatDate, isOverdue, parseIso } from '@/utils/date.utils';

/**
 * Pure list-shaping helpers. Keeping sort/filter out of the components means the
 * Task list screen stays declarative and this logic is directly unit testable.
 */

/**
 * Ordering used when sorting by status. It is deliberately workflow-based rather
 * than alphabetical: what a technician wants at the top of the list is the job
 * they are already on, then what is still unstarted, then everything closed out.
 */
const STATUS_RANK: Record<TaskStatus, number> = {
  'In Progress': 0,
  New: 1,
  Completed: 2,
  Cancelled: 3,
};

export const DEFAULT_DUE_RANGE: DueRange = { preset: 'any', from: null, to: null };

export const DEFAULT_FILTERS: TaskListFilters = {
  query: '',
  statuses: [],
  dueRange: DEFAULT_DUE_RANGE,
  sortKey: 'dueDate',
  sortDirection: 'asc',
};

export const DUE_RANGE_LABELS: Record<DueRangePreset, string> = {
  any: 'Any date',
  overdue: 'Overdue',
  today: 'Today',
  next7: 'Next 7 days',
  next30: 'Next 30 days',
  custom: 'Custom range',
};

const startOfDay = (date: Date): number => new Date(date).setHours(0, 0, 0, 0);
const endOfDay = (date: Date): number => new Date(date).setHours(23, 59, 59, 999);
const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export interface ResolvedRange {
  from: number | null;
  to: number | null;
}

/**
 * Turns a preset into concrete bounds. Presets are resolved against "now" at
 * filter time rather than stored as dates, so a list left open overnight still
 * means "today" the next morning.
 *
 * Custom bounds are widened to whole days: a technician picking 3–5 March means
 * all of the 5th, not up to midnight on it.
 */
export const resolveDueRange = (range: DueRange, now: Date = new Date()): ResolvedRange => {
  switch (range.preset) {
    case 'any':
      return { from: null, to: null };
    case 'overdue':
      return { from: null, to: now.getTime() };
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'next7':
      return { from: startOfDay(now), to: endOfDay(addDays(now, 7)) };
    case 'next30':
      return { from: startOfDay(now), to: endOfDay(addDays(now, 30)) };
    case 'custom': {
      const from = range.from ? parseIso(range.from) : null;
      const to = range.to ? parseIso(range.to) : null;
      return {
        from: from ? startOfDay(from) : null,
        to: to ? endOfDay(to) : null,
      };
    }
  }
};

const matchesQuery = (task: Task, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return (
    task.title.toLowerCase().includes(needle) ||
    task.description.toLowerCase().includes(needle) ||
    task.location.address.toLowerCase().includes(needle)
  );
};

const matchesDueRange = (task: Task, bounds: ResolvedRange): boolean => {
  if (bounds.from === null && bounds.to === null) return true;

  const due = parseIso(task.dueDate);
  if (!due) return false;

  const time = due.getTime();
  return (bounds.from === null || time >= bounds.from) && (bounds.to === null || time <= bounds.to);
};

export const filterTasks = (
  tasks: Task[],
  filters: TaskListFilters,
  now: Date = new Date()
): Task[] => {
  const bounds = resolveDueRange(filters.dueRange, now);

  return tasks.filter(
    (task) =>
      matchesQuery(task, filters.query) &&
      (filters.statuses.length === 0 || filters.statuses.includes(task.status)) &&
      matchesDueRange(task, bounds)
  );
};

/** Short label for the filter chip, e.g. `3 Mar – 5 Mar`. */
export const describeDueRange = (range: DueRange): string => {
  if (range.preset !== 'custom') return DUE_RANGE_LABELS[range.preset];
  if (!range.from && !range.to) return 'Custom range';
  if (range.from && !range.to) return `From ${formatDate(range.from)}`;
  if (!range.from && range.to) return `Until ${formatDate(range.to)}`;
  return `${formatDate(range.from!)} – ${formatDate(range.to!)}`;
};

const compareBySortKey = (a: Task, b: Task, sortKey: TaskListFilters['sortKey']): number => {
  switch (sortKey) {
    case 'dueDate':
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    case 'createdAt':
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case 'status':
      // Equal statuses fall back to due date so the order is stable and meaningful.
      return (
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
  }
};

/** Returns a new array; never mutates the caller's list. */
export const sortTasks = (tasks: Task[], filters: TaskListFilters): Task[] => {
  const direction = filters.sortDirection === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => compareBySortKey(a, b, filters.sortKey) * direction);
};

export const applyFilters = (
  tasks: Task[],
  filters: TaskListFilters,
  now: Date = new Date()
): Task[] => sortTasks(filterTasks(tasks, filters, now), filters);

export interface TaskCounts {
  total: number;
  byStatus: Record<TaskStatus, number>;
  overdue: number;
  pendingSync: number;
}

export const countTasks = (tasks: Task[], now: Date = new Date()): TaskCounts => {
  const counts: TaskCounts = {
    total: tasks.length,
    byStatus: { New: 0, 'In Progress': 0, Completed: 0, Cancelled: 0 },
    overdue: 0,
    pendingSync: 0,
  };

  for (const task of tasks) {
    counts.byStatus[task.status] += 1;
    if (task.syncStatus !== 'Synced') counts.pendingSync += 1;
    if (isTaskOverdue(task, now)) counts.overdue += 1;
  }

  return counts;
};

/** A closed task is never "overdue" — chasing a cancelled job helps nobody. */
export const isTaskOverdue = (task: Task, now: Date = new Date()): boolean =>
  task.status !== 'Completed' && task.status !== 'Cancelled' && isOverdue(task.dueDate, now);

export const hasCoordinates = (
  task: Task
): task is Task & { location: { latitude: number; longitude: number; address: string } } =>
  typeof task.location.latitude === 'number' && typeof task.location.longitude === 'number';

export const tasksWithCoordinates = (tasks: Task[]): Task[] => tasks.filter(hasCoordinates);

/** One-line location summary for list rows: address, with coordinates if pinned. */
export const summariseLocation = (task: Task): string => {
  const address = task.location.address.trim() || 'No address';
  if (!hasCoordinates(task)) return address;
  return `${address} · ${task.location.latitude!.toFixed(4)}, ${task.location.longitude!.toFixed(4)}`;
};

/** Statuses a task can move to — a task never "transitions" to the one it already has. */
export const availableStatusTransitions = (current: TaskStatus): TaskStatus[] =>
  (Object.keys(STATUS_RANK) as TaskStatus[])
    .filter((status) => status !== current)
    .sort((a, b) => STATUS_RANK[a] - STATUS_RANK[b]);
