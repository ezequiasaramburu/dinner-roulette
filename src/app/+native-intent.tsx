import { usePendingInvite } from '@/lib/pending-invite';

// Invite links look like swipefordinner://join/ABC123. We stash the code and send the
// user to the root, where the auth/onboarding guards decide which screen they see.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const match = path.match(/join\/([A-Za-z0-9]{6})(?:[/?#]|$)/);
    if (match) {
      usePendingInvite.getState().set(match[1].toUpperCase());
      return '/';
    }
  } catch {
    // fall through to the default behaviour
  }
  return path;
}
