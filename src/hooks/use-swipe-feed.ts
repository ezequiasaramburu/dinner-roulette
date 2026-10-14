import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

/** What a swipe card needs. Ingredients and steps stay on the server until the reveal. */
export type Dish = {
  id: string;
  title: string;
  image_url: string;
  country: string;
  category: string;
  dish_type: string;
  tags: string[];
  allergens: string[];
  diet_flags: string[];
  /** Easy swaps that make the dish fit a diet, e.g. chicken stock cube -> vegetable stock cube. */
  swaps: { from: string; to: string }[];
};

/**
 * The couple's endless queue for the current dinner cycle, seen from my side.
 *  - ready: swipe the dishes below (the next few, in order)
 *  - goal_reached: the couple has enough matches, swiping is over until the reveal
 *  - exhausted: I've been through every dish that fits us both
 * There are deliberately no counts here: no "N left", no partner progress.
 */
export type SwipeFeed = {
  deck_id: string;
  cycle_date: string;
  /** False once tonight's reveal has passed: swipes now count toward tomorrow. */
  for_today: boolean;
  status: 'ready' | 'goal_reached' | 'exhausted';
  has_swiped: boolean;
  dishes: Dish[];
};

/** TheMealDB serves resized thumbnails by appending a size to the image URL. */
export function thumbnail(url: string, size: 'small' | 'medium' | 'large' = 'medium') {
  return `${url}/${size}`;
}

/**
 * Dishes I swiped this session. A refetch can land while a swipe is still in flight, so the feed filters these
 * out instead of letting a card I just swiped reappear. History powers undo within the session.
 */
type Session = { swiped: Set<string>; history: { dish: Dish; liked: boolean }[]; deckId: string | null };
const session: Session = { swiped: new Set(), history: [], deckId: null };

/** Reactive view of "can I undo?" for the UI. */
export const useUndoAvailable = create<{ count: number; sync: () => void }>((set) => ({
  count: 0,
  sync: () => set({ count: session.history.length }),
}));

function resetSessionFor(deckId: string) {
  if (session.deckId === deckId) return;
  session.deckId = deckId;
  session.swiped.clear();
  session.history.length = 0;
  useUndoAvailable.getState().sync();
}

export function useSwipeFeed(enabled: boolean) {
  const { session: auth } = useAuth();
  const userId = auth?.user.id;

  return useQuery({
    queryKey: ['feed', userId],
    enabled: enabled && !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<SwipeFeed> => {
      const { data, error } = await supabase.rpc('get_swipe_feed');
      if (error) throw error;
      const feed = data as SwipeFeed;
      resetSessionFor(feed.deck_id);
      return { ...feed, dishes: feed.dishes.filter((d) => !session.swiped.has(d.id)) };
    },
  });
}

type SwipeVars = { deckId: string; dish: Dish; liked: boolean };

/** Like or pass a dish. Optimistic: the card is gone instantly and restored if the server refuses. */
export function useRecordSwipe() {
  const queryClient = useQueryClient();
  const { session: auth } = useAuth();
  const key = ['feed', auth?.user.id];

  return useMutation({
    mutationFn: async ({ deckId, dish, liked }: SwipeVars): Promise<{ status: 'ready' | 'goal_reached' }> => {
      const { data, error } = await supabase.rpc('record_swipe', { p_deck_id: deckId, p_recipe_id: dish.id, p_liked: liked });
      if (error) throw error;
      return data as { status: 'ready' | 'goal_reached' };
    },
    onMutate: ({ dish, liked }) => {
      session.swiped.add(dish.id);
      session.history.push({ dish, liked });
      useUndoAvailable.getState().sync();
      queryClient.setQueryData<SwipeFeed>(key, (f) =>
        f && { ...f, has_swiped: true, dishes: f.dishes.filter((d) => d.id !== dish.id) },
      );
    },
    onSuccess: (result) => {
      if (result.status === 'goal_reached') {
        queryClient.setQueryData<SwipeFeed>(key, (f) => f && { ...f, status: 'goal_reached', dishes: [] });
        return;
      }
      // Running low: ask the server for the next few.
      const left = queryClient.getQueryData<SwipeFeed>(key)?.dishes.length ?? 0;
      if (left <= 2 && queryClient.isMutating({ mutationKey: ['swipe'] }) <= 1) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: (error, { dish }) => {
      session.swiped.delete(dish.id);
      session.history = session.history.filter((h) => h.dish.id !== dish.id);
      useUndoAvailable.getState().sync();
      if (String((error as { message?: string }).message).includes('deck_closed')) {
        // The couple reached its goal (or the cycle rolled over) while this swipe was in flight.
        queryClient.invalidateQueries({ queryKey: key });
        return;
      }
      queryClient.setQueryData<SwipeFeed>(key, (f) => f && { ...f, dishes: [dish, ...f.dishes] });
    },
    mutationKey: ['swipe'],
  });
}

/** Take back my last swipe (this session only: the card comes back on top). */
export function useUndoSwipe() {
  const queryClient = useQueryClient();
  const { session: auth } = useAuth();
  const key = ['feed', auth?.user.id];

  return useMutation({
    mutationFn: async (deckId: string): Promise<string | null> => {
      const { data, error } = await supabase.rpc('undo_last_swipe', { p_deck_id: deckId });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    onSuccess: (recipeId) => {
      const last = session.history.pop();
      useUndoAvailable.getState().sync();
      if (!recipeId || !last) return;
      session.swiped.delete(last.dish.id);
      queryClient.setQueryData<SwipeFeed>(key, (f) => f && { ...f, status: 'ready', dishes: [last.dish, ...f.dishes] });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
