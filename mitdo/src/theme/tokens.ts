import type { CategoryColor } from '@/models/types';

export interface Palette {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  onPrimary: string;
  background: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  warning: string;
  warningSoft: string;
  todo: string;
  todoSoft: string;
  danger: string;
  dangerSoft: string;
  lavender: string;
  cream: string;
  track: string;
  overlay: string;
  shadow: string;
}

export const lightPalette: Palette = {
  primary: '#218C52',
  primaryDark: '#176B40',
  primarySoft: '#E8F4EC',
  onPrimary: '#FFFFFF',
  background: '#F8F9F7',
  card: '#FFFFFF',
  cardAlt: '#F2F4F1',
  border: '#E9ECE8',
  text: '#202520',
  textSecondary: '#858B85',
  textMuted: '#B4B9B3',
  success: '#2E9E5B',
  warning: '#F0A030',
  warningSoft: '#FFF4E2',
  todo: '#8B5CF6',
  todoSoft: '#F1EBFF',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  lavender: '#EFEBFB',
  cream: '#FFF8E8',
  track: '#E6EAE5',
  overlay: 'rgba(16, 22, 16, 0.45)',
  shadow: '#1B2A1E',
};

export const darkPalette: Palette = {
  primary: '#3DB373',
  primaryDark: '#2A8F58',
  primarySoft: '#173323',
  onPrimary: '#FFFFFF',
  background: '#0F1310',
  card: '#181D19',
  cardAlt: '#20261F',
  border: '#262D27',
  text: '#EEF2EE',
  textSecondary: '#9AA39B',
  textMuted: '#5D665E',
  success: '#3DB373',
  warning: '#F2B04E',
  warningSoft: '#33281A',
  todo: '#A78BFA',
  todoSoft: '#262039',
  danger: '#F2686C',
  dangerSoft: '#3A1F20',
  lavender: '#221F33',
  cream: '#2C2719',
  track: '#2A322B',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
};

export const categoryColors: Record<CategoryColor, { light: { fg: string; bg: string }; dark: { fg: string; bg: string } }> = {
  green: { light: { fg: '#218C52', bg: '#E8F4EC' }, dark: { fg: '#3DB373', bg: '#173323' } },
  blue: { light: { fg: '#3B82F6', bg: '#E8F0FE' }, dark: { fg: '#6EA2F8', bg: '#1B2538' } },
  purple: { light: { fg: '#8B5CF6', bg: '#F1EBFF' }, dark: { fg: '#A78BFA', bg: '#262039' } },
  orange: { light: { fg: '#EA8A1C', bg: '#FFF1DF' }, dark: { fg: '#F2A64E', bg: '#33261A' } },
  pink: { light: { fg: '#E0577F', bg: '#FDECF1' }, dark: { fg: '#F07A9C', bg: '#381D26' } },
  teal: { light: { fg: '#0E9F8E', bg: '#E2F6F3' }, dark: { fg: '#3CC4B2', bg: '#16302D' } },
  yellow: { light: { fg: '#C99A06', bg: '#FFF8DB' }, dark: { fg: '#E8BF3A', bg: '#302A14' } },
  red: { light: { fg: '#E5484D', bg: '#FDECEC' }, dark: { fg: '#F2686C', bg: '#3A1F20' } },
};

export const CATEGORY_COLOR_KEYS = Object.keys(categoryColors) as CategoryColor[];

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 999 } as const;

export const font = {
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' as const },
  subheading: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  smallStrong: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 11, fontWeight: '600' as const },
};
