/**
 * Labels for the dates in the dinner history. Dates are the couple's local calendar days ('2026-10-23'), so "today" is
 * worked out on the couple's clock, not the phone's. Pure functions, no React Native imports, so they run under Node.
 */

const DAY = 86_400_000;
const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Today's date in `timeZone` as 'YYYY-MM-DD'. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/** "Today", "Yesterday", or like "Mon, Oct 12". */
export function dayLabel(iso: string, today: string): string {
  const days = Math.round((utc(today) - utc(iso)) / DAY);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Date(utc(iso)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
