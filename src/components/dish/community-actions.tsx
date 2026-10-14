import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ReportSheet } from '@/components/dish/report-sheet';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useCouple } from '@/hooks/use-couple';
import { useBlockAuthor } from '@/hooks/use-recipes';
import type { Dish } from '@/hooks/use-swipe-feed';
import { friendlyError } from '@/lib/errors';

type Props = {
  dish: Pick<Dish, 'id' | 'title' | 'community' | 'authored_by'>;
  /** Called once the recipe has been reported or its author hidden, so the screen can move on. */
  onDone?: () => void;
};

/**
 * Report this recipe, or hide its author. Only for recipes written by someone outside the couple:
 * your own and your partner's can't be reported or hidden from here.
 */
export function CommunityActions({ dish, onDone }: Props) {
  const { data: couple } = useCouple();
  const block = useBlockAuthor();
  const [reporting, setReporting] = useState(false);

  if (!dish.community || dish.authored_by) return null;

  const partner = couple?.partner?.display_name ?? 'your partner';

  function confirmBlock() {
    Alert.alert(
      "Hide this author's recipes?",
      `You won't see any recipes by this author again, and neither will ${partner}, because you share one dinner queue. ` +
        "They won't be told. You can undo this any time in Settings.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide author',
          style: 'destructive',
          onPress: () =>
            block.mutate(dish.id, {
              onSuccess: () => onDone?.(),
              onError: (e) => Alert.alert("Couldn't hide this author", friendlyError(e)),
            }),
        },
      ],
    );
  }

  return (
    <View style={styles.row}>
      <Button title="Report" variant="ghost" onPress={() => setReporting(true)} style={styles.button} />
      <Button title="Hide author" variant="ghost" onPress={confirmBlock} loading={block.isPending} style={styles.button} />
      <ReportSheet
        recipeId={dish.id}
        title={dish.title}
        visible={reporting}
        onClose={() => setReporting(false)}
        onReported={() => onDone?.()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md },
  button: { flex: 1 },
});
