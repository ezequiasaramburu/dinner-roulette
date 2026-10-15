import Constants from "expo-constants";
import { Platform, StyleSheet, View } from "react-native";

import { Avatar, MenuItem, MenuLabel, SideMenu, Text } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type MenuPath =
  | "/preferences"
  | "/settings"
  | "/recipes"
  | "/add-recipe"
  | "/legal/terms"
  | "/legal/privacy";

type Props = {
  visible: boolean;
  onClose: () => void;
  onNavigate: (path: MenuPath) => void;
  onSignOut: () => void;
  me: string;
  partner: string;
  matchGoal: number;
  /** What the reveal row says: "When you match" or "At 17:00". */
  revealLabel: string;
};

export function HomeMenu({
  visible,
  onClose,
  onNavigate,
  onSignOut,
  me,
  partner,
  matchGoal,
  revealLabel,
}: Props) {
  const theme = useTheme();

  return (
    <SideMenu visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <View style={styles.avatars}>
          <Avatar name={me} size={60} colorIndex={0} />
          <View style={styles.second}>
            <Avatar name={partner} size={60} colorIndex={1} />
          </View>
        </View>
        <Text variant="heading" style={styles.names}>
          {me} & {partner}
        </Text>
        <Text variant="caption" tone="secondary">
          Dinner for two
        </Text>
      </View>

      <View style={[styles.stats, { backgroundColor: theme.surfaceMuted }]}>
        <View style={styles.stat}>
          <Text variant="overline" tone="tertiary">
            Matches
          </Text>
          <Text variant="bodyStrong" style={styles.statValue}>
            {matchGoal} a day
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.stat}>
          <Text variant="overline" tone="tertiary">
            Reveal
          </Text>
          <Text variant="bodyStrong" style={styles.statValue}>
            {revealLabel}
          </Text>
        </View>
      </View>

      <MenuLabel>Your dinners</MenuLabel>
      <View style={styles.items}>
        <MenuItem
          icon="nutrition-outline"
          label="Food preferences"
          caption="Diet, allergies and tastes"
          onPress={() => onNavigate("/preferences")}
        />
        <MenuItem
          icon="settings-outline"
          label="Settings"
          caption="Matches per day and reveal time"
          onPress={() => onNavigate("/settings")}
        />
      </View>

      <MenuLabel>Recipes</MenuLabel>
      <View style={styles.items}>
        <MenuItem
          icon="create-outline"
          label="Add a recipe"
          caption="Share a dish with everyone"
          onPress={() => onNavigate("/add-recipe")}
        />
        <MenuItem
          icon="book-outline"
          label="Your recipes"
          caption="See where each one is in review"
          onPress={() => onNavigate("/recipes")}
        />
      </View>

      <View style={styles.spacer} />

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <MenuItem icon="log-out-outline" label="Sign out" onPress={onSignOut} />
        <View style={styles.legal}>
          <Text
            variant="caption"
            tone="tertiary"
            onPress={() => onNavigate("/legal/terms")}
          >
            Terms
          </Text>
          <Text variant="caption" tone="tertiary">
            ·
          </Text>
          <Text
            variant="caption"
            tone="tertiary"
            onPress={() => onNavigate("/legal/privacy")}
          >
            Privacy
          </Text>
          <Text variant="caption" tone="tertiary">
            ·
          </Text>
          <Text variant="caption" tone="tertiary">
            v{Constants.expoConfig?.version ?? "1.0.0"}
          </Text>
        </View>
      </View>
    </SideMenu>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: Spacing.xs, paddingBottom: Spacing.lg },
  avatars: { flexDirection: "row", alignItems: "center" },
  second: { marginLeft: -14 },
  names: { marginTop: Spacing.sm, textAlign: "center" },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  // One point smaller on Android, where this text renders a little wider.
  statValue: Platform.select({
    android: { fontSize: 14.5, lineHeight: 22 },
    default: {},
  }),
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch" },
  items: { gap: Spacing.xs },
  spacer: { flex: 1 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  legal: { flexDirection: "row", justifyContent: "center", gap: Spacing.sm },
});
