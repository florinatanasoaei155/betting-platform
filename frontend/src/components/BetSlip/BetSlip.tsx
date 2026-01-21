import { useMutation } from '@apollo/client';
import { useStore } from '../../store/useStore';
import { PLACE_BET, PLACE_PARLAY } from '../../graphql/mutations';
import { GET_WALLET, GET_MY_BETS, GET_MY_PARLAYS } from '../../graphql/queries';
import { isAuthenticated } from '../../lib/auth';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export function BetSlip() {
  const {
    betSlip,
    removeFromBetSlip,
    updateStake,
    clearBetSlip,
    betMode,
    setBetMode,
    parlayStake,
    setParlayStake,
    getCombinedOdds,
    getParlayPayout,
    canCreateParlay,
    hasSameEventSelections,
  } = useStore();
  const navigate = useNavigate();
  const [placeBet, { loading: placingBet }] = useMutation(PLACE_BET, {
    refetchQueries: [GET_WALLET, GET_MY_BETS],
  });
  const [placeParlay, { loading: placingParlay }] = useMutation(PLACE_PARLAY, {
    refetchQueries: [GET_WALLET, GET_MY_PARLAYS],
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loading = placingBet || placingParlay;

  const totalStake = betSlip.reduce((sum, item) => sum + item.stake, 0);
  const totalPotentialPayout = betSlip.reduce(
    (sum, item) => sum + item.stake * item.odds,
    0
  );

  const combinedOdds = getCombinedOdds();
  const parlayPayout = getParlayPayout();

  const handlePlaceBets = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      if (betMode === 'parlay') {
        if (!canCreateParlay()) {
          setError('Cannot create parlay: need at least 2 selections from different events');
          return;
        }

        await placeParlay({
          variables: {
            input: {
              selections: betSlip.map((bet) => ({ selectionId: bet.selectionId })),
              stake: parlayStake,
            },
          },
        });
        setSuccess('Parlay placed successfully!');
      } else {
        for (const bet of betSlip) {
          await placeBet({
            variables: {
              input: {
                selectionId: bet.selectionId,
                stake: bet.stake,
              },
            },
          });
        }
        setSuccess('Bets placed successfully!');
      }
      clearBetSlip();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bets');
    }
  };

  if (betSlip.length === 0) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-semibold mb-2">Bet Slip</h3>
        <p className="text-gray-400">Your bet slip is empty</p>
        <p className="text-gray-500 text-sm mt-2">
          Click on odds to add selections
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Bet Slip</h3>

      {betSlip.length >= 2 && (
        <div className="flex mb-4 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setBetMode('singles')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              betMode === 'singles'
                ? 'bg-betting-accent text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Singles
          </button>
          <button
            onClick={() => setBetMode('parlay')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              betMode === 'parlay'
                ? 'bg-betting-accent text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Parlay
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-2 rounded-lg mb-4 text-sm">
          {success}
        </div>
      )}

      {betMode === 'parlay' && hasSameEventSelections() && (
        <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-500 px-4 py-2 rounded-lg mb-4 text-sm">
          Cannot combine selections from the same event in a parlay
        </div>
      )}

      <div className="space-y-3">
        {betSlip.map((item) => (
          <div key={item.selectionId} className="bg-gray-800 rounded-lg p-3">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <p className="font-medium text-sm">{item.selectionName}</p>
                <p className="text-gray-400 text-xs">{item.eventName}</p>
                <p className="text-gray-500 text-xs">{item.marketName}</p>
              </div>
              <button
                onClick={() => removeFromBetSlip(item.selectionId)}
                className="text-gray-400 hover:text-red-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-betting-accent font-semibold">{item.odds.toFixed(2)}</span>
              {betMode === 'singles' && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="1"
                    value={item.stake}
                    onChange={(e) => updateStake(item.selectionId, parseFloat(e.target.value) || 0)}
                    className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-right text-sm"
                  />
                </div>
              )}
            </div>
            {betMode === 'singles' && (
              <div className="text-right text-xs text-gray-400 mt-1">
                Potential win: ${(item.stake * item.odds).toFixed(2)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        {betMode === 'singles' ? (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Total Stake:</span>
              <span className="font-semibold">${totalStake.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mb-4">
              <span className="text-gray-400">Potential Payout:</span>
              <span className="font-semibold text-betting-accent">${totalPotentialPayout.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Combined Odds:</span>
              <span className="font-semibold text-betting-accent">{combinedOdds.toFixed(2)}</span>
            </div>
            <div className="mb-3">
              <label className="block text-sm text-gray-400 mb-1">Parlay Stake</label>
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">$</span>
                <input
                  type="number"
                  min="1"
                  value={parlayStake}
                  onChange={(e) => setParlayStake(parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-right"
                />
              </div>
            </div>
            <div className="flex justify-between text-sm mb-4">
              <span className="text-gray-400">Potential Payout:</span>
              <span className="font-semibold text-betting-accent">${parlayPayout.toFixed(2)}</span>
            </div>
          </>
        )}
        <button
          onClick={handlePlaceBets}
          disabled={loading || betSlip.length === 0 || (betMode === 'parlay' && !canCreateParlay())}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? betMode === 'parlay'
              ? 'Placing Parlay...'
              : 'Placing Bets...'
            : betMode === 'parlay'
            ? 'Place Parlay'
            : `Place Bet${betSlip.length > 1 ? 's' : ''}`}
        </button>
        <button onClick={clearBetSlip} className="w-full btn-secondary mt-2 text-sm">
          Clear All
        </button>
      </div>
    </div>
  );
}
