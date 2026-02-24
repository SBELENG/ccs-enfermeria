// ============================================================
// CCS Design System – Tokens para React Native (StyleSheet)
// ============================================================

export const COLORS = {
  navy:       '#1a2b5e',
  blueMid:    '#3a6bc8',
  blueLight:  '#7bb5e8',
  tealDark:   '#1e8f7a',
  teal:       '#2dc9a8',
  tealLight:  '#7eecd8',
  white:      '#f8fafb',
  gray100:    '#e2eaf2',
  gray200:    '#c5d5e9',
  text:       '#16243a',
  textMuted:  '#5a7191',
  gold:       '#f4b942',
  red:        '#c42b2b',
} as const;

export const ROLES = {
  organizador: {
    label: 'Organizador',
    icon:  '🗂️',
    color: COLORS.navy,
    bg:    '#1a2b5e18',
    index: 0,
  },
  analitico: {
    label: 'Analítico',
    icon:  '📊',
    color: COLORS.blueMid,
    bg:    '#3a6bc818',
    index: 1,
  },
  ejecutor: {
    label: 'Ejecutor',
    icon:  '🛠️',
    color: COLORS.blueLight,
    bg:    '#7bb5e818',
    index: 2,
  },
  creativo: {
    label: 'Creativo',
    icon:  '🎨',
    color: COLORS.tealDark,
    bg:    '#1e8f7a18',
    index: 3,
  },
  conciliador: {
    label: 'Conciliador',
    icon:  '🤝',
    color: COLORS.teal,
    bg:    '#2dc9a818',
    index: 4,
  },
  motivador: {
    label: 'Motivador',
    icon:  '🔊',
    color: COLORS.tealLight,
    bg:    '#7eecd818',
    index: 5,
  },
} as const;

export type RolKey = keyof typeof ROLES;
export const ROL_KEYS = Object.keys(ROLES) as RolKey[];

export const SPACING = {
  xs:  4,
  sm:  8,
  md: 16,
  lg: 24,
  xl: 40,
} as const;

export const RADIUS = {
  sm:  8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

export const FONTS = {
  body:    'DMSans-Regular',
  bodyMd:  'DMSans-Medium',
  bodyBd:  'DMSans-Bold',
  heading: 'Syne-Bold',
  headingXl: 'Syne-ExtraBold',
} as const;

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 48,
    elevation: 12,
  },
} as const;
