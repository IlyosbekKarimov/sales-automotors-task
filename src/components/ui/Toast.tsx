import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  message: string;
  title?: string;
  variant: ToastVariant;
  durationMs: number;
  actionLabel?: string;
  onAction?: () => void;
}

const ICONS: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  warning: 'warning',
  info: 'information-circle',
};

interface ToastProps {
  toast: ToastData;
  onDismiss: () => void;
}

/**
 * Top-anchored transient message.
 *
 * It is rendered once by `ToastProvider` rather than per screen, so feedback
 * survives navigation — saving a task and immediately going back still shows the
 * confirmation. `Animated` with `useNativeDriver` keeps it off the JS thread.
 */
export const Toast = ({ toast, onDismiss }: ToastProps) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  const tone = {
    success: { fg: theme.colors.success, bg: theme.colors.successSoft },
    error: { fg: theme.colors.danger, bg: theme.colors.dangerSoft },
    warning: { fg: theme.colors.warning, bg: theme.colors.warningSoft },
    info: { fg: theme.colors.info, bg: theme.colors.infoSoft },
  }[toast.variant];

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onDismiss();
      });
    }, toast.durationMs);

    return () => clearTimeout(timer);
    // Re-running on a new toast id is exactly the intent: restart the animation.
  }, [toast.id, toast.durationMs, progress, onDismiss]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + theme.spacing.xs,
        left: theme.spacing.md,
        right: theme.spacing.md,
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
        ],
      }}
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole="alert"
        accessibilityLabel={`${toast.title ? `${toast.title}. ` : ''}${toast.message}`}
        accessibilityHint="Tap to dismiss"
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: theme.spacing.xs,
          padding: theme.spacing.sm,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: tone.fg,
          backgroundColor: tone.bg,
          ...theme.shadow.floating,
        }}
      >
        <Ionicons name={ICONS[toast.variant]} size={20} color={tone.fg} />

        <View style={{ flex: 1, gap: 2 }}>
          {toast.title ? (
            <Text variant="bodyStrong" style={{ color: tone.fg }}>
              {toast.title}
            </Text>
          ) : null}
          <Text variant="caption" style={{ color: theme.colors.text }}>
            {toast.message}
          </Text>
        </View>

        {toast.actionLabel && toast.onAction ? (
          <Pressable
            onPress={() => {
              toast.onAction?.();
              onDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={toast.actionLabel}
            hitSlop={8}
          >
            <Text variant="caption" style={{ color: tone.fg, textDecorationLine: 'underline' }}>
              {toast.actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
};
