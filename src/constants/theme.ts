/**
 * Design tokens for Swipe for Dinner: a warm editorial look (paper, ink, tomato).
 * Every colour has a light and a dark value; components read them through useTheme().
 * Contrast of the text/background pairs was checked against WCAG AA.
 */
import { Platform } from 'react-native';

import { mix } from '@/lib/color';

export const Colors = {
  light: {
    background: '#FAF5EC', // paper
    surface: '#FFFDF8', // cards, inputs
    surfaceMuted: '#F2EADB', // quiet panels, wheel disc
    text: '#1F1A17', // ink
    textSecondary: '#6B5F55',
    textTertiary: '#74685E', // small labels and hints: at least 4.5:1 on every light surface (was #8F8174, 3.2 to 3.7)
    primary: '#B93D26', // tomato
    primaryPressed: '#9F321E',
    primarySoft: '#F8E7DF', // lightened a hair so tomato text on it reaches 4.5:1 (was #F6E1D9, 4.44)
    onPrimary: '#FFF8EF',
    border: '#E7DDCC',
    borderStrong: '#CFC2AD',
    success: '#456B34', // basil
    successSoft: '#E4EDD9',
    warning: '#8A5A00', // saffron, text-safe
    warningSoft: '#F7E8C4',
    danger: '#B3261E',
    overlay: 'rgba(31, 26, 23, 0.45)',
  },
  dark: {
    background: '#17120F', // espresso
    surface: '#211A16',
    surfaceMuted: '#2B221D',
    text: '#F6EEE3',
    textSecondary: '#B9AB9B',
    textTertiary: '#998D7F', // at least 4.5:1 on the muted card too (was #8F8274, 4.16)
    primary: '#E8684A',
    primaryPressed: '#F07F63',
    primarySoft: '#3A221B',
    onPrimary: '#1A0F0A',
    border: '#352B24',
    borderStrong: '#4A3D33',
    success: '#9DBF7F',
    successSoft: '#26301F',
    warning: '#E8B04A',
    warningSoft: '#3A2D14',
    danger: '#F2877F',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

export type ColorToken = keyof typeof Colors.light;
export type ThemeColors = { [K in ColorToken]: string };

/** 4pt spacing scale. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export const Radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;

/** Font family names registered in the root layout (Fraunces for display, Inter for UI). */
export const Fonts = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_600SemiBold_Italic',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

export const MaxContentWidth = 560;

/** One height for every button (filled, outlined, text-only) and every form field, so they line up side by side. */
export const ControlHeight = 50;

/** Soft, warm elevation. Dark mode relies on borders instead of shadows. */
export function elevation(scheme: 'light' | 'dark', level: 1 | 2 = 1) {
  if (scheme === 'dark') return {};
  return Platform.select({
    ios: {
      shadowColor: '#3B2A1A',
      shadowOpacity: level === 1 ? 0.16 : 0.22,
      shadowRadius: level === 1 ? 18 : 28,
      shadowOffset: { width: 0, height: level === 1 ? 8 : 14 },
    },
    default: { elevation: level === 1 ? 5 : 9 },
  });
}

/** Barely-there top-light gradients as [top, bottom], blended from the existing colours (no new hues). */
export function gradients(scheme: 'light' | 'dark') {
  const c = Colors[scheme];
  const lift = (color: string, amount: number) => [mix(color, '#FFFFFF', amount), color] as const;
  return {
    primary: lift(c.primary, 0.06),
    primaryPressed: lift(c.primaryPressed, 0.06),
    accent: lift(c.primarySoft, scheme === 'dark' ? 0.04 : 0.3),
  };
}

/** The tomato glow under the primary button. Dark mode relies on borders instead of shadows. */
export function primaryGlow(scheme: 'light' | 'dark') {
  if (scheme === 'dark') return {};
  return {
    shadowColor: Colors.light.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  };
}
