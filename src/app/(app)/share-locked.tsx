import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { RecipesLocked } from '@/components/recipes-locked';
import { useCouple } from '@/hooks/use-couple';

/** Why sharing recipes is closed, for anyone without a paid plan. A purchase made from here opens the form. */
export default function ShareLocked() {
  const router = useRouter();
  const { data: couple } = useCouple();
  const subscribed = !!couple?.is_subscribed;

  useEffect(() => {
    if (subscribed) router.replace('/add-recipe');
  }, [subscribed, router]);

  return <RecipesLocked couple={couple ?? null} />;
}
