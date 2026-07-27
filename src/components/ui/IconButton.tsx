import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';

export interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Required: an icon with no label is invisible to a screen reader. */
  accessibilityLabel: string;
  color?: keyof ThemeColors;
  size?: number;
  variant?: 'plain' | 'soft';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const IconButton = ({
  icon,
  onPress,
  accessibilityLabel,
  color = 'text',
  size = 22,
  variant = 'plain',
  disabled = false,
  style,
}: IconButtonProps) => {
  const theme = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        {
          width: theme.layout.minTapTarget,
          height: theme.layout.minTapTarget,
          borderRadius: theme.radius.md,
          backgroundColor:
            variant === 'soft'
              ? theme.colors.surfaceMuted
              : pressed
                ? theme.colors.surfaceMuted
                : 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={theme.colors[color]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
