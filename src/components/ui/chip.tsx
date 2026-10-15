import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = { label: string; emoji?: string; selected: boolean; onPress: () => void };

export function Chip({ label, emoji, selected, onPress }: Props) {
  const theme = useTheme();
  return (
    <PressableScale
      haptic="select"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: theme.primary, borderColor: theme.primary }
          : { backgroundColor: theme.surface, borderColor: theme.borderStrong },
      ]}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text variant="label" style={[styles.label, { color: selected ? theme.onPrimary : theme.text }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
  },
  emoji: { fontSize: 16, lineHeight: 22 },
  label: { fontSize: 14, lineHeight: 20 },
});
