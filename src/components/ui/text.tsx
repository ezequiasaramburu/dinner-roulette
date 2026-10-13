import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { Fonts, type ColorToken } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'overline';

export type TextTone = 'default' | 'secondary' | 'tertiary' | 'primary' | 'onPrimary' | 'danger' | 'success' | 'warning';

const TONE_COLOR: Record<TextTone, ColorToken> = {
  default: 'text',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  primary: 'primary',
  onPrimary: 'onPrimary',
  danger: 'danger',
  success: 'success',
  warning: 'warning',
};

const VARIANTS: Record<TextVariant, TextStyle> = {
  display: { fontFamily: Fonts.display, fontSize: 44, lineHeight: 48, letterSpacing: -0.8 },
  title: { fontFamily: Fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  heading: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  body: { fontFamily: Fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: Fonts.semibold, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: Fonts.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: Fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
  overline: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
};

export function Text({ variant = 'body', tone = 'default', align, style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      style={[
        VARIANTS[variant],
        { color: theme[TONE_COLOR[tone]] },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}

/** A serif-italic, tomato-coloured word inside a headline: <Text variant="display">Decide <Accent>together</Accent></Text> */
export function Accent({ style, ...rest }: RNTextProps) {
  const theme = useTheme();
  return <RNText style={[{ fontFamily: Fonts.displayItalic, color: theme.primary }, style]} {...rest} />;
}
