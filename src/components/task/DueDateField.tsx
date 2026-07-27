import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';
import { combineDateAndTime, formatDate, formatRelative, formatTime } from '@/utils/date.utils';

interface DueDateFieldProps {
  value: Date;
  onChange: (next: Date) => void;
  error?: string;
}

/**
 * Execution date + time picker.
 *
 * Android and iOS get genuinely different treatment because the platforms differ:
 * Android opens the native dialogs imperatively (date, then time), while iOS
 * needs the picker mounted inside a modal with an explicit confirm button. One
 * shared `<DateTimePicker>` render path would misbehave on one of the two.
 */
export const DueDateField = ({ value, onChange, error }: DueDateFieldProps) => {
  const theme = useAppTheme();
  const [iosPicker, setIosPicker] = useState<'date' | 'time' | null>(null);
  const [iosDraft, setIosDraft] = useState<Date>(value);

  const openAndroidDate = () => {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      onChange: (event: DateTimePickerEvent, selected?: Date) => {
        if (event.type !== 'set' || !selected) return;
        // Preserve the time the user already chose when only the day changes.
        onChange(combineDateAndTime(selected, value));
      },
    });
  };

  const openAndroidTime = () => {
    DateTimePickerAndroid.open({
      value,
      mode: 'time',
      is24Hour: true,
      onChange: (event: DateTimePickerEvent, selected?: Date) => {
        if (event.type !== 'set' || !selected) return;
        onChange(combineDateAndTime(value, selected));
      },
    });
  };

  const openPicker = (mode: 'date' | 'time') => {
    if (Platform.OS === 'android') {
      if (mode === 'date') openAndroidDate();
      else openAndroidTime();
      return;
    }
    setIosDraft(value);
    setIosPicker(mode);
  };

  const confirmIos = () => {
    onChange(
      iosPicker === 'date'
        ? combineDateAndTime(iosDraft, value)
        : combineDateAndTime(value, iosDraft)
    );
    setIosPicker(null);
  };

  const borderColor = error ? theme.colors.danger : theme.colors.border;

  const trigger = (params: {
    label: string;
    display: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={params.onPress}
      accessibilityRole="button"
      accessibilityLabel={`${params.label}: ${params.display}`}
      accessibilityHint="Opens a picker"
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        minHeight: theme.layout.minTapTarget,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.md,
        borderWidth: 1.5,
        borderColor,
        backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
      })}
    >
      <Ionicons name={params.icon} size={18} color={theme.colors.textSubtle} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" color="textSubtle">
          {params.label}
        </Text>
        <Text variant="bodyStrong" numberOfLines={1}>
          {params.display}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <Text variant="caption" color="textMuted">
        Execution date and time
        <Text variant="caption" color="danger">
          {' '}
          *
        </Text>
      </Text>

      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        {trigger({
          label: 'Date',
          display: formatDate(value.toISOString()),
          icon: 'calendar-outline',
          onPress: () => openPicker('date'),
        })}
        {trigger({
          label: 'Time',
          display: formatTime(value.toISOString()),
          icon: 'time-outline',
          onPress: () => openPicker('time'),
        })}
      </View>

      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="alert-circle" size={14} color={theme.colors.danger} />
          <Text variant="caption" color="danger">
            {error}
          </Text>
        </View>
      ) : (
        <Text variant="caption" color="textSubtle">
          Due {formatRelative(value.toISOString())}. A reminder is scheduled 30 minutes before.
        </Text>
      )}

      {Platform.OS === 'ios' && iosPicker ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setIosPicker(null)}>
          <View
            style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }}
          >
            <View
              style={{
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.md,
                borderTopLeftRadius: theme.radius.xl,
                borderTopRightRadius: theme.radius.xl,
                gap: theme.spacing.sm,
              }}
            >
              <Text variant="heading">
                {iosPicker === 'date' ? 'Choose a date' : 'Choose a time'}
              </Text>
              <DateTimePicker
                value={iosDraft}
                mode={iosPicker}
                display="spinner"
                onChange={(_event, selected) => selected && setIosDraft(selected)}
              />
              <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => setIosPicker(null)}
                  style={{ flex: 1 }}
                />
                <Button label="Confirm" onPress={confirmIos} style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
};
