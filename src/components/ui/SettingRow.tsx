import { Ionicons } from '@expo/vector-icons';
import { Pressable, Switch, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';

interface BaseProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  disabled?: boolean;
}

interface ToggleRowProps extends BaseProps {
  kind: 'toggle';
  value: boolean;
  onValueChange: (value: boolean) => void;
}

interface NavigationRowProps extends BaseProps {
  kind: 'navigation';
  value?: string;
  onPress: () => void;
  destructive?: boolean;
}

export type SettingRowProps = ToggleRowProps | NavigationRowProps;

/**
 * One row shape for the whole Settings screen, so switches and drill-downs share
 * spacing, icon treatment and tap-target height instead of drifting apart.
 */
export const SettingRow = (props: SettingRowProps) => {
  const theme = useAppTheme();
  const { icon, title, description, disabled = false } = props;
  const isDestructive = props.kind === 'navigation' && props.destructive === true;
  const tint = isDestructive ? theme.colors.danger : theme.colors.primary;

  const content = (
    <>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: theme.radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDestructive ? theme.colors.dangerSoft : theme.colors.primarySoft,
        }}
      >
        <Ionicons name={icon} size={18} color={tint} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" color={isDestructive ? 'danger' : 'text'}>
          {title}
        </Text>
        {description ? (
          <Text variant="caption" color="textMuted">
            {description}
          </Text>
        ) : null}
      </View>

      {props.kind === 'toggle' ? (
        <Switch
          value={props.value}
          onValueChange={props.onValueChange}
          disabled={disabled}
          accessibilityLabel={title}
          trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
          thumbColor={theme.colors.surface}
        />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {props.value ? (
            <Text variant="caption" color="textMuted" numberOfLines={1} style={{ maxWidth: 130 }}>
              {props.value}
            </Text>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
        </View>
      )}
    </>
  );

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTapTarget + 8,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    opacity: disabled ? 0.5 : 1,
  };

  if (props.kind === 'toggle') {
    return (
      <View accessible accessibilityLabel={title} accessibilityHint={description} style={rowStyle}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={props.onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: theme.colors.surfaceMuted }]}
    >
      {content}
    </Pressable>
  );
};
