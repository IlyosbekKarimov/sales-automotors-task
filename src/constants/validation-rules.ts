/**
 * Separate from `config.ts` so the validation layer imports nothing from React
 * Native and its tests can run in a plain Node environment.
 */
export const VALIDATION_RULES = {
  TITLE_MIN: 3,
  TITLE_MAX: 80,
  DESCRIPTION_MIN: 10,
  DESCRIPTION_MAX: 1_000,
  ADDRESS_MIN: 5,
  ADDRESS_MAX: 160,
  LATITUDE_MIN: -90,
  LATITUDE_MAX: 90,
  LONGITUDE_MIN: -180,
  LONGITUDE_MAX: 180,
} as const;
