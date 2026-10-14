const MESSAGES: Record<string, string> = {
  invalid_code: 'That code is invalid or has expired. Ask your partner for a new one.',
  already_in_couple: "You're already part of a couple.",
  couple_full: 'That couple already has two people.',
  not_couple_owner: 'Only the person who created the couple can do that.',
  too_many_attempts: 'Too many wrong codes. Please wait a few minutes and try again.',
  too_many_invites: 'You\'ve asked for a lot of codes. Try again in a while, or use the one you have.',
  not_authenticated: 'Please sign in again.',
};

/** Turn a Supabase/Postgres error into something we can show a person. */
export function friendlyError(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  return MESSAGES[message] ?? 'Something went wrong. Please try again.';
}
