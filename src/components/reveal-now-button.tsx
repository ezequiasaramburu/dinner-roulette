import { Alert } from 'react-native';

import { Button } from '@/components/ui';
import { useRevealNow } from '@/hooks/use-reveal';
import { friendlyError } from '@/lib/errors';

/** Instant mode: don't wait for the goal, show tonight's dinner now from what we've swiped so far. */
export function RevealNowButton({ partner, onKeepSwiping }: { partner: string; onKeepSwiping?: () => void }) {
  const revealNow = useRevealNow();

  function onPress() {
    Alert.alert(
      'Reveal with what we have?',
      `${partner.charAt(0).toUpperCase()}${partner.slice(1)} will see tonight's dinner too, and swiping closes for today. If you haven't matched, we'll show the closest dishes, or pick one that fits you both.`,
      [
        { text: onKeepSwiping ? 'Keep swiping' : 'Cancel', style: 'cancel', onPress: onKeepSwiping },
        {
          text: 'Reveal now',
          onPress: () => revealNow.mutate(undefined, { onError: (e) => Alert.alert('Error', friendlyError(e)) }),
        },
      ],
    );
  }

  return <Button title="Reveal with what we have" variant="secondary" onPress={onPress} loading={revealNow.isPending} />;
}
