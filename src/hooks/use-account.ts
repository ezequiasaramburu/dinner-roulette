import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

import { removeAllMyPhotos } from '@/lib/recipe-photo';
import { supabase } from '@/lib/supabase';

/** Deletes the account for good, then signs this phone out. The auth listener swaps back to the welcome screen. */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Photos can only be removed while still signed in, so they go first. A failure here must not block deleting.
      const { data } = await supabase.auth.getUser();
      if (data.user) await removeAllMyPhotos(data.user.id);
      const { error } = await supabase.rpc('delete_account');
      if (error) throw error;
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      // The user no longer exists on the server, so only clear the session on this phone.
      await supabase.auth.signOut({ scope: 'local' });
      queryClient.clear();
    },
  });
}

/**
 * Sign out and delete-account with their confirmations, for any screen that offers them.
 * `partner` and `isOwner` only change what the delete dialog says will happen to the other person.
 */
export function useAccountActions(partner?: string | null, isOwner?: boolean) {
  const deleteAccount = useDeleteAccount();

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Could not sign out', error.message);
  }

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      `This permanently deletes your account, food preferences and swipes. It can't be undone.${
        partner
          ? isOwner
            ? ` Your couple with ${partner} ends, and ${partner} will need to start or join a new one.`
            : ` ${partner} keeps the couple and can invite someone new.`
          : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () =>
            deleteAccount.mutate(undefined, {
              onError: () => Alert.alert("Couldn't delete your account", 'Please try again.'),
            }),
        },
      ],
    );
  }

  return { signOut, confirmDelete, deleting: deleteAccount.isPending };
}
