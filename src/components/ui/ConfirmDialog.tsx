import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Themed replacement for `Alert.alert` on destructive actions.
 *
 * The cancel button is listed first and the destructive one is clearly coloured,
 * so the safe choice is the easy one — deleting a task with photos attached
 * should take a deliberate second tap.
 */
export const ConfirmDialog = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  icon = 'alert-circle',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const theme = useAppTheme();
  const accent = tone === 'danger' ? theme.colors.danger : theme.colors.primary;
  const accentSoft = tone === 'danger' ? theme.colors.dangerSoft : theme.colors.primarySoft;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Dismiss dialog"
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.lg,
        }}
      >
        {/* Swallows taps so pressing inside the card does not dismiss it. */}
        <Pressable
          onPress={() => undefined}
          style={{
            width: '100%',
            maxWidth: 420,
            gap: theme.spacing.sm,
            padding: theme.spacing.lg,
            borderRadius: theme.radius.xl,
            backgroundColor: theme.colors.surface,
            ...theme.shadow.floating,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: accentSoft,
            }}
          >
            <Ionicons name={icon} size={24} color={accent} />
          </View>

          <Text variant="heading">{title}</Text>
          <Text variant="body" color="textMuted">
            {message}
          </Text>

          <View
            style={{ flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.xs }}
          >
            <Button
              label={cancelLabel}
              onPress={onCancel}
              variant="secondary"
              style={{ flex: 1 }}
              disabled={loading}
            />
            <Button
              label={confirmLabel}
              onPress={onConfirm}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              style={{ flex: 1 }}
              loading={loading}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
