import { Text as RNText } from 'react-native';
import type { StyleProp, TextProps, TextStyle } from 'react-native';

import type { ThemeColors } from '@/constants/theme';
import { typography } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';

export type TextVariant = keyof typeof typography;

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  /** Token name rather than a hex value, so text can never miss a theme change. */
  color?: keyof ThemeColors;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
}

/**
 * The app's only text primitive. `maxFontSizeMultiplier` honours the system font
 * setting while stopping the largest sizes from breaking layouts.
 */
export const Text = ({
  variant = 'body',
  color = 'text',
  align,
  style,
  children,
  ...rest
}: AppTextProps) => {
  const theme = useAppTheme();

  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[typography[variant], { color: theme.colors[color], textAlign: align }, style]}
    >
      {children}
    </RNText>
  );
};
