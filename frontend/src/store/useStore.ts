import { create } from 'zustand';

export interface BetSlipItem {
  selectionId: string;
  selectionName: string;
  odds: number;
  eventId: string;
  eventName: string;
  marketName: string;
  stake: number;
}

export type BetMode = 'singles' | 'parlay';

export interface User {
  id: string;
  email: string;
  username: string;
}

interface Store {
  user: User | null;
  setUser: (user: User | null) => void;

  betSlip: BetSlipItem[];
  addToBetSlip: (item: Omit<BetSlipItem, 'stake'>) => void;
  removeFromBetSlip: (selectionId: string) => void;
  updateStake: (selectionId: string, stake: number) => void;
  clearBetSlip: () => void;

  showBetSlip: boolean;
  toggleBetSlip: () => void;

  betMode: BetMode;
  setBetMode: (mode: BetMode) => void;
  parlayStake: number;
  setParlayStake: (stake: number) => void;
  getCombinedOdds: () => number;
  getParlayPayout: () => number;
  canCreateParlay: () => boolean;
  hasSameEventSelections: () => boolean;
}

export const useStore = create<Store>((set, get) => ({
  user: null,
  setUser: (user: User | null) => set({ user }),

  betSlip: [],
  addToBetSlip: (item: Omit<BetSlipItem, 'stake'>) =>
    set((state) => {
      if (state.betSlip.some((b) => b.selectionId === item.selectionId)) {
        return state;
      }
      return {
        betSlip: [...state.betSlip, { ...item, stake: 10 }],
        showBetSlip: true,
      };
    }),
  removeFromBetSlip: (selectionId: string) =>
    set((state) => ({
      betSlip: state.betSlip.filter((b) => b.selectionId !== selectionId),
    })),
  updateStake: (selectionId: string, stake: number) =>
    set((state) => ({
      betSlip: state.betSlip.map((b) =>
        b.selectionId === selectionId ? { ...b, stake } : b
      ),
    })),
  clearBetSlip: () => set({ betSlip: [], betMode: 'singles', parlayStake: 10 }),

  showBetSlip: false,
  toggleBetSlip: () => set((state) => ({ showBetSlip: !state.showBetSlip })),

  betMode: 'singles' as BetMode,
  setBetMode: (mode: BetMode) => set({ betMode: mode }),

  parlayStake: 10,
  setParlayStake: (stake: number) => set({ parlayStake: stake }),

  getCombinedOdds: (): number => {
    const { betSlip } = get();
    if (betSlip.length < 2) return 0;
    return betSlip.reduce((acc: number, item: BetSlipItem) => acc * item.odds, 1);
  },

  getParlayPayout: (): number => {
    const { betSlip, parlayStake } = get();
    if (betSlip.length < 2) return 0;
    const combinedOdds = betSlip.reduce((acc: number, item: BetSlipItem) => acc * item.odds, 1);
    return parlayStake * combinedOdds;
  },

  canCreateParlay: (): boolean => {
    const { betSlip } = get();
    if (betSlip.length < 2) return false;
    const eventIds = betSlip.map((b: BetSlipItem) => b.eventId);
    const uniqueEventIds = new Set(eventIds);
    return uniqueEventIds.size === eventIds.length;
  },

  hasSameEventSelections: (): boolean => {
    const { betSlip } = get();
    if (betSlip.length < 2) return false;
    const eventIds = betSlip.map((b: BetSlipItem) => b.eventId);
    const uniqueEventIds = new Set(eventIds);
    return uniqueEventIds.size !== eventIds.length;
  },
}));
