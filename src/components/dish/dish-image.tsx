import { Image, type ImageStyle } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui';
import { thumbnail } from '@/hooks/use-swipe-feed';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  url: string | null;
  size?: 'small' | 'medium' | 'large';
  label: string;
  style?: StyleProp<ViewStyle>;
};

// Callers pass plain size/radius/border styles, which are valid for both a View and an Image.
type Shared = StyleProp<ImageStyle>;

/** A dish photo, or a plate on a quiet background for recipes shared without one. */
export function DishImage({ url, size = 'medium', style }: Props) {
  const theme = useTheme();
  const source = thumbnail(url, size);

  if (!source) {
    return (
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.placeholder, { backgroundColor: theme.surfaceMuted }, style]}>
        <Text style={styles.plate}>🍽️</Text>
      </View>
    );
  }
  return (
    <Image
      source={source}
      // The dish name is always next to its photo, so reading it twice would only be noise.
      accessible={false}
      importantForAccessibility="no"
      contentFit="cover"
      transition={250}
      style={[{ backgroundColor: theme.surfaceMuted }, style as Shared]}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  plate: { fontSize: 40, lineHeight: 48, opacity: 0.6 },
});
