import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { removeRecipePhoto, uploadRecipePhoto } from '@/lib/recipe-photo';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export type RecipeStatus = 'pending' | 'approved' | 'rejected';

/** A recipe I wrote, in whatever state of review it is in. */
export type MyRecipe = {
  id: string;
  title: string;
  country: string;
  status: RecipeStatus;
  review_note: string | null;
  submitted_at: string;
  image_url: string | null;
};

export function useMyRecipes() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['my-recipes', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyRecipe[]> => {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, country, status, review_note, submitted_at, image_url')
        .eq('author_id', userId!)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data as MyRecipe[];
    },
  });
}

export type NewRecipe = {
  title: string;
  country: string;
  ingredients: { name: string; measure: string }[];
  steps: string[];
  /** A local file (already resized) to upload with the recipe. */
  photoUri?: string | null;
  acceptTerms: boolean;
};

export function useSubmitRecipe() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (recipe: NewRecipe): Promise<string> => {
      // Upload only once everything else is ready, so a refused recipe leaves no photo behind.
      const imageUrl = recipe.photoUri && session ? await uploadRecipePhoto(session.user.id, recipe.photoUri) : null;
      const { data, error } = await supabase.rpc('submit_recipe', {
        p_title: recipe.title,
        p_country: recipe.country,
        p_ingredients: recipe.ingredients,
        p_steps: recipe.steps,
        p_image_url: imageUrl,
        p_accept_terms: recipe.acceptTerms,
      });
      if (error) {
        await removeRecipePhoto(imageUrl);
        throw error;
      }
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-recipes'] });
      // The first submission records that the terms were accepted.
      queryClient.invalidateQueries({ queryKey: ['profile', session?.user.id] });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recipe: Pick<MyRecipe, 'id' | 'image_url'>) => {
      const { error } = await supabase.rpc('delete_recipe', { p_recipe_id: recipe.id });
      if (error) throw error;
      await removeRecipePhoto(recipe.image_url);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-recipes'] }),
  });
}

export type ReportReason = 'offensive' | 'spam' | 'copied' | 'unsafe' | 'other';

/** Everything dinner-related that a hidden recipe may be showing in. */
function useRefreshDinner() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['reveal'] });
  };
}

export function useReportRecipe() {
  const refresh = useRefreshDinner();
  return useMutation({
    mutationFn: async ({ recipeId, reason, note }: { recipeId: string; reason: ReportReason; note?: string }) => {
      const { error } = await supabase.rpc('report_recipe', {
        p_recipe_id: recipeId,
        p_reason: reason,
        p_note: note?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

/** Hide everything by this recipe's author, for the whole couple. */
export function useBlockAuthor() {
  const refresh = useRefreshDinner();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recipeId: string) => {
      const { error } = await supabase.rpc('block_author', { p_recipe_id: recipeId });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ['blocked-count'] });
    },
  });
}

export function useBlockedCount() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['blocked-count', session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('blocked_authors_count');
      if (error) throw error;
      return data as number;
    },
  });
}

export function useClearBlocks() {
  const refresh = useRefreshDinner();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('clear_blocks');
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ['blocked-count'] });
    },
  });
}
