import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button, Card, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { enter, exit } from '@/hooks/use-motion';
import { useDismissNotice, type Notice } from '@/hooks/use-notices';

/** What happened when a partner deleted their account. */
export function PartnerLeftNotice({ notice }: { notice: Notice }) {
  const dismiss = useDismissNotice();
  const who = notice.from_name ?? 'Your partner';
  const ended = notice.kind === 'couple_ended';

  return (
    <Animated.View entering={enter()} exiting={exit}>
      <Card tone="muted" padding="lg">
        <Text variant="bodyStrong">{ended ? `${who} deleted their account` : `${who} left`}</Text>
        <Text variant="caption" tone="secondary" style={styles.text}>
          {ended
            ? 'Your couple ended with it. Your food preferences are saved: start a new couple or join another with a code.'
            : 'Your couple is still here. Invite someone new whenever you like.'}
        </Text>
        <Button title="Got it" variant="secondary" onPress={() => dismiss.mutate(notice.id)} />
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  text: { marginTop: Spacing.xs, marginBottom: Spacing.md },
});
