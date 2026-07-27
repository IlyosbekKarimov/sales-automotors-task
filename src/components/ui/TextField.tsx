import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Rendered under the field when set; also flips the border to the danger tone. */
  error?: string;
  helper?: string;
  required?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Shows a live `n / max` counter — useful on the description field. */
  maxLength?: number;
  showCounter?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  /** Extra styling for the `TextInput` itself, e.g. a taller multiline box. */
  inputStyle?: StyleProp<TextStyle>;
}

/**
 * Labelled text input with inline validation messaging.
 *
 * The error is wired to `accessibilityLabel` on the input as well as being shown
 * visually, so a screen-reader user is told *why* a field is rejected rather
 * than just hearing an unlabelled text box.
 */
export const TextField = ({
  label,
  error,
  helper,
  required = false,
  icon,
  maxLength,
  showCounter = false,
  containerStyle,
  inputStyle,
  value,
  multiline,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) => {
  const theme = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : isFocused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={[{ gap: theme.spacing.xxs }, containerStyle]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="textMuted">
          {label}
          {required ? (
            <Text variant="caption" color="danger">
              {' '}
              *
            </Text>
          ) : null}
        </Text>
        {showCounter && maxLength ? (
          <Text variant="caption" color="textSubtle">
            {(value ?? '').length} / {maxLength}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: theme.spacing.xs,
          minHeight: theme.layout.minTapTarget,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: multiline ? theme.spacing.sm : 0,
          borderRadius: theme.radius.md,
          borderWidth: 1.5,
          borderColor,
          backgroundColor: theme.colors.surface,
        }}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={error ? theme.colors.danger : theme.colors.textSubtle}
            style={{ marginTop: multiline ? 2 : 0 }}
          />
        ) : null}
        <TextInput
          {...rest}
          value={value}
          multiline={multiline}
          maxLength={maxLength}
          accessibilityLabel={error ? `${label}. Error: ${error}` : label}
          placeholderTextColor={theme.colors.textSubtle}
          maxFontSizeMultiplier={1.4}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          style={[
            {
              flex: 1,
              color: theme.colors.text,
              fontSize: theme.typography.body.fontSize,
              lineHeight: multiline ? theme.typography.body.lineHeight : undefined,
              paddingVertical: multiline ? 0 : theme.spacing.sm,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            inputStyle,
          ]}
        />
      </View>

      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="alert-circle" size={14} color={theme.colors.danger} />
          <Text variant="caption" color="danger" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text variant="caption" color="textSubtle">
          {helper}
        </Text>
      ) : null}
    </View>
  );
};
