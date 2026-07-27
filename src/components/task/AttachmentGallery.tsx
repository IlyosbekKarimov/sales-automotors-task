import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';
import { attachmentFileExists } from '@/services/attachment.service';
import type { TaskAttachment } from '@/types';
import { formatFileSize } from '@/utils/format.utils';

interface AttachmentGalleryProps {
  attachments: TaskAttachment[];
  /** Omit to render read-only (used on the form preview). */
  onRemove?: (attachmentId: string) => void;
  emptyHint?: string;
}

const TILE_SIZE = 104;

const KIND_ICONS: Record<TaskAttachment['kind'], keyof typeof Ionicons.glyphMap> = {
  image: 'image-outline',
  pdf: 'document-text-outline',
  file: 'document-outline',
};

interface TileProps {
  attachment: TaskAttachment;
  onRemove?: (attachmentId: string) => void;
  onOpen: (attachment: TaskAttachment) => void;
}

/**
 * A single attachment tile.
 *
 * Missing files are the interesting case: the app copies picked files into its
 * own document directory, but a restored backup, a cleared app storage or a
 * hand-edited sync payload can still leave a record pointing at nothing. Rather
 * than rendering a broken image box, the tile checks the file up front and falls
 * back to a labelled "unavailable" state that can still be removed.
 */
const AttachmentTile = ({ attachment, onRemove, onOpen }: TileProps) => {
  const theme = useAppTheme();
  const [didImageFail, setDidImageFail] = useState(false);

  // Sync native call — memoised so it runs once per attachment, not once per render.
  const existsOnDisk = useMemo(() => attachmentFileExists(attachment), [attachment]);
  const isUnavailable = !existsOnDisk || didImageFail;
  const isRenderableImage = attachment.kind === 'image' && !isUnavailable;

  return (
    <View style={{ width: TILE_SIZE, gap: 4 }}>
      <Pressable
        onPress={() => onOpen(attachment)}
        disabled={isUnavailable}
        accessibilityRole="button"
        accessibilityLabel={
          isUnavailable
            ? `${attachment.name}, file unavailable`
            : `${attachment.name}, ${formatFileSize(attachment.size)}`
        }
        accessibilityHint={isRenderableImage ? 'Opens a full-screen preview' : undefined}
        style={{
          width: TILE_SIZE,
          height: TILE_SIZE,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: isUnavailable ? theme.colors.danger : theme.colors.border,
          backgroundColor: isUnavailable ? theme.colors.dangerSoft : theme.colors.surfaceMuted,
        }}
      >
        {isRenderableImage ? (
          <Image
            source={{ uri: attachment.uri }}
            resizeMode="cover"
            onError={() => setDidImageFail(true)}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View style={{ alignItems: 'center', gap: 4, padding: theme.spacing.xs }}>
            <Ionicons
              name={isUnavailable ? 'alert-circle-outline' : KIND_ICONS[attachment.kind]}
              size={26}
              color={isUnavailable ? theme.colors.danger : theme.colors.textMuted}
            />
            <Text
              variant="caption"
              color={isUnavailable ? 'danger' : 'textMuted'}
              align="center"
              numberOfLines={2}
            >
              {isUnavailable ? 'Unavailable' : attachment.kind.toUpperCase()}
            </Text>
          </View>
        )}

        {onRemove ? (
          <Pressable
            onPress={() => onRemove(attachment.id)}
            accessibilityRole="button"
            accessibilityLabel={`Remove attachment ${attachment.name}`}
            hitSlop={8}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.overlay,
            }}
          >
            <Ionicons name="close" size={16} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </Pressable>

      <Text variant="caption" color="textMuted" numberOfLines={1}>
        {attachment.name}
      </Text>
      <Text variant="caption" color="textSubtle">
        {isUnavailable ? 'File missing' : formatFileSize(attachment.size)}
      </Text>
    </View>
  );
};

export const AttachmentGallery = ({
  attachments,
  onRemove,
  emptyHint = 'No attachments yet.',
}: AttachmentGalleryProps) => {
  const theme = useAppTheme();
  const [preview, setPreview] = useState<TaskAttachment | null>(null);

  if (attachments.length === 0) {
    return (
      <Text variant="caption" color="textSubtle">
        {emptyHint}
      </Text>
    );
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: 2 }}
      >
        {attachments.map((attachment) => (
          <AttachmentTile
            key={attachment.id}
            attachment={attachment}
            onRemove={onRemove}
            onOpen={setPreview}
          />
        ))}
      </ScrollView>

      <Modal
        visible={preview !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: theme.spacing.xxl,
              paddingHorizontal: theme.spacing.md,
            }}
          >
            <Text variant="bodyStrong" style={{ color: '#FFFFFF', flex: 1 }} numberOfLines={1}>
              {preview?.name}
            </Text>
            {/* Fixed white on the dark preview backdrop, so it ignores the theme. */}
            <Pressable
              onPress={() => setPreview(null)}
              accessibilityRole="button"
              accessibilityLabel="Close preview"
              hitSlop={8}
              style={{
                width: theme.layout.minTapTarget,
                height: theme.layout.minTapTarget,
                borderRadius: theme.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.14)',
              }}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: theme.spacing.md,
            }}
          >
            {preview?.kind === 'image' ? (
              <Image
                source={{ uri: preview.uri }}
                resizeMode="contain"
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
                <Ionicons name="document-text-outline" size={64} color="#FFFFFF" />
                <Text variant="body" style={{ color: '#FFFFFF' }} align="center">
                  {preview?.name}
                </Text>
                <Text variant="caption" style={{ color: '#C9D2E0' }} align="center">
                  Preview is available for images. This file is stored with the task and syncs with
                  it.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};
