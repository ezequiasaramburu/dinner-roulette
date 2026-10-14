const MESSAGES: Record<string, string> = {
  invalid_code: 'That code is invalid or has expired. Ask your partner for a new one.',
  already_in_couple: "You're already part of a couple.",
  couple_full: 'That couple already has two people.',
  not_couple_owner: 'Only the person who created the couple can do that.',
  too_many_attempts: 'Too many wrong codes. Please wait a few minutes and try again.',
  too_many_invites: 'You\'ve asked for a lot of codes. Try again in a while, or use the one you have.',
  not_revealed: 'There is no dinner to swipe again for yet.',
  already_matched: 'You matched, so there is nothing to swipe again.',
  swipe_again_used: 'You already used your extra round today.',
  nothing_left: 'There are no new dishes left to swipe today.',
  nothing_swiped: 'Swipe a few dishes first, then you can reveal.',
  invalid_title: 'Give your recipe a title of 3 to 80 characters.',
  invalid_country: 'Choose a country from the list.',
  invalid_ingredients: 'Add 3 to 30 ingredients, each with a name.',
  invalid_steps: 'Add 1 to 25 steps, each with a few words.',
  links_not_allowed: 'Links aren\'t allowed in recipes. Write it in your own words.',
  invalid_image: 'That photo could not be used. Try another one.',
  terms_required: 'Please confirm the terms to share a recipe.',
  too_many_recipes: 'You\'ve shared 5 recipes today. Try again tomorrow.',
  too_many_pending: 'You already have 10 recipes waiting for review. We\'ll get to them soon.',
  cannot_block_partner: 'That recipe is your partner\'s, so it can\'t be hidden. Just swipe left on it.',
  cannot_block_yourself: 'That\'s your own recipe.',
  cannot_report_own_recipe: 'That\'s your own recipe.',
  recipe_not_found: 'That recipe is no longer available.',
  not_authenticated: 'Please sign in again.',
};

/** Turn a Supabase/Postgres error into something we can show a person. */
export function friendlyError(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  return MESSAGES[message] ?? 'Something went wrong. Please try again.';
}
