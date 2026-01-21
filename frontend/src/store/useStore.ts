import { create } from 'zustand';

export interface BetSlipItem {
  selectionId: string;
  selectionName: string;
  odds: number;
  eventName: string;
  marketName: string;
  stake: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
}

interface Store {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;

  // Bet slip
  betSlip: BetSlipItem[];
  addToBetSlip: (item: Omit<BetSlipItem, 'stake'>) => void;
  removeFromBetSlip: (selectionId: string) => void;
  updateStake: (selectionId: string, stake: number) => void;
  clearBetSlip: () => void;

  // UI
  showBetSlip: boolean;
  toggleBetSlip: () => void;
}

export const useStore = create<Store>((set) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // Bet slip
  betSlip: [],
  addToBetSlip: (item) =>
    set((state) => {
      // Don't add duplicates
      if (state.betSlip.some((b) => b.selectionId === item.selectionId)) {
        return state;
      }
      return {
        betSlip: [...state.betSlip, { ...item, stake: 10 }],
        showBetSlip: true,
      };
    }),
  removeFromBetSlip: (selectionId) =>
    set((state) => ({
      betSlip: state.betSlip.filter((b) => b.selectionId !== selectionId),
    })),
  updateStake: (selectionId, stake) =>
    set((state) => ({
      betSlip: state.betSlip.map((b) =>
        b.selectionId === selectionId ? { ...b, stake } : b
      ),
    })),
  clearBetSlip: () => set({ betSlip: [] }),

  // UI
  showBetSlip: false,
  toggleBetSlip: () => set((state) => ({ showBetSlip: !state.showBetSlip })),
}));
