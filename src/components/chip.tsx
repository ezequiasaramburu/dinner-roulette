import { Pressable, StyleSheet, Text } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = { label: string; emoji?: string; selected: boolean; onPress: () => void };

export function Chip({ label, emoji, selected, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: theme.primary, borderColor: theme.primary }
          : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <Text style={[styles.text, { color: selected ? theme.primaryText : theme.text }]}>
        {emoji ? `${emoji}  ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  text: { fontSize: 15, fontWeight: '600' },
});
