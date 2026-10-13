/**
 * Design tokens for Dinner Roulette: a warm editorial look (paper, ink, tomato).
 * Every colour has a light and a dark value; components read them through useTheme().
 * Contrast of the text/background pairs was checked against WCAG AA.
 */
import { Platform } from 'react-native';

export const Colors = {
  light: {
    background: '#FAF5EC', // paper
    surface: '#FFFDF8', // cards, inputs
    surfaceMuted: '#F2EADB', // quiet panels, wheel disc
    text: '#1F1A17', // ink
    textSecondary: '#6B5F55',
    textTertiary: '#8F8174', // decorative/hint only (3.5:1)
    primary: '#B93D26', // tomato
    primaryPressed: '#9F321E',
    primarySoft: '#F6E1D9',
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
    textTertiary: '#8F8274',
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

/** Soft, warm elevation. Dark mode relies on borders instead of shadows. */
export function elevation(scheme: 'light' | 'dark', level: 1 | 2 = 1) {
  if (scheme === 'dark') return {};
  return Platform.select({
    ios: {
      shadowColor: '#3B2A1A',
      shadowOpacity: level === 1 ? 0.07 : 0.12,
      shadowRadius: level === 1 ? 14 : 24,
      shadowOffset: { width: 0, height: level === 1 ? 4 : 10 },
    },
    default: { elevation: level === 1 ? 2 : 5 },
  });
}
