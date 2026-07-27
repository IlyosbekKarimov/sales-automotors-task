import { View } from 'react-native';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/context/ThemeContext';

export interface ScreenProps extends PropsWithChildren {
  /** Screens inside a navigator already clear the status bar; standalone ones do not. */
  edges?: { top?: boolean; bottom?: boolean };
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Screen shell: themed background plus safe-area handling in one place, so no
 * screen can end up with content under the notch or the gesture bar.
 */
export const Screen = ({ children, edges, padded = false, style }: ScreenProps) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme.colors.background,
          paddingTop: edges?.top ? insets.top : 0,
          paddingBottom: edges?.bottom ? insets.bottom : 0,
          paddingHorizontal: padded ? theme.layout.screenPadding : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};
