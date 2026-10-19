import { useCouple } from '@/hooks/use-couple';

/**
 * Where "Add a recipe" leads: the form for a subscribed couple, the explanation otherwise. Two routes, because the form
 * slides up from the bottom and the explanation is an ordinary screen that slides in from the side like the rest.
 * While the couple is still loading we send people to the form, which checks again on its own.
 */
export function useAddRecipePath() {
  const { data: couple } = useCouple();
  return couple === undefined || couple?.is_subscribed ? '/add-recipe' : '/share-locked';
}
