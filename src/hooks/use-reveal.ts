import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Dish } from '@/hooks/use-swipe-feed';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export type Ingredient = { name: string; measure: string };

/** A dish with everything needed to cook it. Only exists after the reveal. */
export type Recipe = Dish & {
  ingredients: Ingredient[];
  steps: string[];
  youtube_url: string | null;
  source_url: string | null;
};

/**
 * Today's reveal, seen by both partners alike.
 *  - pending: the reveal time hasn't come yet
 *  - revealed: `kind` says how the dinner was found
 *      match     dishes you both liked
 *      closest   nothing shared, so dishes one of you liked
 *      surprise  nobody liked anything, so we picked the best fit
 *      none      nothing to pick from
 */
export type Reveal =
  | { status: 'pending'; reveal_at: string }
  | {
      status: 'revealed';
      reveal_at: string;
      deck_id: string;
      kind: 'match' | 'closest' | 'surprise' | 'none';
      seen: boolean;
      dishes: Recipe[];
    };

export function useReveal(enabled: boolean) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['reveal', userId],
    enabled: enabled && !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<Reveal> => {
      const { data, error } = await supabase.rpc('get_reveal');
      if (error) throw error;
      return data as Reveal;
    },
  });
}

/** Remember that I opened the reveal, so the animation plays once and home stops saying "new". */
export function useMarkRevealSeen() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const key = ['reveal', session?.user.id];

  return useMutation({
    mutationFn: async (deckId: string) => {
      const { error } = await supabase.rpc('mark_reveal_seen', { p_deck_id: deckId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData<Reveal>(key, (r) => (r && r.status === 'revealed' ? { ...r, seen: true } : r));
    },
  });
}
