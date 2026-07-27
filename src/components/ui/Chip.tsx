import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Toggleable filter/sort chip. Uses `accessibilityState.selected` so a screen
 * reader announces the toggle state instead of just the label.
 */
export const Chip = ({ label, selected, onPress, icon, count, style }: ChipProps) => {
  const theme = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: 38,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.pill,
          borderWidth: 1,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected
            ? theme.colors.primarySoft
            : pressed
              ? theme.colors.surfaceMuted
              : theme.colors.surface,
        },
        style,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={15}
          color={selected ? theme.colors.primary : theme.colors.textMuted}
        />
      ) : null}
      <Text variant="caption" color={selected ? 'primary' : 'textMuted'}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="caption" color={selected ? 'primary' : 'textSubtle'}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
};
