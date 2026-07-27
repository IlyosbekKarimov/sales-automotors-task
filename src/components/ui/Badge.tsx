import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';

export interface BadgeProps {
  label: string;
  /** Foreground/background pair, normally from `getStatusTone` / `getSyncTone`. */
  tone: { fg: string; bg: string };
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

/** Compact status pill. Always pairs colour with a text label — never colour alone. */
export const Badge = ({ label, tone, icon, style }: BadgeProps) => {
  const theme = useAppTheme();

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          backgroundColor: tone.bg,
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: 4,
          borderRadius: theme.radius.pill,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={tone.fg} /> : null}
      <Text variant="caption" style={{ color: tone.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};
