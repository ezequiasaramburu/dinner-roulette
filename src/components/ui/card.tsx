import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing, elevation } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';

type Props = {
  children: ReactNode;
  tone?: 'default' | 'muted' | 'accent';
  padding?: keyof typeof Spacing;
  onPress?: PressableProps['onPress'];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, tone = 'default', padding = 'xl', onPress, accessibilityLabel, style }: Props) {
  const theme = useTheme();
  const scheme = useScheme();

  const base: ViewStyle = {
    borderRadius: Radius.xl,
    padding: Spacing[padding],
    backgroundColor: tone === 'muted' ? theme.surfaceMuted : tone === 'accent' ? theme.primarySoft : theme.surface,
    borderWidth: tone === 'muted' ? 0 : 1,
    borderColor: theme.border,
    ...(tone === 'default' ? elevation(scheme) : null),
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && styles.pressed, style]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
});
