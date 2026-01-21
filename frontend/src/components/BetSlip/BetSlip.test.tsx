import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../test/utils/render';
import { BetSlip } from './BetSlip';
import { useStore } from '../../store/useStore';
import { PLACE_BET, PLACE_PARLAY } from '../../graphql/mutations';
import { GET_WALLET, GET_MY_BETS, GET_MY_PARLAYS } from '../../graphql/queries';

vi.mock('../../lib/auth', () => ({
  isAuthenticated: () => true,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('BetSlip', () => {
  beforeEach(() => {
    useStore.setState({
      betSlip: [],
      betMode: 'singles',
      parlayStake: 10,
      showBetSlip: true,
    });
  });

  it('should show empty state when no selections', () => {
    render(<BetSlip />);
    expect(screen.getByText('Your bet slip is empty')).toBeInTheDocument();
  });

  it('should display selections in the bet slip', () => {
    useStore.setState({
      betSlip: [
        {
          selectionId: '1',
          selectionName: 'Team A',
          odds: 2.0,
          eventId: 'event-1',
          eventName: 'Team A vs Team B',
          marketName: 'Match Winner',
          stake: 10,
        },
      ],
    });

    render(<BetSlip />);
    expect(screen.getByText('Team A')).toBeInTheDocument();
    expect(screen.getByText('Team A vs Team B')).toBeInTheDocument();
    expect(screen.getByText('2.00')).toBeInTheDocument();
  });

  it('should show mode toggle when 2+ selections', () => {
    useStore.setState({
      betSlip: [
        {
          selectionId: '1',
          selectionName: 'Team A',
          odds: 2.0,
          eventId: 'event-1',
          eventName: 'Event 1',
          marketName: 'Market 1',
          stake: 10,
        },
        {
          selectionId: '2',
          selectionName: 'Team B',
          odds: 1.5,
          eventId: 'event-2',
          eventName: 'Event 2',
          marketName: 'Market 2',
          stake: 10,
        },
      ],
    });

    render(<BetSlip />);
    expect(screen.getByText('Singles')).toBeInTheDocument();
    expect(screen.getByText('Parlay')).toBeInTheDocument();
  });

  it('should switch between singles and parlay mode', () => {
    useStore.setState({
      betSlip: [
        {
          selectionId: '1',
          selectionName: 'Team A',
          odds: 2.0,
          eventId: 'event-1',
          eventName: 'Event 1',
          marketName: 'Market 1',
          stake: 10,
        },
        {
          selectionId: '2',
          selectionName: 'Team B',
          odds: 1.5,
          eventId: 'event-2',
          eventName: 'Event 2',
          marketName: 'Market 2',
          stake: 10,
        },
      ],
    });

    render(<BetSlip />);

    const parlayButton = screen.getByText('Parlay');
    fireEvent.click(parlayButton);

    expect(screen.getByText('Combined Odds:')).toBeInTheDocument();
    expect(screen.getByText('3.00')).toBeInTheDocument();
  });

  it('should show warning for same-event selections in parlay mode', () => {
    useStore.setState({
      betSlip: [
        {
          selectionId: '1',
          selectionName: 'Team A',
          odds: 2.0,
          eventId: 'event-1',
          eventName: 'Event 1',
          marketName: 'Market 1',
          stake: 10,
        },
        {
          selectionId: '2',
          selectionName: 'Team B',
          odds: 1.5,
          eventId: 'event-1',
          eventName: 'Event 1',
          marketName: 'Market 2',
          stake: 10,
        },
      ],
      betMode: 'parlay',
    });

    render(<BetSlip />);
    expect(
      screen.getByText('Cannot combine selections from the same event in a parlay')
    ).toBeInTheDocument();
  });

  it('should calculate total stake correctly in singles mode', () => {
    useStore.setState({
      betSlip: [
        {
          selectionId: '1',
          selectionName: 'Team A',
          odds: 2.0,
          eventId: 'event-1',
          eventName: 'Event 1',
          marketName: 'Market 1',
          stake: 15,
        },
        {
          selectionId: '2',
          selectionName: 'Team B',
          odds: 1.5,
          eventId: 'event-2',
          eventName: 'Event 2',
          marketName: 'Market 2',
          stake: 25,
        },
      ],
    });

    render(<BetSlip />);
    expect(screen.getByText('$40.00')).toBeInTheDocument();
  });

  it('should remove selection when X button is clicked', () => {
    useStore.setState({
      betSlip: [
        {
          selectionId: '1',
          selectionName: 'Team A',
          odds: 2.0,
          eventId: 'event-1',
          eventName: 'Event 1',
          marketName: 'Market 1',
          stake: 10,
        },
      ],
    });

    render(<BetSlip />);
    const removeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(removeButton);

    expect(useStore.getState().betSlip).toHaveLength(0);
  });

  it('should clear all selections when Clear All is clicked', () => {
    useStore.setState({
      betSlip: [
        {
          selectionId: '1',
          selectionName: 'Team A',
          odds: 2.0,
          eventId: 'event-1',
          eventName: 'Event 1',
          marketName: 'Market 1',
          stake: 10,
        },
        {
          selectionId: '2',
          selectionName: 'Team B',
          odds: 1.5,
          eventId: 'event-2',
          eventName: 'Event 2',
          marketName: 'Market 2',
          stake: 10,
        },
      ],
    });

    render(<BetSlip />);
    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);

    expect(useStore.getState().betSlip).toHaveLength(0);
  });

  it('should disable Place Parlay button when same-event selections', () => {
    useStore.setState({
      betSlip: [
        {
          selectionId: '1',
          selectionName: 'Team A',
          odds: 2.0,
          eventId: 'event-1',
          eventName: 'Event 1',
          marketName: 'Market 1',
          stake: 10,
        },
        {
          selectionId: '2',
          selectionName: 'Team B',
          odds: 1.5,
          eventId: 'event-1',
          eventName: 'Event 1',
          marketName: 'Market 2',
          stake: 10,
        },
      ],
      betMode: 'parlay',
    });

    render(<BetSlip />);
    const placeButton = screen.getByText('Place Parlay');
    expect(placeButton).toBeDisabled();
  });
});
