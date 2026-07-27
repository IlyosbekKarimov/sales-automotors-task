import { View } from 'react-native';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';

export interface SectionProps extends PropsWithChildren {
  title?: string;
  action?: React.ReactNode;
  /** Wraps children in a bordered surface — used for grouped settings rows. */
  grouped?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Titled content group with consistent vertical rhythm. */
export const Section = ({ title, action, grouped = false, children, style }: SectionProps) => {
  const theme = useAppTheme();

  return (
    <View style={[{ gap: theme.spacing.xs }, style]}>
      {title || action ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: grouped ? theme.spacing.xxs : 0,
          }}
        >
          {title ? (
            <Text variant="overline" color="textSubtle" style={{ letterSpacing: 0.8 }}>
              {title.toUpperCase()}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}

      {grouped ? (
        <View
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            overflow: 'hidden',
            paddingVertical: theme.spacing.xxs,
          }}
        >
          {children}
        </View>
      ) : (
        children
      )}
    </View>
  );
};

export const Divider = () => {
  const theme = useAppTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: theme.colors.border,
        marginLeft: theme.spacing.md + 36 + theme.spacing.sm,
      }}
    />
  );
};
