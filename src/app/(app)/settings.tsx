import { useRouter } from "expo-router";
import { Alert, Linking, StyleSheet, Switch, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

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
import {
  useCouple,
  useUpdateCoupleSettings,
  type CoupleSettings,
} from "@/hooks/use-couple";
import { useDeleteAccount } from "@/hooks/use-account";
import { useReminders } from "@/hooks/use-reveal-reminder";
import { useTheme } from "@/hooks/use-theme";
import { timeInZoneToLocal } from "@/lib/zoned-time";

export default function Settings() {
  const { data: couple } = useCouple();
  const theme = useTheme();
  const { permission, enabled, request, setEnabled } = useReminders();
  const update = useUpdateCoupleSettings();
  const router = useRouter();
  const deleteAccount = useDeleteAccount();
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

  function confirmDelete() {
    const partner = couple?.partner?.display_name;
    const isOwner = couple?.role === "owner";
    Alert.alert(
      "Delete your account?",
      `This permanently deletes your account, food preferences and swipes. It can't be undone.${
        partner
          ? isOwner
            ? ` Your couple with ${partner} ends, and ${partner} will need to start or join a new one.`
            : ` ${partner} keeps the couple and can invite someone new.`
          : ""
      }`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () =>
            deleteAccount.mutate(undefined, {
              onError: () =>
                Alert.alert("Couldn't delete your account", "Please try again."),
            }),
        },
      ],
    );
  }

  return (
    <Screen>
      <BackButton />
      <Animated.View entering={FadeInDown.duration(500)} style={styles.stack}>
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

            {permission === "granted" ? (
              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text variant="bodyStrong">Remind me on this phone</Text>
                  <Text variant="caption" tone="secondary">
                    A notification when the reveal is ready.
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Remind me on this phone"
                  value={enabled}
                  onValueChange={setEnabled}
                  trackColor={{
                    true: theme.primary,
                    false: theme.borderStrong,
                  }}
                />
              </View>
            ) : permission === "denied" ? (
              <>
                <Text variant="bodyStrong">Reminders are off</Text>
                <Text
                  variant="caption"
                  tone="secondary"
                  style={styles.localNote}
                >
                  Notifications are blocked for Dinner Roulette. Allow them in
                  your phone&apos;s settings to get a reminder.
                </Text>
                <Button
                  title="Open settings"
                  variant="secondary"
                  onPress={() => Linking.openSettings()}
                />
              </>
            ) : permission === "undetermined" ? (
              <>
                <Text variant="bodyStrong">Get a reminder</Text>
                <Text
                  variant="caption"
                  tone="secondary"
                  style={styles.localNote}
                >
                  We&apos;ll send one notification at the reveal time, nothing
                  else.
                </Text>
                <Button
                  title="Turn on reminders"
                  variant="secondary"
                  onPress={request}
                />
              </>
            ) : null}
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
              loading={deleteAccount.isPending}
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
