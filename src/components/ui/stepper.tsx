import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Spoken label, e.g. "Matches per day". */
  label: string;
};

/** A − 2 + control for picking a small whole number. */
export function Stepper({ value, min, max, onChange, label }: Props) {
  const theme = useTheme();

  const step = (glyph: string, delta: number, disabled: boolean, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={disabled}
      onPress={() => onChange(value + delta)}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.surface, borderColor: theme.borderStrong },
        disabled && { opacity: 0.35 },
        pressed && { backgroundColor: theme.surfaceMuted },
      ]}>
      <Text style={{ fontFamily: Fonts.medium, fontSize: 24, lineHeight: 28 }}>{glyph}</Text>
    </Pressable>
  );

  return (
    <View accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value }} style={styles.row}>
      {step('−', -1, value <= min, `Decrease ${label}`)}
      <Text style={styles.value}>{value}</Text>
      {step('+', 1, value >= max, `Increase ${label}`)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  button: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: Fonts.display, fontSize: 36, lineHeight: 42, minWidth: 28, textAlign: 'center' },
});
