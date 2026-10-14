import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
  imageUrl?: string | null;
  acceptTerms: boolean;
};

export function useSubmitRecipe() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (recipe: NewRecipe): Promise<string> => {
      const { data, error } = await supabase.rpc('submit_recipe', {
        p_title: recipe.title,
        p_country: recipe.country,
        p_ingredients: recipe.ingredients,
        p_steps: recipe.steps,
        p_image_url: recipe.imageUrl ?? null,
        p_accept_terms: recipe.acceptTerms,
      });
      if (error) throw error;
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_recipe', { p_recipe_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-recipes'] }),
  });
}
