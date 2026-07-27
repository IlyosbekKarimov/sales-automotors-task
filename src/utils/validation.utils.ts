import { VALIDATION_RULES } from '@/constants/validation-rules';
import type { ValidationResult } from '@/types';
import { isValidIso } from '@/utils/date.utils';

/**
 * Form validation lives here rather than inside the screen so it can be unit
 * tested without rendering anything, and so the same rules guard both the form
 * and any programmatic task creation.
 *
 * Messages are written for a technician, not a developer: they say what to do
 * next ("Add at least 10 characters") instead of naming the constraint.
 */

/** The form keeps coordinates as raw text, so they get their own field keys. */
export interface TaskFormShape {
  title: string;
  description: string;
  dueDate: string;
  address: string;
  latitude: string;
  longitude: string;
}

export const validateTitle = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Title is required.';
  if (trimmed.length < VALIDATION_RULES.TITLE_MIN) {
    return `Use at least ${VALIDATION_RULES.TITLE_MIN} characters so the task is recognisable.`;
  }
  if (trimmed.length > VALIDATION_RULES.TITLE_MAX) {
    return `Keep the title under ${VALIDATION_RULES.TITLE_MAX} characters.`;
  }
  return undefined;
};

export const validateDescription = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Description is required.';
  if (trimmed.length < VALIDATION_RULES.DESCRIPTION_MIN) {
    return `Add at least ${VALIDATION_RULES.DESCRIPTION_MIN} characters describing the work.`;
  }
  if (trimmed.length > VALIDATION_RULES.DESCRIPTION_MAX) {
    return `Keep the description under ${VALIDATION_RULES.DESCRIPTION_MAX} characters.`;
  }
  return undefined;
};

export const validateAddress = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Location address is required.';
  if (trimmed.length < VALIDATION_RULES.ADDRESS_MIN) {
    return 'Enter a fuller address so the site can be found.';
  }
  if (trimmed.length > VALIDATION_RULES.ADDRESS_MAX) {
    return `Keep the address under ${VALIDATION_RULES.ADDRESS_MAX} characters.`;
  }
  return undefined;
};

/**
 * Due date must exist and be parseable. A date in the past is allowed on purpose:
 * technicians do log work retroactively. The reminder scheduler reports separately
 * when a past due date means no notification can be set.
 */
export const validateDueDate = (value: string): string | undefined => {
  if (!value) return 'Execution date and time are required.';
  if (!isValidIso(value)) return 'That date could not be read. Pick it again.';
  return undefined;
};

const parseCoordinate = (value: string): number | null => {
  const normalised = value.trim().replace(',', '.');
  if (normalised.length === 0) return null;
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export interface CoordinateValidation {
  latitudeError?: string;
  longitudeError?: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Coordinates are optional, but partial coordinates are not: a lone latitude
 * would put a marker in the wrong hemisphere, so both are required together.
 */
export const validateCoordinates = (
  latitudeText: string,
  longitudeText: string
): CoordinateValidation => {
  const latitude = parseCoordinate(latitudeText);
  const longitude = parseCoordinate(longitudeText);

  const result: CoordinateValidation = { latitude: null, longitude: null };

  if (latitude === null && longitude === null) return result;

  if (Number.isNaN(latitude)) {
    result.latitudeError = 'Latitude must be a number, for example 41.311081.';
  } else if (latitude === null) {
    result.latitudeError = 'Add a latitude too, or clear the longitude.';
  } else if (latitude < VALIDATION_RULES.LATITUDE_MIN || latitude > VALIDATION_RULES.LATITUDE_MAX) {
    result.latitudeError = 'Latitude must be between -90 and 90.';
  }

  if (Number.isNaN(longitude)) {
    result.longitudeError = 'Longitude must be a number, for example 69.240562.';
  } else if (longitude === null) {
    result.longitudeError = 'Add a longitude too, or clear the latitude.';
  } else if (
    longitude < VALIDATION_RULES.LONGITUDE_MIN ||
    longitude > VALIDATION_RULES.LONGITUDE_MAX
  ) {
    result.longitudeError = 'Longitude must be between -180 and 180.';
  }

  if (!result.latitudeError && !result.longitudeError) {
    result.latitude = latitude;
    result.longitude = longitude;
  }

  return result;
};

/** Validates the whole form in one pass; used on submit and on blur-triggered re-checks. */
export const validateTaskForm = (form: TaskFormShape): ValidationResult<TaskFormShape> => {
  const coordinates = validateCoordinates(form.latitude, form.longitude);

  const errors: ValidationResult<TaskFormShape>['errors'] = {
    title: validateTitle(form.title),
    description: validateDescription(form.description),
    dueDate: validateDueDate(form.dueDate),
    address: validateAddress(form.address),
    latitude: coordinates.latitudeError,
    longitude: coordinates.longitudeError,
  };

  // Strip undefined entries so callers can rely on `key in errors`.
  (Object.keys(errors) as (keyof TaskFormShape)[]).forEach((key) => {
    if (errors[key] === undefined) delete errors[key];
  });

  return { isValid: Object.keys(errors).length === 0, errors };
};

/** Accepts `http://host:port` style URLs only — the mock server is plain HTTP. */
export const validateApiBaseUrl = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Enter a server URL, or reset to the default.';
  if (!/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(trimmed)) {
    return 'Use a full URL, for example http://192.168.1.10:3000';
  }
  return undefined;
};
