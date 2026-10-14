import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export type Profile = {
  id: string;
  display_name: string | null;
};

export function useProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', userId!)
        .single();
      if (error) {
        // No profile row means this account no longer exists (deleted here or on another phone) but the phone still
        // holds its login. Drop the login so the welcome screen shows instead of an error nobody can get out of.
        if (error.code === 'PGRST116') await supabase.auth.signOut({ scope: 'local' });
        throw error;
      }
      return data;
    },
  });
}

export function useUpdateDisplayName() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (displayName: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', session!.user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', session?.user.id] }),
  });
}
