import { Pressable, View } from 'react-native';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useAppTheme } from '@/context/ThemeContext';

export interface CardProps extends PropsWithChildren {
  onPress?: () => void;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * The surface every piece of content sits on. When `onPress` is supplied it
 * becomes a real button (role, label and press feedback included) rather than a
 * `View` with a touch handler bolted on.
 */
export const Card = ({
  children,
  onPress,
  padded = true,
  style,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) => {
  const theme = useAppTheme();

  const baseStyle: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: padded ? theme.spacing.md : 0,
    ...theme.shadow.card,
  };

  if (!onPress) {
    return <View style={[baseStyle, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        baseStyle,
        pressed && { backgroundColor: theme.colors.surfaceMuted, transform: [{ scale: 0.995 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};
