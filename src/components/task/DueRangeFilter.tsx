import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { OptionSheet } from '@/components/ui/OptionSheet';
import type { SheetOption } from '@/components/ui/OptionSheet';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';
import { DUE_RANGE_PRESETS } from '@/types';
import type { DueRange, DueRangePreset } from '@/types';
import { formatDate, parseIso } from '@/utils/date.utils';
import { DEFAULT_DUE_RANGE, DUE_RANGE_LABELS, describeDueRange } from '@/utils/task.utils';

interface DueRangeFilterProps {
  value: DueRange;
  onChange: (range: DueRange) => void;
}

const PRESET_ICONS: Record<DueRangePreset, keyof typeof Ionicons.glyphMap> = {
  any: 'infinite-outline',
  overdue: 'alert-circle-outline',
  today: 'today-outline',
  next7: 'calendar-outline',
  next30: 'calendar-number-outline',
  custom: 'options-outline',
};

const PRESET_OPTIONS: SheetOption<DueRangePreset>[] = DUE_RANGE_PRESETS.map((preset) => ({
  value: preset,
  label: DUE_RANGE_LABELS[preset],
  icon: PRESET_ICONS[preset],
}));

interface BoundButtonProps {
  label: string;
  value: string | null;
  onPick: (iso: string | null) => void;
}

const BoundButton = ({ label, value, onPick }: BoundButtonProps) => {
  const theme = useAppTheme();
  const [isIosPickerOpen, setIosPickerOpen] = useState(false);
  const current = (value ? parseIso(value) : null) ?? new Date();

  const open = () => {
    if (Platform.OS !== 'android') return setIosPickerOpen(true);

    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      onChange: (event: DateTimePickerEvent, selected?: Date) => {
        if (event.type === 'set' && selected) onPick(selected.toISOString());
      },
    });
  };

  return (
    <View style={{ flex: 1, gap: theme.spacing.xxs }}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>

      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : 'not set'}`}
        style={({ pressed }) => ({
          minHeight: theme.layout.minTapTarget,
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.md,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
        })}
      >
        <Text variant="bodyStrong" color={value ? 'text' : 'textSubtle'}>
          {value ? formatDate(value) : 'Any'}
        </Text>
      </Pressable>

      {value ? (
        <Pressable onPress={() => onPick(null)} accessibilityRole="button" hitSlop={8}>
          <Text variant="caption" color="primary">
            Clear
          </Text>
        </Pressable>
      ) : null}

      {isIosPickerOpen ? (
        <Modal visible transparent animationType="slide">
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
              <Text variant="heading">{label}</Text>
              <DateTimePicker
                value={current}
                mode="date"
                display="spinner"
                onChange={(_event, selected) => selected && onPick(selected.toISOString())}
              />
              <Button label="Done" onPress={() => setIosPickerOpen(false)} fullWidth />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
};

/**
 * Due-date filter: presets for the common cases, plus an explicit custom range.
 *
 * Presets are stored as the preset name rather than as resolved dates, so
 * "Today" keeps meaning today if the screen is left open past midnight.
 */
export const DueRangeFilter = ({ value, onChange }: DueRangeFilterProps) => {
  const theme = useAppTheme();
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isCustomOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<DueRange>(value);

  const selectPreset = (preset: DueRangePreset) => {
    setSheetOpen(false);

    if (preset !== 'custom') return onChange({ preset, from: null, to: null });

    setDraft({ preset: 'custom', from: value.from, to: value.to });
    setCustomOpen(true);
  };

  return (
    <>
      <Chip
        label={describeDueRange(value)}
        icon="calendar-outline"
        selected={value.preset !== 'any'}
        onPress={() => setSheetOpen(true)}
      />

      <OptionSheet
        visible={isSheetOpen}
        title="Filter by due date"
        subtitle="Presets follow the clock; a custom range is fixed"
        options={PRESET_OPTIONS}
        selectedValue={value.preset}
        onSelect={selectPreset}
        onClose={() => setSheetOpen(false)}
      />

      <Modal
        visible={isCustomOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.overlay,
            justifyContent: 'center',
            padding: theme.spacing.lg,
          }}
        >
          <View
            style={{
              gap: theme.spacing.sm,
              padding: theme.spacing.lg,
              borderRadius: theme.radius.xl,
              backgroundColor: theme.colors.surface,
              ...theme.shadow.floating,
            }}
          >
            <Text variant="heading">Custom date range</Text>
            <Text variant="caption" color="textMuted">
              Leave either side empty for an open-ended range. Both days are included.
            </Text>

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <BoundButton
                label="From"
                value={draft.from}
                onPick={(from) => setDraft((current) => ({ ...current, from }))}
              />
              <BoundButton
                label="To"
                value={draft.to}
                onPick={(to) => setDraft((current) => ({ ...current, to }))}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
              <Button
                label="Clear"
                variant="ghost"
                onPress={() => {
                  onChange(DEFAULT_DUE_RANGE);
                  setCustomOpen(false);
                }}
              />
              <View style={{ flex: 1 }} />
              <Button label="Cancel" variant="secondary" onPress={() => setCustomOpen(false)} />
              <Button
                label="Apply"
                onPress={() => {
                  // Tolerate a reversed pair rather than rejecting it.
                  const flipped =
                    draft.from && draft.to && new Date(draft.from) > new Date(draft.to);
                  onChange(flipped ? { preset: 'custom', from: draft.to, to: draft.from } : draft);
                  setCustomOpen(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};
