import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** An invite code shown one character per tile. Pass undefined while it loads. */
export function CodeTiles({ code, length = 6 }: { code?: string; length?: number }) {
  const theme = useTheme();
  const chars = (code ?? '').padEnd(length, ' ').slice(0, length).split('');

  return (
    <View accessibilityLabel={code ? `Invite code ${code.split('').join(' ')}` : 'Loading invite code'} style={styles.row}>
      {chars.map((ch, i) => (
        <View
          key={i}
          style={[
            styles.tile,
            { backgroundColor: code ? theme.surface : theme.surfaceMuted, borderColor: theme.borderStrong },
          ]}>
          <Text variant="title" style={{ fontSize: 30, lineHeight: 36 }} selectable>
            {ch.trim()}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  tile: {
    flex: 1,
    maxWidth: 52,
    height: 68,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
