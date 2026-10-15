import { useRouter } from "expo-router";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Accent, Button, RouletteWheel, Screen, Text } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { enter } from "@/hooks/use-motion";

export default function Welcome() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const wheelSize = Math.min(width - Spacing.xl * 2, height * 0.36, 320);

  return (
    <Screen
      scroll={false}
      contentStyle={styles.content}
      footer={
        <>
          <Button
            title="Continue with email"
            onPress={() => router.push("/email")}
          />
          {/* <Text variant="caption" tone="tertiary" align="center">
            Your partner joins for free.
          </Text> */}
          <Text variant="caption" tone="tertiary" align="center">
            By continuing you agree to our{" "}
            <Text
              variant="caption"
              tone="secondary"
              onPress={() => router.push("/legal/terms")}
            >
              Terms
            </Text>{" "}
            and{" "}
            <Text
              variant="caption"
              tone="secondary"
              onPress={() => router.push("/legal/privacy")}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </>
      }
    >
      <Animated.View entering={FadeIn.duration(900)} style={styles.wheel}>
        <RouletteWheel size={wheelSize} />
      </Animated.View>

      <Animated.View
        entering={enter(3)}
        style={styles.copy}
      >
        <Text variant="overline" tone="primary">
          Dinner Roulette
        </Text>
        <Text variant="display">
          Decide dinner,{"\n"}
          <Accent>together.</Accent>
        </Text>
        <Text tone="secondary" style={styles.sub}>
          Two people, a few swipes, one answer. You both find out at the same
          moment, every evening.
        </Text>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "space-between",
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  wheel: { alignItems: "center" },
  copy: { gap: Spacing.md },
  sub: { maxWidth: 420 },
});
