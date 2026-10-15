import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  /** Small leading element, e.g. an emoji. */
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = 'primary', loading, disabled, leading, style, ...rest }: Props) {
  const theme = useTheme();
  const scheme = useScheme();
  const inactive = !!disabled || !!loading;

  const textColor = variant === 'primary' ? theme.onPrimary : variant === 'ghost' ? theme.textSecondary : theme.text;

  return (
    <PressableScale
      haptic={variant === 'primary' ? 'tap' : 'none'}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && [
          { backgroundColor: pressed ? theme.primaryPressed : theme.primary },
          scheme === 'light' && styles.primaryShadow,
        ],
        variant === 'secondary' && {
          backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
          borderColor: theme.borderStrong,
          borderWidth: 1.5,
        },
        variant === 'ghost' && { backgroundColor: pressed ? theme.surfaceMuted : 'transparent', minHeight: 48 },
        inactive && styles.inactive,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {leading}
          <Text variant="bodyStrong" style={{ color: textColor, letterSpacing: 0.2 }}>
            {title}
          </Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    alignSelf: 'stretch',
  },
  primaryShadow: {
    shadowColor: '#B93D26',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  inactive: { opacity: 0.5 },
});
