import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export type Preferences = {
  diet: 'none' | 'pescatarian' | 'vegetarian' | 'vegan';
  allergens: string[];
  cuisines: string[];
  disliked: string[];
};

export const EMPTY_PREFERENCES: Preferences = { diet: 'none', allergens: [], cuisines: [], disliked: [] };

/** The signed-in user's saved preferences, or null if they haven't set any yet. */
export function usePreferences() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['preferences', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Preferences | null> => {
      const { data, error } = await supabase
        .from('preferences')
        .select('diet, allergens, cuisines, disliked')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Preferences | null;
    },
  });
}

export function useSavePreferences() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: Preferences) => {
      const { error } = await supabase
        .from('preferences')
        .upsert({ user_id: session!.user.id, ...prefs });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['preferences'] }),
        queryClient.invalidateQueries({ queryKey: ['couple'] }),
      ]),
  });
}

export type CuisineOption = { country: string; recipe_count: number };

export function useCuisineOptions() {
  return useQuery({
    queryKey: ['cuisine-options'],
    staleTime: Infinity,
    queryFn: async (): Promise<CuisineOption[]> => {
      const { data, error } = await supabase
        .from('cuisine_options')
        .select('country, recipe_count')
        .order('recipe_count', { ascending: false });
      if (error) throw error;
      return data as CuisineOption[];
    },
  });
}
