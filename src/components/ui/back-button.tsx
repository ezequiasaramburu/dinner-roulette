import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Round back button. Calls `onPress`, or goes back in the navigation stack. */
export function BackButton({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      onPress={onPress ?? (() => router.back())}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { backgroundColor: theme.surfaceMuted },
      ]}>
      <Text style={{ fontFamily: Fonts.medium, fontSize: 26, lineHeight: 28, marginTop: -2 }}>‹</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
