import type { AttachmentKind, HistoryAction } from '@/types';

export const formatFileSize = (bytes: number | null): string => {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Maps a MIME type / filename to the coarse kind the UI renders differently. */
export const resolveAttachmentKind = (
  mimeType: string | null | undefined,
  fileName: string | null | undefined
): AttachmentKind => {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';

  const extension = (fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'bmp'].includes(extension)) return 'image';
  if (extension === 'pdf') return 'pdf';
  return 'file';
};

export const getFileExtension = (uri: string, fallback = 'bin'): string => {
  const withoutQuery = uri.split('?')[0] ?? uri;
  const lastSegment = withoutQuery.split('/').pop() ?? '';
  const extension = lastSegment.includes('.') ? lastSegment.split('.').pop() : undefined;
  return extension && extension.length <= 5 ? extension.toLowerCase() : fallback;
};

/** Human label for a history entry, used by the History screen and accessibility text. */
export const describeHistoryAction = (action: HistoryAction): string => {
  switch (action) {
    case 'CREATED':
      return 'Task created';
    case 'UPDATED':
      return 'Task edited';
    case 'STATUS_CHANGED':
      return 'Status changed';
    case 'ATTACHMENT_ADDED':
      return 'Attachment added';
    case 'ATTACHMENT_REMOVED':
      return 'Attachment removed';
    case 'DELETED':
      return 'Task deleted';
    case 'SYNCED':
      return 'Synced with server';
    case 'SYNC_FAILED':
      return 'Sync failed';
    case 'REMINDER_SCHEDULED':
      return 'Reminder scheduled';
  }
};

export const truncate = (value: string, maxLength: number): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;

/** `10` → `10`, `120` → `99+`. Keeps badge widths predictable. */
export const formatBadgeCount = (count: number): string => (count > 99 ? '99+' : String(count));
