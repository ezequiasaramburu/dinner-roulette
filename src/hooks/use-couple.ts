import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export type CoupleState = {
  couple_id: string;
  role: 'owner' | 'partner';
  timezone: string;
  /** "HH:MM" in the couple's timezone. */
  reveal_time: string;
  /** The current user has finished choosing their food preferences. */
  me_ready: boolean;
  partner: { id: string; display_name: string | null; ready: boolean } | null;
};

/** The signed-in user's couple, or null if they haven't created/joined one. */
export function useCouple() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['couple', userId],
    enabled: !!userId,
    queryFn: async (): Promise<CoupleState | null> => {
      const { data, error } = await supabase.rpc('get_couple_state');
      if (error) throw error;
      return (data as CoupleState | null) ?? null;
    },
  });
}

function useInvalidateCouple() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['couple'] });
}

export function useCreateCouple() {
  const invalidate = useInvalidateCouple();
  return useMutation({
    mutationFn: async () => {
      const timezone = getCalendars()[0]?.timeZone ?? 'UTC';
      const { error } = await supabase.rpc('create_couple', { p_timezone: timezone });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useJoinCouple() {
  const invalidate = useInvalidateCouple();
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.rpc('join_couple', { p_code: code });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCancelCouple() {
  const invalidate = useInvalidateCouple();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('cancel_couple');
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** The owner's current invite code (created on first call, reused until used or expired). */
export function useInviteCode(enabled: boolean) {
  return useQuery({
    queryKey: ['invite-code'],
    enabled,
    staleTime: Infinity,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('create_invite');
      if (error) throw error;
      return data as string;
    },
  });
}

/** Refetch the couple the moment a member row is added, so the owner sees the partner join. */
export function useCoupleRealtime(coupleId: string | undefined) {
  const invalidate = useInvalidateCouple();

  useEffect(() => {
    if (!coupleId) return;
    const channel = supabase
      .channel(`couple-members-${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'couple_members', filter: `couple_id=eq.${coupleId}` },
        () => invalidate(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId]);
}
