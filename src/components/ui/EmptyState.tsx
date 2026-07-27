import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** `error` swaps the accent to the danger tone for failure states. */
  tone?: 'neutral' | 'error';
}

/**
 * One component covers "nothing here yet", "nothing matched your filter" and
 * "that failed" — three states which otherwise get invented ad hoc per screen
 * and end up looking and sounding different.
 */
export const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  tone = 'neutral',
}: EmptyStateProps) => {
  const theme = useAppTheme();
  const accent = tone === 'error' ? theme.colors.danger : theme.colors.primary;
  const accentSoft = tone === 'error' ? theme.colors.dangerSoft : theme.colors.primarySoft;

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.xxl,
        gap: theme.spacing.sm,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: accentSoft,
        }}
      >
        <Ionicons name={icon} size={32} color={accent} />
      </View>

      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="body" color="textMuted" align="center">
        {description}
      </Text>

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant={tone === 'error' ? 'secondary' : 'primary'}
          style={{ marginTop: theme.spacing.xs }}
        />
      ) : null}
    </View>
  );
};
