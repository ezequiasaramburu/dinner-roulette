import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// [background, foreground]: fixed so a person keeps their colour in light and dark mode.
const PAIRS = [
  ['#B93D26', '#FFF8EF'], // tomato
  ['#456B34', '#F4FAEE'], // basil
  ['#8A5A00', '#FFF6E0'], // saffron
  ['#6B3F5E', '#FBEFF7'], // plum
] as const;

function pairFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PAIRS[hash % PAIRS.length];
}

/** `colorIndex` picks a specific colour (use 0 and 1 for the two people in a couple); otherwise it's derived from the name. */
export function Avatar({ name, size = 56, colorIndex }: { name: string; size?: number; colorIndex?: number }) {
  const theme = useTheme();
  const [bg, fg] = colorIndex === undefined ? pairFor(name) : PAIRS[colorIndex % PAIRS.length];
  return (
    <View
      // The name is always written next to the avatar.
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderColor: theme.surface, borderWidth: 3 },
      ]}>
      <Text maxFontSizeMultiplier={1.2} style={{ color: fg, fontFamily: Fonts.display, fontSize: size * 0.42, lineHeight: size * 0.5 }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
