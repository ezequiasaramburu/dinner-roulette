import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

/** A soft gradient filling its parent, behind the content. It clips itself to `radius`, so the parent keeps its shadow. */
export function GradientFill({ colors, radius }: { colors: readonly [string, string]; radius: number }) {
  return <LinearGradient pointerEvents="none" colors={colors} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />;
}
