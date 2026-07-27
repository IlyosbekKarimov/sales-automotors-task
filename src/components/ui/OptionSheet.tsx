import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';

export interface SheetOption<TValue extends string> {
  value: TValue;
  label: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Overrides the icon/label colour, used for status options. */
  tint?: string;
  destructive?: boolean;
}

export interface OptionSheetProps<TValue extends string> {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: SheetOption<TValue>[];
  selectedValue?: TValue;
  onSelect: (value: TValue) => void;
  onClose: () => void;
}

/**
 * Bottom sheet used for every "pick one of these" interaction (status changes,
 * sorting, theme, preset locations, attachment source).
 *
 * It is a plain `Modal` rather than a gesture-driven sheet library: it needs no
 * Reanimated worklets, adds nothing to the APK, and behaves identically on every
 * Android version — which matters more here than a drag-to-dismiss handle.
 */
export const OptionSheet = <TValue extends string>({
  visible,
  title,
  subtitle,
  options,
  selectedValue,
  onSelect,
  onClose,
}: OptionSheetProps<TValue>) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close options"
        style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            paddingTop: theme.spacing.sm,
            paddingBottom: insets.bottom + theme.spacing.md,
            maxHeight: '80%',
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.colors.borderStrong,
              marginBottom: theme.spacing.sm,
            }}
          />

          <View style={{ paddingHorizontal: theme.spacing.md, gap: 2 }}>
            <Text variant="heading">{title}</Text>
            {subtitle ? (
              <Text variant="caption" color="textMuted">
                {subtitle}
              </Text>
            ) : null}
          </View>

          <ScrollView
            style={{ marginTop: theme.spacing.sm }}
            contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: theme.spacing.xxs }}
          >
            {options.map((option) => {
              const isSelected = option.value === selectedValue;
              const tint = option.destructive
                ? theme.colors.danger
                : (option.tint ?? theme.colors.text);

              return (
                <Pressable
                  key={option.value}
                  onPress={() => onSelect(option.value)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityHint={option.description}
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    minHeight: theme.layout.minTapTarget + 6,
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: theme.spacing.xs,
                    borderRadius: theme.radius.md,
                    backgroundColor: isSelected
                      ? theme.colors.primarySoft
                      : pressed
                        ? theme.colors.surfaceMuted
                        : 'transparent',
                  })}
                >
                  {option.icon ? <Ionicons name={option.icon} size={20} color={tint} /> : null}

                  <View style={{ flex: 1, gap: 1 }}>
                    <Text variant="bodyStrong" style={{ color: tint }}>
                      {option.label}
                    </Text>
                    {option.description ? (
                      <Text variant="caption" color="textMuted">
                        {option.description}
                      </Text>
                    ) : null}
                  </View>

                  {isSelected ? (
                    <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
