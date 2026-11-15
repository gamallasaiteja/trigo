import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import type { CategoryColor, ThemePreference } from '@/models/types';
import { categoryColors, darkPalette, lightPalette, type Palette } from './tokens';

export interface Theme {
  dark: boolean;
  colors: Palette;
  category: (c: CategoryColor) => { fg: string; bg: string };
}

const build = (dark: boolean): Theme => ({
  dark,
  colors: dark ? darkPalette : lightPalette,
  category: (c) => (categoryColors[c] ?? categoryColors.green)[dark ? 'dark' : 'light'],
});

const LIGHT = build(false);
const DARK = build(true);
const ThemeContext = createContext<Theme>(LIGHT);

export function ThemeProvider({ preference, children }: { preference: ThemePreference; children: React.ReactNode }) {
  const scheme = useColorScheme();
  const dark = preference === 'dark' || (preference === 'system' && scheme === 'dark');
  return <ThemeContext.Provider value={dark ? DARK : LIGHT}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Memoised theme-aware StyleSheet factory. */
export function useStyles<T>(factory: (t: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
