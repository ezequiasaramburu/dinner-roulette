import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';

import { supabase } from '@/lib/supabase';

/** Deletes the account for good, then signs this phone out. The auth listener swaps back to the welcome screen. */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delete_account');
      if (error) throw error;
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      // The user no longer exists on the server, so only clear the session on this phone.
      await supabase.auth.signOut({ scope: 'local' });
      queryClient.clear();
    },
  });
}
