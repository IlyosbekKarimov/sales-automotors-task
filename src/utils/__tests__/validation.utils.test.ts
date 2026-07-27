import {
  validateApiBaseUrl,
  validateCoordinates,
  validateDescription,
  validateDueDate,
  validateTaskForm,
  validateTitle,
} from '@/utils/validation.utils';
import type { TaskFormShape } from '@/utils/validation.utils';

const validForm: TaskFormShape = {
  title: 'Replace hydraulic hose',
  description: 'Unit 12 is leaking from the boom cylinder feed line. Bring a 3/4in hose.',
  dueDate: new Date('2026-08-01T09:00:00.000Z').toISOString(),
  address: 'Amir Temur Ave 107B, Tashkent',
  latitude: '',
  longitude: '',
};

describe('validateTitle', () => {
  it('rejects an empty title', () => {
    expect(validateTitle('   ')).toBe('Title is required.');
  });

  it('rejects a title below the minimum length', () => {
    expect(validateTitle('ab')).toMatch(/at least 3 characters/);
  });

  it('accepts a reasonable title', () => {
    expect(validateTitle('Service the generator')).toBeUndefined();
  });
});

describe('validateDescription', () => {
  it('requires a description', () => {
    expect(validateDescription('')).toBe('Description is required.');
  });

  it('requires enough detail to be useful', () => {
    expect(validateDescription('too short')).toMatch(/at least 10 characters/);
  });
});

describe('validateDueDate', () => {
  it('requires a value', () => {
    expect(validateDueDate('')).toBe('Execution date and time are required.');
  });

  it('rejects an unparseable value', () => {
    expect(validateDueDate('not-a-date')).toMatch(/could not be read/);
  });

  // A past due date is allowed on purpose — technicians log work retroactively.
  it('accepts a date in the past', () => {
    expect(validateDueDate(new Date('2020-01-01T08:00:00.000Z').toISOString())).toBeUndefined();
  });
});

describe('validateCoordinates', () => {
  it('treats both-empty as "no coordinates", not an error', () => {
    const result = validateCoordinates('', '');
    expect(result.latitudeError).toBeUndefined();
    expect(result.longitudeError).toBeUndefined();
    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
  });

  it('rejects a lone latitude', () => {
    expect(validateCoordinates('41.3', '').longitudeError).toMatch(/Add a longitude/);
  });

  it('rejects out-of-range values', () => {
    expect(validateCoordinates('95', '69.2').latitudeError).toMatch(/between -90 and 90/);
    expect(validateCoordinates('41.3', '200').longitudeError).toMatch(/between -180 and 180/);
  });

  it('rejects non-numeric input', () => {
    expect(validateCoordinates('north', '69.2').latitudeError).toMatch(/must be a number/);
  });

  it('parses a valid pair, accepting a comma decimal separator', () => {
    const result = validateCoordinates('41,311081', '69.240562');
    expect(result.latitude).toBeCloseTo(41.311081);
    expect(result.longitude).toBeCloseTo(69.240562);
  });
});

describe('validateTaskForm', () => {
  it('passes a complete form', () => {
    const result = validateTaskForm(validForm);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('collects every field error in one pass', () => {
    const result = validateTaskForm({
      ...validForm,
      title: '',
      description: '',
      address: '',
      latitude: '999',
      longitude: '',
    });

    expect(result.isValid).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual([
      'address',
      'description',
      'latitude',
      'longitude',
      'title',
    ]);
  });

  it('omits keys for fields that are valid', () => {
    const result = validateTaskForm({ ...validForm, title: 'ab' });
    expect(result.errors.title).toBeDefined();
    expect('description' in result.errors).toBe(false);
  });
});

describe('validateApiBaseUrl', () => {
  it('accepts a LAN address with a port', () => {
    expect(validateApiBaseUrl('http://192.168.1.10:3000')).toBeUndefined();
  });

  it('rejects a bare host', () => {
    expect(validateApiBaseUrl('192.168.1.10:3000')).toMatch(/full URL/);
  });

  it('rejects an empty value', () => {
    expect(validateApiBaseUrl('  ')).toMatch(/Enter a server URL/);
  });
});
