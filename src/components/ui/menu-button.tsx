import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Round burger button that opens the side menu. Sits where the back button sits on other screens. */
export function MenuButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { backgroundColor: theme.surfaceMuted },
      ]}>
      <View style={styles.bars}>
        <View style={[styles.bar, { backgroundColor: theme.text }]} />
        <View style={[styles.bar, styles.barShort, { backgroundColor: theme.text }]} />
        <View style={[styles.bar, { backgroundColor: theme.text }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bars: { gap: 4, alignItems: 'flex-start' },
  bar: { width: 18, height: 2, borderRadius: 1 },
  barShort: { width: 12 },
});
