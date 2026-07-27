/**
 * Ids without a uuid dependency, which would need a `crypto` polyfill on React
 * Native. The leading timestamp keeps stored records roughly sortable.
 */
export const createId = (prefix: string): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 11).padEnd(9, '0');
  return `${prefix}_${timestamp}_${random}`;
};

export const createTaskId = (): string => createId('task');
export const createHistoryId = (): string => createId('log');
export const createAttachmentId = (): string => createId('att');
