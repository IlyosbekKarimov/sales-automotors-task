import {
  combineDateAndTime,
  defaultDueDate,
  formatDayLabel,
  formatRelative,
  isOverdue,
  isValidIso,
  minutesUntil,
  parseIso,
} from '@/utils/date.utils';

const NOW = new Date('2026-07-27T12:00:00.000Z');

describe('parseIso', () => {
  it('returns null rather than an Invalid Date for junk input', () => {
    expect(parseIso('not-a-date')).toBeNull();
    expect(isValidIso('not-a-date')).toBe(false);
  });

  it('parses a valid ISO string', () => {
    expect(parseIso('2026-07-27T12:00:00.000Z')?.getTime()).toBe(NOW.getTime());
  });
});

describe('formatRelative', () => {
  it('collapses sub-minute differences', () => {
    expect(formatRelative('2026-07-27T12:00:30.000Z', NOW)).toBe('just now');
  });

  it('describes the near future in minutes', () => {
    expect(formatRelative('2026-07-27T12:25:00.000Z', NOW)).toBe('in 25 min');
  });

  it('describes the past with an "ago" suffix', () => {
    expect(formatRelative('2026-07-27T10:00:00.000Z', NOW)).toBe('2 h ago');
  });

  it('switches to days beyond 24 hours', () => {
    expect(formatRelative('2026-07-30T12:00:00.000Z', NOW)).toBe('in 3 days');
    expect(formatRelative('2026-07-26T12:00:00.000Z', NOW)).toBe('1 day ago');
  });

  it('degrades gracefully on unparseable input', () => {
    expect(formatRelative('nope', NOW)).toBe('unknown');
  });
});

describe('formatDayLabel', () => {
  it('labels today and yesterday by name', () => {
    expect(formatDayLabel('2026-07-27T08:00:00.000Z', NOW)).toBe('Today');
    expect(formatDayLabel('2026-07-26T08:00:00.000Z', NOW)).toBe('Yesterday');
  });

  it('falls back to a full date further back', () => {
    expect(formatDayLabel('2026-07-01T08:00:00.000Z', NOW)).toBe('1 Jul 2026');
  });
});

describe('isOverdue and minutesUntil', () => {
  it('detects a past timestamp', () => {
    expect(isOverdue('2026-07-27T11:00:00.000Z', NOW)).toBe(true);
    expect(isOverdue('2026-07-27T13:00:00.000Z', NOW)).toBe(false);
  });

  it('reports signed minutes until the target', () => {
    expect(minutesUntil('2026-07-27T12:45:00.000Z', NOW)).toBe(45);
    expect(minutesUntil('2026-07-27T11:30:00.000Z', NOW)).toBe(-30);
  });
});

describe('defaultDueDate', () => {
  it('offers tomorrow at 09:00 with seconds zeroed', () => {
    const result = defaultDueDate(NOW);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getTime()).toBeGreaterThan(NOW.getTime());
  });
});

describe('combineDateAndTime', () => {
  it('takes the calendar day from the first argument and the clock from the second', () => {
    const day = new Date(2026, 7, 3, 23, 45, 0);
    const time = new Date(2026, 0, 1, 8, 30, 0);
    const merged = combineDateAndTime(day, time);

    expect(merged.getFullYear()).toBe(2026);
    expect(merged.getMonth()).toBe(7);
    expect(merged.getDate()).toBe(3);
    expect(merged.getHours()).toBe(8);
    expect(merged.getMinutes()).toBe(30);
  });
});
