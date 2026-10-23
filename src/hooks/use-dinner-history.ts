import { useQuery } from '@tanstack/react-query';

import type { Recipe } from '@/hooks/use-reveal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

/** One revealed day: `kind` says how the dishes were found, as in the reveal itself. */
export type HistoryDay = {
  deck_id: string;
  /** The couple's calendar day, 'YYYY-MM-DD'. */
  deck_date: string;
  kind: 'match' | 'closest' | 'surprise';
  round: number;
  dishes: Recipe[];
};

/** The dinners the couple was shown on past reveals, newest first, with the full recipes. */
export function useDinnerHistory(enabled = true) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['history', userId],
    enabled: enabled && !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<HistoryDay[]> => {
      const { data, error } = await supabase.rpc('get_dinner_history');
      if (error) throw error;
      return data as HistoryDay[];
    },
  });
}
