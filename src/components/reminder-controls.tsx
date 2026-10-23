import { Linking, StyleSheet, Switch, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useReminders } from '@/hooks/use-reveal-reminder';
import { useTheme } from '@/hooks/use-theme';

/** The on-this-phone reminder switch, or what to do to get one: allow notifications first. */
export function ReminderControls({ switchCaption, askCaption }: { switchCaption: string; askCaption: string }) {
  const theme = useTheme();
  const { permission, enabled, request, setEnabled } = useReminders();

  if (permission === 'granted') {
    return (
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text variant="bodyStrong">Remind me on this phone</Text>
          <Text variant="caption" tone="secondary">
            {switchCaption}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Remind me on this phone"
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ true: theme.primary, false: theme.borderStrong }}
        />
      </View>
    );
  }
  if (permission === 'denied') {
    return (
      <>
        <Text variant="bodyStrong">Reminders are off</Text>
        <Text variant="caption" tone="secondary" style={styles.note}>
          Notifications are blocked for Swipe for Dinner. Allow them in your phone&apos;s settings to get a reminder.
        </Text>
        <Button title="Open settings" variant="secondary" onPress={() => Linking.openSettings()} />
      </>
    );
  }
  if (permission === 'undetermined') {
    return (
      <>
        <Text variant="bodyStrong">Get a reminder</Text>
        <Text variant="caption" tone="secondary" style={styles.note}>
          {askCaption}
        </Text>
        <Button title="Turn on reminders" variant="secondary" onPress={request} />
      </>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  switchText: { flex: 1, gap: 2 },
  note: { marginTop: Spacing.sm, marginBottom: Spacing.md },
});
