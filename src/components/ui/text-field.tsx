import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { ControlHeight, Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  /** Keep the label for screen readers but don't show it (for rows in a list that share one heading). */
  hideLabel?: boolean;
  /** "code" is a large, centred, letter-spaced field for one-time codes. */
  variant?: 'default' | 'code';
};

export function TextField({ label, error, hideLabel, variant = 'default', placeholder, style, onFocus, onBlur, ...rest }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const isCode = variant === 'code';
  // On Android the native hint of a centred, letter-spaced field puts the caret at the end of the hint. Draw the hint
  // ourselves there, so an empty code field behaves the same on both platforms.
  const drawnHint = isCode && Platform.OS === 'android' && !!placeholder && !rest.value;

  return (
    <View style={styles.wrap}>
      {hideLabel ? null : (
        <Text variant="label" tone="secondary">
          {label}
        </Text>
      )}
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholder={isCode && Platform.OS === 'android' ? undefined : placeholder}
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.primary}
          cursorColor={theme.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            isCode && styles.code,
            {
              color: theme.text,
              backgroundColor: theme.surface,
              borderColor: error ? theme.danger : focused ? theme.primary : theme.borderStrong,
            },
            style,
          ]}
          {...rest}
        />
        {drawnHint ? (
          <Text pointerEvents="none" style={[styles.hint, { color: theme.textTertiary }]}>
            {placeholder}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  input: {
    minHeight: ControlHeight,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    fontFamily: Fonts.body,
    fontSize: 17,
  },
  code: {
    minHeight: 72,
    textAlign: 'center',
    fontFamily: Fonts.display,
    fontSize: 32,
    letterSpacing: 10,
    paddingLeft: Spacing.lg + 10, // balance the trailing letter-spacing
  },
  hint: {
    ...StyleSheet.absoluteFill,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontFamily: Fonts.display,
    fontSize: 32,
    letterSpacing: 10,
    paddingLeft: Spacing.lg + 10,
  },
});
