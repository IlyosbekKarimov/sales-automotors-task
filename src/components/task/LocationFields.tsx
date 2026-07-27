import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { OptionSheet } from '@/components/ui/OptionSheet';
import type { SheetOption } from '@/components/ui/OptionSheet';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { MAP_CONFIG } from '@/constants/config';
import { useAppTheme } from '@/context/ThemeContext';

export interface LocationFieldsValue {
  address: string;
  latitude: string;
  longitude: string;
}

interface LocationFieldsProps {
  value: LocationFieldsValue;
  errors: Partial<Record<keyof LocationFieldsValue, string>>;
  onChange: (patch: Partial<LocationFieldsValue>) => void;
}

const PRESET_OPTIONS: SheetOption<string>[] = MAP_CONFIG.PRESET_LOCATIONS.map((preset) => ({
  value: preset.label,
  label: preset.label,
  description: preset.address,
  icon: 'business-outline',
}));

/**
 * Location capture. Manual address entry is the required path; coordinates are
 * optional and drive the map screen.
 *
 * Real geocoding is out of scope (and would need a keyed service), so the preset
 * list is the shortcut: picking a known site fills the address *and* its
 * coordinates in one tap, which is how a field worker actually enters a
 * recurring depot or client site.
 */
export const LocationFields = ({ value, errors, onChange }: LocationFieldsProps) => {
  const theme = useAppTheme();
  const [isPresetSheetOpen, setPresetSheetOpen] = useState(false);

  const applyPreset = (label: string) => {
    const preset = MAP_CONFIG.PRESET_LOCATIONS.find((entry) => entry.label === label);
    setPresetSheetOpen(false);
    if (!preset) return;

    onChange({
      address: preset.address,
      latitude: String(preset.latitude),
      longitude: String(preset.longitude),
    });
  };

  const hasCoordinates = value.latitude.trim() !== '' || value.longitude.trim() !== '';

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <TextField
        label="Location address"
        required
        icon="location-outline"
        value={value.address}
        onChangeText={(address) => onChange({ address })}
        error={errors.address}
        placeholder="Street, building, city"
        maxLength={160}
        autoCapitalize="words"
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'center' }}>
        <Button
          label="Use a saved site"
          icon="bookmark-outline"
          variant="secondary"
          onPress={() => setPresetSheetOpen(true)}
        />
        {hasCoordinates ? (
          <Button
            label="Clear pin"
            icon="close-circle-outline"
            variant="ghost"
            onPress={() => onChange({ latitude: '', longitude: '' })}
          />
        ) : null}
      </View>

      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="caption" color="textMuted">
          Map coordinates (optional)
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
          <TextField
            label="Latitude"
            value={value.latitude}
            onChangeText={(latitude) => onChange({ latitude })}
            error={errors.latitude}
            placeholder="41.311081"
            keyboardType="numbers-and-punctuation"
            containerStyle={{ flex: 1 }}
          />
          <TextField
            label="Longitude"
            value={value.longitude}
            onChangeText={(longitude) => onChange({ longitude })}
            error={errors.longitude}
            placeholder="69.240562"
            keyboardType="numbers-and-punctuation"
            containerStyle={{ flex: 1 }}
          />
        </View>
        {!errors.latitude && !errors.longitude ? (
          <Text variant="caption" color="textSubtle">
            Add both values to place this task on the Map tab.
          </Text>
        ) : null}
      </View>

      <OptionSheet
        visible={isPresetSheetOpen}
        title="Saved sites"
        subtitle="Fills the address and map pin in one tap"
        options={PRESET_OPTIONS}
        onSelect={applyPreset}
        onClose={() => setPresetSheetOpen(false)}
      />
    </View>
  );
};
