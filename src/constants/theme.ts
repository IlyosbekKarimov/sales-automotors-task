import type { SyncStatus, TaskStatus } from '@/types';

/**
 * Design tokens. Components never hardcode a hex value — they read from the
 * `AppTheme` handed down by `ThemeProvider`, which is what makes the light/dark
 * toggle a one-line change instead of a per-screen rewrite.
 */

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  textSubtle: string;
  textInverted: string;

  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerPressed: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;

  neutral: string;
  neutralSoft: string;

  overlay: string;
  skeleton: string;
}

const lightColors: ThemeColors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F6',
  surfaceElevated: '#FFFFFF',
  border: '#E1E6EF',
  borderStrong: '#C8D1E0',

  text: '#0B1220',
  textMuted: '#525E73',
  textSubtle: '#7C879B',
  textInverted: '#FFFFFF',

  primary: '#2563EB',
  primaryPressed: '#1D4ED8',
  primarySoft: '#E7EFFE',
  onPrimary: '#FFFFFF',

  success: '#047857',
  successSoft: '#DCF5EC',
  warning: '#B45309',
  warningSoft: '#FBEFDC',
  danger: '#C81E1E',
  dangerPressed: '#A31414',
  dangerSoft: '#FCE7E7',
  info: '#0E7490',
  infoSoft: '#DBF1F7',

  neutral: '#64748B',
  neutralSoft: '#E9EDF3',

  overlay: 'rgba(11, 18, 32, 0.55)',
  skeleton: '#E5E9F0',
};

const darkColors: ThemeColors = {
  background: '#0A101C',
  surface: '#141D2E',
  surfaceMuted: '#1C2739',
  surfaceElevated: '#1A2436',
  border: '#26324A',
  borderStrong: '#3A4863',

  text: '#F1F5FB',
  textMuted: '#A7B2C6',
  textSubtle: '#77839A',
  textInverted: '#0A101C',

  primary: '#5B94F7',
  primaryPressed: '#7DABF9',
  primarySoft: '#1B2A47',
  onPrimary: '#04101F',

  success: '#34D399',
  successSoft: '#0F3A2E',
  warning: '#FBBF24',
  warningSoft: '#3A2C0C',
  danger: '#F87171',
  dangerPressed: '#FCA5A5',
  dangerSoft: '#3B1A1D',
  info: '#38BDF8',
  infoSoft: '#0C2E3F',

  neutral: '#94A3B8',
  neutralSoft: '#232F45',

  overlay: 'rgba(2, 6, 14, 0.7)',
  skeleton: '#1E2A3E',
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/**
 * Font sizes start at 13 and tap targets at 48dp so the app stays legible and
 * operable with gloves on, which is the accessibility baseline the brief asks for.
 */
export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
} as const;

export const layout = {
  /** Minimum interactive size — Android accessibility guidance is 48dp. */
  minTapTarget: 48,
  screenPadding: spacing.md,
  maxContentWidth: 640,
} as const;

export interface AppTheme {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  layout: typeof layout;
  /** Platform-consistent elevation presets; RN needs both shadow* and elevation. */
  shadow: {
    card: object;
    floating: object;
  };
}

const buildShadow = (scheme: 'light' | 'dark') => ({
  card: {
    shadowColor: '#0B1220',
    shadowOpacity: scheme === 'light' ? 0.06 : 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#0B1220',
    shadowOpacity: scheme === 'light' ? 0.18 : 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});

export const lightTheme: AppTheme = {
  scheme: 'light',
  colors: lightColors,
  spacing,
  radius,
  typography,
  layout,
  shadow: buildShadow('light'),
};

export const darkTheme: AppTheme = {
  scheme: 'dark',
  colors: darkColors,
  spacing,
  radius,
  typography,
  layout,
  shadow: buildShadow('dark'),
};

export interface ToneColors {
  fg: string;
  bg: string;
}

/** Keeps status colouring identical everywhere it appears (list, detail, map, history). */
export const getStatusTone = (status: TaskStatus, colors: ThemeColors): ToneColors => {
  switch (status) {
    case 'New':
      return { fg: colors.info, bg: colors.infoSoft };
    case 'In Progress':
      return { fg: colors.warning, bg: colors.warningSoft };
    case 'Completed':
      return { fg: colors.success, bg: colors.successSoft };
    case 'Cancelled':
      return { fg: colors.neutral, bg: colors.neutralSoft };
  }
};

export const getSyncTone = (syncStatus: SyncStatus, colors: ThemeColors): ToneColors => {
  switch (syncStatus) {
    case 'Synced':
      return { fg: colors.success, bg: colors.successSoft };
    case 'Pending Sync':
      return { fg: colors.warning, bg: colors.warningSoft };
    case 'Sync Failed':
      return { fg: colors.danger, bg: colors.dangerSoft };
  }
};
