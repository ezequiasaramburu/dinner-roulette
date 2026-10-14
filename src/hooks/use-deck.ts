import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

/** What a swipe card needs. Ingredients and steps stay on the server until the reveal. */
export type DeckRecipe = {
  id: string;
  title: string;
  image_url: string;
  country: string;
  category: string;
  dish_type: string;
  tags: string[];
  allergens: string[];
  diet_flags: string[];
};

export type Deck = {
  deck_id: string;
  /** The couple's local date, YYYY-MM-DD. */
  deck_date: string;
  /** How many dishes passed both partners' hard filters today. */
  pool_size: number;
  /** Dishes reused from the last 30 days because the pool ran thin. */
  repeat_count: number;
  recipes: DeckRecipe[];
  /** My own choices so far: recipe id -> liked. */
  my_swipes: Record<string, boolean>;
  /** How many dishes my partner has swiped. Never which ones. */
  partner_swiped: number;
};

/** TheMealDB serves resized thumbnails by appending a size to the image URL. */
export function thumbnail(url: string, size: 'small' | 'medium' | 'large' = 'medium') {
  return `${url}/${size}`;
}

/**
 * Today's deck for the couple (created by the server on first request, the same for both partners).
 * Only enable once both partners have finished their preferences.
 */
export function useTodayDeck(enabled: boolean) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['deck', userId],
    enabled: enabled && !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Deck> => {
      const { data, error } = await supabase.rpc('get_or_create_today_deck');
      if (error) throw error;
      return data as Deck;
    },
  });
}

type SwipeVars = { deckId: string; recipeId: string; liked: boolean };

/** Like or pass a dish. Optimistic: the card is gone instantly; rolled back if the server says no. */
export function useRecordSwipe() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const key = ['deck', session?.user.id];

  return useMutation({
    mutationFn: async ({ deckId, recipeId, liked }: SwipeVars) => {
      const { error } = await supabase.rpc('record_swipe', { p_deck_id: deckId, p_recipe_id: recipeId, p_liked: liked });
      if (error) throw error;
    },
    onMutate: async ({ recipeId, liked }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Deck>(key);
      queryClient.setQueryData<Deck>(key, (d) => d && { ...d, my_swipes: { ...d.my_swipes, [recipeId]: liked } });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
  });
}

/** Take back the last swipe. */
export function useUndoSwipe() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const key = ['deck', session?.user.id];

  return useMutation({
    mutationFn: async (deckId: string): Promise<string | null> => {
      const { data, error } = await supabase.rpc('undo_last_swipe', { p_deck_id: deckId });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    onSuccess: (recipeId) => {
      if (!recipeId) return;
      queryClient.setQueryData<Deck>(key, (d) => {
        if (!d) return d;
        const { [recipeId]: _removed, ...rest } = d.my_swipes;
        return { ...d, my_swipes: rest };
      });
    },
  });
}
