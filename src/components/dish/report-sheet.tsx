import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, OptionCard, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useReportRecipe, type ReportReason } from '@/hooks/use-recipes';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/lib/errors';

const REASONS: { id: ReportReason; title: string; description: string }[] = [
  { id: 'offensive', title: 'Offensive or inappropriate', description: 'Hateful, rude or not for a recipe app.' },
  { id: 'spam', title: 'Spam or an advert', description: 'Promoting something, or nonsense.' },
  { id: 'copied', title: 'Copied from somewhere else', description: 'It looks like someone else\'s recipe.' },
  { id: 'unsafe', title: 'Unsafe or misleading', description: 'It could make someone ill or the details are wrong.' },
  { id: 'other', title: 'Something else', description: 'Anything that doesn\'t fit above.' },
];

type Props = { recipeId: string; title: string; visible: boolean; onClose: () => void; onReported: () => void };

/** Ask why, send the report. The recipe is hidden for the reporter's couple straight away. */
export function ReportSheet({ recipeId, title, visible, onClose, onReported }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const report = useReportRecipe();
  const [reason, setReason] = useState<ReportReason | null>(null);

  function send() {
    if (!reason) return;
    report.mutate(
      { recipeId, reason },
      {
        onSuccess: () => {
          setReason(null);
          onClose();
          Alert.alert('Thanks for telling us', "We've hidden this recipe for you and we'll take a look at it.");
          onReported();
        },
        onError: (e) => Alert.alert("Couldn't send your report", friendlyError(e)),
      },
    );
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.scrim, { backgroundColor: theme.overlay }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.lg },
          ]}>
          <View style={[styles.grabber, { backgroundColor: theme.borderStrong }]} />
          <Text variant="overline" tone="primary">
            Report a recipe
          </Text>
          <Text variant="heading" numberOfLines={2}>
            {title}
          </Text>
          <Text variant="caption" tone="secondary">
            What&apos;s wrong with it? The author isn&apos;t told who reported it.
          </Text>
          <View style={styles.reasons}>
            {REASONS.map((r) => (
              <OptionCard key={r.id} title={r.title} description={r.description} selected={reason === r.id} onPress={() => setReason(r.id)} />
            ))}
          </View>
          <Button title="Send report" onPress={send} disabled={!reason} loading={report.isPending} />
          <Button title="Cancel" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.sm },
  reasons: { gap: Spacing.sm, marginVertical: Spacing.md },
});
