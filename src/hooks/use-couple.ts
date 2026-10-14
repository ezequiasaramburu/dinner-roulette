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
  /** 'scheduled': reveal at reveal_time. 'instant': reveal as soon as the match goal is reached. */
  reveal_mode: 'scheduled' | 'instant';
  /** How many matches the couple wants revealed each day (1 to 5). */
  match_goal: number;
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
      const { error } = await supabase.rpc('create_couple', {
        p_timezone: timezone,
      });
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
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCouple();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('cancel_couple');
      if (error) throw error;
    },
    onSuccess: () => {
      // The couple's invites are deleted with it, so never show a cached code again.
      queryClient.removeQueries({ queryKey: ['invite-code'] });
      return invalidate();
    },
  });
}

/**
 * The owner's current invite code (created on first call, reused until used or expired).
 * Keyed by couple so a code can never outlive the couple it belongs to.
 */
export function useInviteCode(coupleId: string | undefined) {
  return useQuery({
    queryKey: ['invite-code', coupleId],
    enabled: !!coupleId,
    staleTime: 5 * 60_000,
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
        {
          event: '*',
          schema: 'public',
          table: 'couple_members',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => invalidate(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId]);
}

/** Change how many matches the couple wants each day. Either partner can do it. */
export type CoupleSettings = {
  matchGoal?: number;
  revealMode?: 'scheduled' | 'instant';
  revealTime?: string;
};

/** Change couple-wide settings (either partner can). Pass only what changes. */
export function useUpdateCoupleSettings() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const key = ['couple', session?.user.id];

  return useMutation({
    mutationFn: async ({ matchGoal, revealMode, revealTime }: CoupleSettings) => {
      const { error } = await supabase.rpc('update_couple_settings', {
        p_match_goal: matchGoal ?? null,
        p_reveal_mode: revealMode ?? null,
        p_reveal_time: revealTime ?? null,
      });
      if (error) throw error;
    },
    onMutate: async ({ matchGoal, revealMode, revealTime }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CoupleState | null>(key);
      queryClient.setQueryData<CoupleState | null>(key, (c) =>
        c
          ? {
              ...c,
              match_goal: matchGoal ?? c.match_goal,
              reveal_mode: revealMode ?? c.reveal_mode,
              reveal_time: revealTime ?? c.reveal_time,
            }
          : c,
      );
      return { previous };
    },
    onError: (_e, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    // Settings change which queue is current and whether a reveal is open, so everything dinner-related refetches.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['reveal'] });
      queryClient.invalidateQueries({ queryKey: ['couple'] });
    },
  });
}

/** The partner's swipes can open an instant reveal and their settings change ours: refetch when either happens. */
export function useDinnerRealtime(coupleId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!coupleId) return;
    const refresh = (keys: string[]) => () => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    const channel = supabase
      .channel(`dinner-${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_decks',
          filter: `couple_id=eq.${coupleId}`,
        },
        refresh(['reveal', 'feed']),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couples',
          filter: `id=eq.${coupleId}`,
        },
        refresh(['couple', 'feed', 'reveal']),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId, queryClient]);
}
