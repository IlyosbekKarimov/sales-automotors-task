import type { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Rendered to the left of the theme toggle. */
  actions?: React.ReactNode;
  showThemeToggle?: boolean;
}

const THEME_ICONS = {
  light: 'sunny-outline',
  dark: 'moon-outline',
  system: 'phone-portrait-outline',
} as const satisfies Record<string, keyof typeof Ionicons.glyphMap>;

const THEME_LABELS = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
} as const;

/**
 * Custom header used instead of the stack's built-in one, so the theme toggle is
 * reachable from every top-level screen and the title/subtitle pair can carry
 * live counts.
 */
export const ScreenHeader = ({
  title,
  subtitle,
  onBack,
  actions,
  showThemeToggle = true,
}: ScreenHeaderProps) => {
  const { theme, preference, cyclePreference } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top + theme.spacing.xs,
        paddingBottom: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        backgroundColor: theme.colors.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xxs,
      }}
    >
      {onBack ? (
        <IconButton icon="arrow-back" accessibilityLabel="Go back" onPress={onBack} />
      ) : null}

      <View style={{ flex: 1, paddingHorizontal: onBack ? 0 : theme.spacing.xs, gap: 1 }}>
        <Text variant="title" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actions}

      {showThemeToggle ? (
        <IconButton
          icon={THEME_ICONS[preference]}
          accessibilityLabel={`${THEME_LABELS[preference]}. Tap to change.`}
          onPress={cyclePreference}
        />
      ) : null}
    </View>
  );
};
