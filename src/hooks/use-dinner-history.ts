import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import type { Recipe } from '@/hooks/use-reveal';
import type { Dish } from '@/hooks/use-swipe-feed';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

/** One revealed day: `kind` says how the dishes were found, as in the reveal itself. Dishes are card-sized, not full recipes. */
export type HistoryDay = {
  deck_id: string;
  /** The couple's calendar day, 'YYYY-MM-DD'. */
  deck_date: string;
  kind: 'match' | 'closest' | 'surprise';
  round: number;
  dishes: Dish[];
};

type HistoryPage = { days: HistoryDay[]; /** Where the next (older) page starts; null on the last page. */ next_before: string | null };

/** The dinners the couple was shown on past reveals, newest first, a page at a time. */
export function useDinnerHistory(enabled = true) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useInfiniteQuery({
    queryKey: ['history', userId],
    enabled: enabled && !!userId,
    staleTime: 60_000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<HistoryPage> => {
      const { data, error } = await supabase.rpc('get_dinner_history', { p_before: pageParam });
      if (error) throw error;
      return data as HistoryPage;
    },
    getNextPageParam: (last) => last.next_before ?? undefined,
  });
}

/** The full recipe of a dish from an earlier day, fetched when it is opened. */
export function useHistoryRecipe(id: string | undefined, enabled: boolean) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['history-recipe', userId, id],
    enabled: enabled && !!userId && !!id,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Recipe> => {
      const { data, error } = await supabase.rpc('get_history_recipe', { p_id: id });
      if (error) throw error;
      return data as Recipe;
    },
  });
}
