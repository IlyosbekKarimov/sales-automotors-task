import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import type { TaskAttachment } from '@/types';
import { getFileExtension, resolveAttachmentKind } from '@/utils/format.utils';
import { createAttachmentId } from '@/utils/id.utils';
import { logger } from '@/utils/logger';

/**
 * Attachment capture and durable storage.
 *
 * Both pickers hand back a URI in the **cache** directory, which Android is free
 * to purge at any time — an attachment stored that way silently disappears days
 * later. Every picked file is therefore copied into
 * `<documents>/attachments/` before its metadata record is created, so the task
 * detail screen can still render it after a restart.
 *
 * The UI never sees an exception from this module: every entry point resolves to
 * a tagged result so screens can render the right message instead of `try/catch`
 * blocks scattered through components.
 */

const ATTACHMENTS_DIRECTORY_NAME = 'attachments';

export type AttachmentPickResult =
  | { status: 'picked'; attachments: TaskAttachment[] }
  | { status: 'cancelled' }
  | { status: 'denied'; message: string }
  | { status: 'error'; message: string };

const getAttachmentsDirectory = (): Directory => {
  const directory = new Directory(Paths.document, ATTACHMENTS_DIRECTORY_NAME);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
};

/** Copies a picked file somewhere durable and builds its metadata record. */
const persistPickedFile = async (params: {
  sourceUri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
}): Promise<TaskAttachment> => {
  const { sourceUri, name, mimeType, size } = params;

  const id = createAttachmentId();
  const extension = getFileExtension(name || sourceUri);
  const destination = new File(getAttachmentsDirectory(), `${id}.${extension}`);

  await new File(sourceUri).copy(destination);

  return {
    id,
    uri: destination.uri,
    name: name || `attachment.${extension}`,
    kind: resolveAttachmentKind(mimeType, name || sourceUri),
    mimeType,
    // Prefer the size on disk; the picker's own value is missing on some devices.
    size: destination.exists ? destination.size : size,
    addedAt: new Date().toISOString(),
  };
};

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export const pickImagesFromLibrary = async (): Promise<AttachmentPickResult> => {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return {
        status: 'denied',
        message: permission.canAskAgain
          ? 'Photo access is needed to attach an image.'
          : 'Photo access is blocked. Enable it in system settings to attach images.',
      };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });

    if (result.canceled) return { status: 'cancelled' };

    const attachments = await Promise.all(
      result.assets.map((asset) =>
        persistPickedFile({
          sourceUri: asset.uri,
          name: asset.fileName ?? `photo.${getFileExtension(asset.uri, 'jpg')}`,
          mimeType: asset.mimeType ?? 'image/jpeg',
          size: asset.fileSize ?? null,
        })
      )
    );

    return { status: 'picked', attachments };
  } catch (error) {
    return { status: 'error', message: toErrorMessage(error, 'Could not attach that image.') };
  }
};

export const captureImageWithCamera = async (): Promise<AttachmentPickResult> => {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return {
        status: 'denied',
        message: permission.canAskAgain
          ? 'Camera access is needed to photograph the site.'
          : 'Camera access is blocked. Enable it in system settings to take photos.',
      };
    }

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return { status: 'cancelled' };

    const attachments = await Promise.all(
      result.assets.map((asset) =>
        persistPickedFile({
          sourceUri: asset.uri,
          name: asset.fileName ?? `site-photo.${getFileExtension(asset.uri, 'jpg')}`,
          mimeType: asset.mimeType ?? 'image/jpeg',
          size: asset.fileSize ?? null,
        })
      )
    );

    return { status: 'picked', attachments };
  } catch (error) {
    return { status: 'error', message: toErrorMessage(error, 'Could not open the camera.') };
  }
};

/** PDFs and other documents — the assignment's "a plus" on top of images. */
export const pickDocuments = async (): Promise<AttachmentPickResult> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*', 'text/plain'],
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (result.canceled) return { status: 'cancelled' };

    const attachments = await Promise.all(
      result.assets.map((asset) =>
        persistPickedFile({
          sourceUri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType ?? null,
          size: asset.size ?? null,
        })
      )
    );

    return { status: 'picked', attachments };
  } catch (error) {
    return { status: 'error', message: toErrorMessage(error, 'Could not attach that file.') };
  }
};

/**
 * Whether the file behind an attachment is still on disk. The detail screen uses
 * this to show a "file is no longer available" placeholder rather than a broken
 * image box when the user cleared app storage or restored a backup.
 */
export const attachmentFileExists = (attachment: TaskAttachment): boolean => {
  try {
    return new File(attachment.uri).exists;
  } catch {
    return false;
  }
};

/** Best-effort cleanup; a failed delete must never block removing the record. */
export const deleteAttachmentFile = (attachment: TaskAttachment): void => {
  try {
    const file = new File(attachment.uri);
    if (file.exists) file.delete();
  } catch (error) {
    logger.warn('[attachments] Could not delete file on disk.', error);
  }
};

export const deleteAttachmentFiles = (attachments: TaskAttachment[]): void => {
  attachments.forEach(deleteAttachmentFile);
};
