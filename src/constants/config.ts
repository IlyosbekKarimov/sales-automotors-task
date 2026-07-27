import { Platform } from 'react-native';

/**
 * Emulators cannot reach the host machine on `localhost`, so each platform gets a
 * sensible default. Anything real is expected to come from `EXPO_PUBLIC_MOCK_API_URL`
 * (see `.env.example`) or from the runtime override on the Settings screen, which is
 * the only practical way to repoint an already-built release APK at a laptop's LAN IP.
 */
const DEFAULT_MOCK_API_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  ios: 'http://localhost:3000',
  default: 'http://localhost:3000',
});

export const APP_CONFIG = {
  CANDIDATE_CODE: 'SA-RN-2026-ILYOS',
  APP_NAME: 'Field Task Manager',
  APP_TAGLINE: 'Plan, track and review field work — online or off.',
  AUTHOR: 'Ilyosbek Karimov',
  VERSION: '1.0.0',
  MOCK_API_URL: process.env.EXPO_PUBLIC_MOCK_API_URL ?? DEFAULT_MOCK_API_URL,
  REQUEST_TIMEOUT_MS: 8_000,
} as const;

export const NOTIFICATION_CONFIG = {
  LEAD_TIME_MINUTES: 30,
  DEMO_DELAY_SECONDS: 35,
  /**
   * Fallback used when a task is due in under `LEAD_TIME_MINUTES`: rather than
   * silently dropping the reminder, fire it shortly after saving.
   */
  IMMINENT_FALLBACK_SECONDS: 10,
  ANDROID_CHANNEL_ID: 'task-reminders',
  ANDROID_CHANNEL_NAME: 'Task reminders',
} as const;

export const MAP_CONFIG = {
  /** Centre of the map when no task has coordinates yet (Tashkent). */
  FALLBACK_REGION: { latitude: 41.311081, longitude: 69.240562, zoom: 11 },
  /** Offered in the form so a technician can pin a site without typing coordinates. */
  PRESET_LOCATIONS: [
    {
      label: 'Tashkent — Head Office',
      address: 'Amir Temur Ave 107B, Tashkent',
      latitude: 41.311081,
      longitude: 69.240562,
    },
    {
      label: 'Tashkent — Yunusabad Depot',
      address: 'Yunusabad District, Tashkent',
      latitude: 41.363,
      longitude: 69.289,
    },
    {
      label: 'Samarkand — Service Point',
      address: 'Registan St 12, Samarkand',
      latitude: 39.654,
      longitude: 66.975,
    },
    {
      label: 'Bukhara — Client Site',
      address: 'Bahouddin Naqshband St 4, Bukhara',
      latitude: 39.767,
      longitude: 64.421,
    },
    {
      label: 'Namangan — Warehouse',
      address: 'Uychi St 30, Namangan',
      latitude: 40.998,
      longitude: 71.672,
    },
  ],
} as const;

export { VALIDATION_RULES } from '@/constants/validation-rules';
