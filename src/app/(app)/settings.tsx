import { useRouter } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import {
  Accent,
  BackButton,
  Button,
  Card,
  OptionCard,
  Screen,
  Stepper,
  Text,
  TimeField,
} from "@/components/ui";
import { DEFAULT_MATCH_GOAL } from "@/constants/food";
import { Spacing } from "@/constants/theme";
import { enter } from "@/hooks/use-motion";
import {
  useCouple,
  useUpdateCoupleSettings,
  type CoupleSettings,
} from "@/hooks/use-couple";
import { useAccountActions } from "@/hooks/use-account";
import { useBlockedCount, useClearBlocks } from "@/hooks/use-recipes";
import { ReminderControls } from "@/components/reminder-controls";
import { useReminders } from "@/hooks/use-reveal-reminder";
import { useTheme } from "@/hooks/use-theme";
import { timeInZoneToLocal } from "@/lib/zoned-time";

export default function Settings() {
  const { data: couple } = useCouple();
  const theme = useTheme();
  const { swipeTime, setSwipeTime } = useReminders();
  const update = useUpdateCoupleSettings();
  const router = useRouter();
  const blocked = useBlockedCount();
  const clearBlocks = useClearBlocks();
  const { confirmDelete, deleting } = useAccountActions(couple?.partner?.display_name, couple?.role === 'owner');
  const instant = couple?.reveal_mode === "instant";
  const goal = couple?.match_goal ?? DEFAULT_MATCH_GOAL;

  // The reveal time is on the couple's clock; show what it is on this phone when the two differ.
  const localTime = couple
    ? (() => {
        const { hour, minute } = timeInZoneToLocal(
          couple.reveal_time,
          couple.timezone,
        );
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      })()
    : null;

  function save(settings: CoupleSettings) {
    update.mutate(settings, {
      onError: () => Alert.alert("Couldn't save that", "Please try again."),
    });
  }

  return (
    <Screen>
      <BackButton />
      <Animated.View entering={enter()} style={styles.stack}>
        <Text variant="title">
          Your <Accent>settings</Accent>
        </Text>

        <Card>
          <Text variant="overline" tone="tertiary">
            Dinner options
          </Text>
          <Text variant="heading" style={styles.cardTitle}>
            Matches per day
          </Text>
          <Text variant="caption" tone="secondary">
            You keep swiping until you&apos;ve both liked this many of the same
            dishes. They&apos;re revealed together
            {instant
              ? " as soon as you reach it"
              : ` at ${couple?.reveal_time ?? "the reveal"}`}
            , so you&apos;ll have {goal === 1 ? "one dish" : `${goal} options`}{" "}
            to cook. Either of you can change this.
          </Text>
          <View style={styles.stepper}>
            <Stepper
              label="Matches per day"
              value={goal}
              min={1}
              max={5}
              onChange={(n) => save({ matchGoal: n })}
            />
          </View>
        </Card>

        <Card>
          <Text variant="overline" tone="tertiary">
            How you find out
          </Text>
          <View style={styles.options}>
            <OptionCard
              title="As soon as you match"
              description="The moment you've reached your matches, you both find out. Swiping reopens tomorrow."
              selected={instant}
              onPress={() => save({ revealMode: "instant" })}
            />
            <OptionCard
              title="At a set time"
              description="Keep swiping whenever you like. You both find out at the same time each day, and swiping reopens after midnight."
              selected={!instant}
              onPress={() => save({ revealMode: "scheduled" })}
            />
          </View>
        </Card>

        {!instant && couple ? (
          <Card>
            <Text variant="overline" tone="tertiary">
              Daily reveal
            </Text>
            <Text variant="heading" style={styles.cardTitle}>
              What time do you find out?
            </Text>
            <Text variant="caption" tone="secondary">
              You both find out at the same moment, on the clock of{" "}
              {couple.timezone.replace("_", " ")}. Either of you can change it.
            </Text>
            <View style={styles.stepper}>
              <TimeField
                accessibilityLabel="Reveal time"
                value={couple.reveal_time}
                onChange={(revealTime) => save({ revealTime })}
              />
            </View>
            {localTime && localTime !== couple.reveal_time ? (
              <Text variant="caption" tone="secondary" style={styles.localNote}>
                That&apos;s {localTime} on this phone&apos;s clock.
              </Text>
            ) : null}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <ReminderControls
              switchCaption="A notification when the reveal is ready."
              askCaption="We'll send one notification at the reveal time, nothing else."
            />
          </Card>
        ) : null}

        {instant ? (
          <Card>
            <Text variant="overline" tone="tertiary">
              Swipe reminder
            </Text>
            <Text variant="heading" style={styles.cardTitle}>
              When should we nudge you to swipe?
            </Text>
            <Text variant="caption" tone="secondary">
              You find out as soon as you match, so there is no set time. This is a daily reminder on this phone only.
            </Text>
            <View style={styles.stepper}>
              <TimeField accessibilityLabel="Swipe reminder time" value={swipeTime} onChange={setSwipeTime} />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <ReminderControls
              switchCaption="A notification at this time, every day."
              askCaption="We'll send one notification a day at this time, nothing else."
            />
          </Card>
        ) : null}

        {blocked.data ? (
          <Card>
            <Text variant="overline" tone="tertiary">
              Hidden authors
            </Text>
            <Text variant="heading" style={styles.cardTitle}>
              {blocked.data === 1 ? "You've hidden 1 author" : `You've hidden ${blocked.data} authors`}
            </Text>
            <Text variant="caption" tone="secondary">
              Their recipes don&apos;t show up for you or your partner. Showing them again brings back their recipes
              from your next queue.
            </Text>
            <View style={styles.stepper}>
              <Button
                title="Show them again"
                variant="secondary"
                loading={clearBlocks.isPending}
                onPress={() =>
                  Alert.alert("Show hidden authors again?", "Their recipes can appear in your dinner queue again.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Show them",
                      onPress: () =>
                        clearBlocks.mutate(undefined, {
                          onError: () => Alert.alert("Couldn't do that", "Please try again."),
                        }),
                    },
                  ])
                }
              />
            </View>
          </Card>
        ) : null}

        <Card>
          <Text variant="overline" tone="tertiary">
            Account
          </Text>
          <View style={styles.options}>
            <Button
              title="Terms of Use"
              variant="secondary"
              onPress={() => router.push("/legal/terms")}
            />
            <Button
              title="Privacy Policy"
              variant="secondary"
              onPress={() => router.push("/legal/privacy")}
            />
            <Button
              title="Delete my account"
              variant="ghost"
              loading={deleting}
              onPress={confirmDelete}
            />
          </View>
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.lg, marginTop: Spacing.lg },
  cardTitle: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
  options: { gap: Spacing.sm, marginTop: Spacing.md },
  stepper: { marginTop: Spacing.lg, alignItems: "flex-start" },
  localNote: { marginTop: Spacing.sm, marginBottom: Spacing.md },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.lg },
  switchRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  switchText: { flex: 1, gap: 2 },
});
