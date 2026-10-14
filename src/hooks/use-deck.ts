import { useQuery } from '@tanstack/react-query';

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
