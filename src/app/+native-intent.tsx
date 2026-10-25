import { usePendingInvite } from '@/lib/pending-invite';

// Invite links look like https://www.swipefordinner.app/join?code=ABC123 (shared from the app) or
// swipefordinner://join/ABC123 (the website's "Open in the app" button). We stash the code and send the
// user to the root, where the auth/onboarding guards decide which screen they see.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const match = path.match(/join(?:\/|\?code=)([A-Za-z0-9]{6})(?:[/?#&]|$)/);
    if (match) {
      usePendingInvite.getState().set(match[1].toUpperCase());
      return '/';
    }
  } catch {
    // fall through to the default behaviour
  }
  return path;
}
