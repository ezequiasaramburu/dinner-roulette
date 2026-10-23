import { create } from 'zustand';

/**
 * Invite code captured from a deep link (swipefordinner://join/ABC123) before the
 * user is signed in or ready to join. The join screen consumes it.
 */
type PendingInvite = {
  code: string | null;
  set: (code: string) => void;
  clear: () => void;
};

export const usePendingInvite = create<PendingInvite>((set) => ({
  code: null,
  set: (code) => set({ code }),
  clear: () => set({ code: null }),
}));
