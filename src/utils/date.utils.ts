/**
 * Date formatting helpers.
 *
 * `Intl` is available on Hermes with the `intl` variant that Expo ships, but the
 * formats here are deliberately hand-rolled so output is identical on every
 * device and locale — a field report that reads differently per phone is a bug.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const pad = (value: number): string => value.toString().padStart(2, '0');

/** Parses an ISO string defensively; stored data can always be corrupt or hand-edited. */
export const parseIso = (iso: string): Date | null => {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isValidIso = (iso: string): boolean => parseIso(iso) !== null;

/** `14 Mar 2026` */
export const formatDate = (iso: string): string => {
  const date = parseIso(iso);
  if (!date) return 'Unknown date';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

/** `09:30` */
export const formatTime = (iso: string): string => {
  const date = parseIso(iso);
  if (!date) return '--:--';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** `14 Mar 2026 · 09:30` */
export const formatDateTime = (iso: string): string => {
  const date = parseIso(iso);
  if (!date) return 'Unknown date';
  return `${formatDate(iso)} · ${formatTime(iso)}`;
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Day bucket used as the History screen's section headers. */
export const formatDayLabel = (iso: string, now: Date = new Date()): string => {
  const date = parseIso(iso);
  if (!date) return 'Unknown date';

  const yesterday = new Date(now.getTime() - DAY_MS);
  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return formatDate(iso);
};

/** `in 2 h 15 m`, `3 d ago`, `just now` — the compact form used on cards. */
export const formatRelative = (iso: string, now: Date = new Date()): string => {
  const date = parseIso(iso);
  if (!date) return 'unknown';

  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const isFuture = diff > 0;

  if (abs < MINUTE_MS) return 'just now';

  const suffix = (text: string) => (isFuture ? `in ${text}` : `${text} ago`);

  if (abs < HOUR_MS) return suffix(`${Math.round(abs / MINUTE_MS)} min`);
  if (abs < DAY_MS) {
    const hours = Math.floor(abs / HOUR_MS);
    const minutes = Math.round((abs % HOUR_MS) / MINUTE_MS);
    return suffix(minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`);
  }
  const days = Math.round(abs / DAY_MS);
  return suffix(days === 1 ? '1 day' : `${days} days`);
};

export const isOverdue = (iso: string, now: Date = new Date()): boolean => {
  const date = parseIso(iso);
  return date !== null && date.getTime() < now.getTime();
};

export const minutesUntil = (iso: string, now: Date = new Date()): number => {
  const date = parseIso(iso);
  if (!date) return Number.NaN;
  return (date.getTime() - now.getTime()) / MINUTE_MS;
};

/** Default due date offered by the form: tomorrow at 09:00, seconds zeroed. */
export const defaultDueDate = (now: Date = new Date()): Date => {
  const date = new Date(now.getTime() + DAY_MS);
  date.setHours(9, 0, 0, 0);
  return date;
};

/** Merges the date part of one Date with the time part of another. */
export const combineDateAndTime = (datePart: Date, timePart: Date): Date => {
  const merged = new Date(datePart);
  merged.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return merged;
};
