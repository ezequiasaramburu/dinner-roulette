import type { ReactNode } from 'react';
import { View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
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
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { opacity: 0.92 }, style]}>
      {children}
    </PressableScale>
  );
}
