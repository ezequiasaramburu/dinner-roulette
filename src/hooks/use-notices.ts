import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase, uniqueSuffix } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

/** A short message my partner's action left for me. Only I can read it; dismissing it removes it. */
export type Notice = {
  id: string;
  kind: 'match_goal_changed' | 'couple_ended' | 'partner_left';
  from_value: number | null;
  to_value: number | null;
  /** The partner's name, for notices about them leaving. */
  from_name: string | null;
  created_at: string;
};

export function useNotices(enabled: boolean) {
  const { session } = useAuth();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: ['notices', userId],
    enabled: enabled && !!userId,
    queryFn: async (): Promise<Notice[]> => {
      const { data, error } = await supabase.from('notices').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data as Notice[];
    },
  });

  // New notices appear while the app is open.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || !userId) return;
    const channel = supabase
      .channel(`notices-${userId}-${uniqueSuffix()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notices', filter: `recipient_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notices'] });
          // A partner leaving changes the couple itself, so look at that too.
          queryClient.invalidateQueries({ queryKey: ['couple'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, userId, queryClient]);

  return query;
}

export function useDismissNotice() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const key = ['notices', session?.user.id];

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('dismiss_notice', { p_id: id });
      if (error) throw error;
    },
    onMutate: (id) => {
      queryClient.setQueryData<Notice[]>(key, (list) => list?.filter((n) => n.id !== id));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
