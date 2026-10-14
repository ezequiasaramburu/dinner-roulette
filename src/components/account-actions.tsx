import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAccountActions } from '@/hooks/use-account';

/** Sign out and delete account, for the onboarding screens where the menu isn't available yet. */
export function AccountActions() {
  const { signOut, confirmDelete, deleting } = useAccountActions();
  return (
    <View style={styles.row}>
      <Button title="Sign out" variant="ghost" onPress={signOut} />
      <Button title="Delete my account" variant="ghost" onPress={confirmDelete} loading={deleting} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.xs, marginTop: Spacing.xl },
});
