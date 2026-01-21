import { describe, it, expect } from 'vitest';

describe('Parlay Validation', () => {
  describe('validateParlaySelections', () => {
    function validateMinSelections(selections: { selection_id: string }[]): boolean {
      return selections.length >= 2;
    }

    function hasNoCorrelatedSelections(
      selections: { selection_id: string; event_id: string }[]
    ): boolean {
      const eventIds = selections.map((s) => s.event_id);
      const uniqueEventIds = new Set(eventIds);
      return uniqueEventIds.size === eventIds.length;
    }

    it('should reject parlays with fewer than 2 selections', () => {
      expect(validateMinSelections([])).toBe(false);
      expect(validateMinSelections([{ selection_id: '1' }])).toBe(false);
    });

    it('should accept parlays with 2 or more selections', () => {
      expect(validateMinSelections([{ selection_id: '1' }, { selection_id: '2' }])).toBe(true);
      expect(
        validateMinSelections([
          { selection_id: '1' },
          { selection_id: '2' },
          { selection_id: '3' },
        ])
      ).toBe(true);
    });

    it('should reject selections from the same event', () => {
      const selections = [
        { selection_id: '1', event_id: 'event-1' },
        { selection_id: '2', event_id: 'event-1' },
      ];
      expect(hasNoCorrelatedSelections(selections)).toBe(false);
    });

    it('should accept selections from different events', () => {
      const selections = [
        { selection_id: '1', event_id: 'event-1' },
        { selection_id: '2', event_id: 'event-2' },
        { selection_id: '3', event_id: 'event-3' },
      ];
      expect(hasNoCorrelatedSelections(selections)).toBe(true);
    });
  });
});

describe('Parlay Odds Calculation', () => {
  describe('calculateCombinedOdds', () => {
    function calculateCombinedOdds(odds: number[]): number {
      return odds.reduce((acc, o) => acc * o, 1);
    }

    it('should multiply all selection odds together', () => {
      expect(calculateCombinedOdds([2.0, 2.0])).toBe(4.0);
      expect(calculateCombinedOdds([1.5, 2.0, 3.0])).toBe(9.0);
    });

    it('should handle decimal odds correctly', () => {
      const result = calculateCombinedOdds([1.91, 2.05, 1.87]);
      expect(result).toBeCloseTo(7.32, 2);
    });

    it('should return 1 for empty odds array', () => {
      expect(calculateCombinedOdds([])).toBe(1);
    });

    it('should handle single selection', () => {
      expect(calculateCombinedOdds([2.5])).toBe(2.5);
    });
  });

  describe('calculatePotentialPayout', () => {
    function calculatePotentialPayout(stake: number, combinedOdds: number): number {
      return stake * combinedOdds;
    }

    it('should calculate correct payout', () => {
      expect(calculatePotentialPayout(10, 4.0)).toBe(40);
      expect(calculatePotentialPayout(25, 9.0)).toBe(225);
    });

    it('should handle decimal stakes', () => {
      expect(calculatePotentialPayout(10.5, 2.0)).toBe(21);
    });
  });
});

describe('Parlay Settlement', () => {
  type LegStatus = 'pending' | 'won' | 'lost' | 'void';
  type ParlayStatus = 'pending' | 'won' | 'lost' | 'partially_void';

  interface Leg {
    status: LegStatus;
    odds: number;
  }

  function determineParlayStatus(legs: Leg[]): ParlayStatus {
    const hasLost = legs.some((l) => l.status === 'lost');
    const allSettled = legs.every((l) => l.status !== 'pending');
    const allWon = legs.every((l) => l.status === 'won');
    const hasVoid = legs.some((l) => l.status === 'void');

    if (hasLost) return 'lost';
    if (allSettled && allWon) return 'won';
    if (allSettled && hasVoid && legs.filter((l) => l.status !== 'void').every((l) => l.status === 'won')) {
      return 'partially_void';
    }
    return 'pending';
  }

  function recalculateOddsForVoidLegs(legs: Leg[]): number {
    return legs
      .filter((l) => l.status !== 'void')
      .reduce((acc, l) => acc * l.odds, 1);
  }

  describe('determineParlayStatus', () => {
    it('should mark as lost if any leg loses', () => {
      const legs: Leg[] = [
        { status: 'won', odds: 2.0 },
        { status: 'lost', odds: 1.5 },
        { status: 'pending', odds: 1.8 },
      ];
      expect(determineParlayStatus(legs)).toBe('lost');
    });

    it('should mark as won if all legs win', () => {
      const legs: Leg[] = [
        { status: 'won', odds: 2.0 },
        { status: 'won', odds: 1.5 },
        { status: 'won', odds: 1.8 },
      ];
      expect(determineParlayStatus(legs)).toBe('won');
    });

    it('should stay pending if some legs are not settled', () => {
      const legs: Leg[] = [
        { status: 'won', odds: 2.0 },
        { status: 'pending', odds: 1.5 },
      ];
      expect(determineParlayStatus(legs)).toBe('pending');
    });

    it('should mark as partially_void if void legs but rest won', () => {
      const legs: Leg[] = [
        { status: 'won', odds: 2.0 },
        { status: 'void', odds: 1.5 },
        { status: 'won', odds: 1.8 },
      ];
      expect(determineParlayStatus(legs)).toBe('partially_void');
    });

    it('should mark as lost even with void legs if any leg lost', () => {
      const legs: Leg[] = [
        { status: 'void', odds: 2.0 },
        { status: 'lost', odds: 1.5 },
        { status: 'won', odds: 1.8 },
      ];
      expect(determineParlayStatus(legs)).toBe('lost');
    });
  });

  describe('recalculateOddsForVoidLegs', () => {
    it('should exclude void legs from odds calculation', () => {
      const legs: Leg[] = [
        { status: 'won', odds: 2.0 },
        { status: 'void', odds: 1.5 },
        { status: 'won', odds: 1.8 },
      ];
      expect(recalculateOddsForVoidLegs(legs)).toBeCloseTo(3.6, 2);
    });

    it('should return original odds if no void legs', () => {
      const legs: Leg[] = [
        { status: 'won', odds: 2.0 },
        { status: 'won', odds: 1.5 },
      ];
      expect(recalculateOddsForVoidLegs(legs)).toBe(3.0);
    });

    it('should return 1 if all legs are void', () => {
      const legs: Leg[] = [
        { status: 'void', odds: 2.0 },
        { status: 'void', odds: 1.5 },
      ];
      expect(recalculateOddsForVoidLegs(legs)).toBe(1);
    });
  });
});
