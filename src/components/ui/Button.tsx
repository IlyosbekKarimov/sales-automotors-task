import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

interface VariantColors {
  background: string;
  border: string;
  foreground: string;
  pressedBackground: string;
}

const resolveVariant = (variant: ButtonVariant, theme: AppTheme): VariantColors => {
  const { colors } = theme;
  switch (variant) {
    case 'primary':
      return {
        background: colors.primary,
        border: colors.primary,
        foreground: colors.onPrimary,
        pressedBackground: colors.primaryPressed,
      };
    case 'secondary':
      return {
        background: colors.surface,
        border: colors.borderStrong,
        foreground: colors.text,
        pressedBackground: colors.surfaceMuted,
      };
    case 'ghost':
      return {
        background: 'transparent',
        border: 'transparent',
        foreground: colors.primary,
        pressedBackground: colors.primarySoft,
      };
    case 'danger':
      return {
        background: colors.danger,
        border: colors.danger,
        foreground: '#FFFFFF',
        pressedBackground: colors.dangerPressed,
      };
  }
};

/**
 * Buttons are always at least 48dp tall and always expose an accessibility role
 * and state, so the whole app clears the tap-target and screen-reader baseline
 * without every screen having to remember to.
 */
export const Button = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  accessibilityHint,
}: ButtonProps) => {
  const theme = useAppTheme();
  const palette = resolveVariant(variant, theme);
  const isInteractive = !disabled && !loading;
  const height = size === 'lg' ? 56 : theme.layout.minTapTarget;

  const iconNode = icon ? (
    <Ionicons name={icon} size={size === 'lg' ? 20 : 18} color={palette.foreground} />
  ) : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!isInteractive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal: size === 'lg' ? theme.spacing.lg : theme.spacing.md,
          borderRadius: theme.radius.md,
          borderColor: palette.border,
          backgroundColor:
            pressed && isInteractive ? palette.pressedBackground : palette.background,
          opacity: isInteractive ? 1 : 0.45,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.foreground} />
      ) : (
        <View style={[styles.content, { gap: theme.spacing.xs }]}>
          {iconPosition === 'left' ? iconNode : null}
          <Text
            variant={size === 'lg' ? 'subheading' : 'bodyStrong'}
            style={{ color: palette.foreground }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {iconPosition === 'right' ? iconNode : null}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
