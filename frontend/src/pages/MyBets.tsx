import { useQuery } from '@apollo/client';
import { useState } from 'react';
import { GET_MY_BETS, GET_MY_PARLAYS } from '../graphql/queries';

interface Bet {
  id: string;
  userId: string;
  selectionId: string;
  stake: number;
  oddsAtPlacement: number;
  status: string;
  potentialPayout: number;
  createdAt: string;
  selection: {
    id: string;
    name: string;
    odds: number;
  };
  market: {
    id: string;
    name: string;
    type: string;
  };
  event: {
    id: string;
    name: string;
    sport: string;
    startTime: string;
    status: string;
  };
}

interface ParlayLeg {
  id: string;
  parlayId: string;
  selectionId: string;
  oddsAtPlacement: number;
  status: string;
  legNumber: number;
  selection: {
    id: string;
    name: string;
    odds: number;
  };
  market: {
    id: string;
    name: string;
    type: string;
  };
  event: {
    id: string;
    name: string;
    sport: string;
    startTime: string;
    status: string;
  };
}

interface Parlay {
  id: string;
  userId: string;
  totalStake: number;
  combinedOdds: number;
  potentialPayout: number;
  status: string;
  settledAt?: string;
  createdAt: string;
  legs: ParlayLeg[];
}

type TabType = 'singles' | 'parlays';

export function MyBets() {
  const [activeTab, setActiveTab] = useState<TabType>('singles');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedParlays, setExpandedParlays] = useState<Set<string>>(new Set());

  const { data: betsData, loading: betsLoading, error: betsError } = useQuery(GET_MY_BETS, {
    variables: {
      status: statusFilter || undefined,
      limit: 50,
    },
    pollInterval: 30000,
    skip: activeTab !== 'singles',
  });

  const { data: parlaysData, loading: parlaysLoading, error: parlaysError } = useQuery(GET_MY_PARLAYS, {
    variables: {
      status: statusFilter || undefined,
      limit: 50,
    },
    pollInterval: 30000,
    skip: activeTab !== 'parlays',
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-500',
    won: 'bg-green-500/20 text-green-500',
    lost: 'bg-red-500/20 text-red-500',
    void: 'bg-gray-500/20 text-gray-500',
    cashed_out: 'bg-blue-500/20 text-blue-500',
    partially_void: 'bg-purple-500/20 text-purple-500',
  };

  const legStatusColors: Record<string, string> = {
    pending: 'text-yellow-500',
    won: 'text-green-500',
    lost: 'text-red-500',
    void: 'text-gray-500',
  };

  const toggleParlayExpanded = (parlayId: string) => {
    setExpandedParlays((prev) => {
      const next = new Set(prev);
      if (next.has(parlayId)) {
        next.delete(parlayId);
      } else {
        next.add(parlayId);
      }
      return next;
    });
  };

  const loading = activeTab === 'singles' ? betsLoading : parlaysLoading;
  const error = activeTab === 'singles' ? betsError : parlaysError;

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading your bets...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-red-500">Error loading bets</div>;
  }

  const bets: Bet[] = betsData?.myBets || [];
  const parlays: Parlay[] = parlaysData?.myParlays || [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">My Bets</h1>

      {/* Tabs */}
      <div className="flex mb-6 bg-gray-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => {
            setActiveTab('singles');
            setStatusFilter('');
          }}
          className={`py-2 px-6 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'singles'
              ? 'bg-betting-accent text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Single Bets
        </button>
        <button
          onClick={() => {
            setActiveTab('parlays');
            setStatusFilter('');
          }}
          className={`py-2 px-6 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'parlays'
              ? 'bg-betting-accent text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Parlays
        </button>
      </div>

      {/* Filter */}
      <div className="card mb-6">
        <label className="block text-sm text-gray-400 mb-1">Filter by Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
        >
          <option value="">All {activeTab === 'singles' ? 'Bets' : 'Parlays'}</option>
          <option value="pending">Pending</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="void">Void</option>
          {activeTab === 'singles' && <option value="cashed_out">Cashed Out</option>}
          {activeTab === 'parlays' && <option value="partially_void">Partially Void</option>}
        </select>
      </div>

      {/* Single Bets List */}
      {activeTab === 'singles' && (
        <>
          {bets.length > 0 ? (
            <div className="space-y-4">
              {bets.map((bet) => {
                const date = new Date(bet.createdAt);
                return (
                  <div key={bet.id} className="card">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold">{bet.event.name}</h3>
                        <p className="text-gray-400 text-sm">{bet.market.name}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${statusColors[bet.status] || ''}`}>
                        {bet.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Selection:</span>
                        <p className="font-semibold">{bet.selection.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Odds:</span>
                        <p className="font-semibold text-betting-accent">{bet.oddsAtPlacement.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Stake:</span>
                        <p className="font-semibold">${bet.stake.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">
                          {bet.status === 'won' ? 'Payout:' : 'Potential Payout:'}
                        </span>
                        <p className={`font-semibold ${bet.status === 'won' ? 'text-green-500' : ''}`}>
                          ${bet.potentialPayout.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
                      Placed: {date.toLocaleDateString()} {date.toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-xl mb-2">No bets found</p>
              <p className="text-sm">
                {statusFilter
                  ? `You don't have any ${statusFilter} bets`
                  : "You haven't placed any single bets yet"}
              </p>
            </div>
          )}
        </>
      )}

      {/* Parlays List */}
      {activeTab === 'parlays' && (
        <>
          {parlays.length > 0 ? (
            <div className="space-y-4">
              {parlays.map((parlay) => {
                const date = new Date(parlay.createdAt);
                const isExpanded = expandedParlays.has(parlay.id);
                return (
                  <div key={parlay.id} className="card">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold">{parlay.legs.length}-Leg Parlay</h3>
                        <p className="text-gray-400 text-sm">
                          {parlay.legs.map((leg) => leg.event.name).join(' + ')}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${statusColors[parlay.status] || ''}`}>
                        {parlay.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-400">Selections:</span>
                        <p className="font-semibold">{parlay.legs.length} legs</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Combined Odds:</span>
                        <p className="font-semibold text-betting-accent">{parlay.combinedOdds.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Stake:</span>
                        <p className="font-semibold">${parlay.totalStake.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">
                          {parlay.status === 'won' ? 'Payout:' : 'Potential Payout:'}
                        </span>
                        <p className={`font-semibold ${parlay.status === 'won' ? 'text-green-500' : ''}`}>
                          ${parlay.potentialPayout.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Expandable Legs */}
                    <button
                      onClick={() => toggleParlayExpanded(parlay.id)}
                      className="w-full flex items-center justify-center py-2 text-sm text-gray-400 hover:text-white border-t border-gray-700"
                    >
                      <span>{isExpanded ? 'Hide' : 'Show'} Legs</span>
                      <svg
                        className={`w-4 h-4 ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-2">
                        {parlay.legs.map((leg, index) => (
                          <div
                            key={leg.id}
                            className="bg-gray-800 rounded-lg p-3 flex justify-between items-center"
                          >
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-500 text-xs">Leg {index + 1}</span>
                                <span className={`text-xs ${legStatusColors[leg.status] || ''}`}>
                                  {leg.status.toUpperCase()}
                                </span>
                              </div>
                              <p className="font-medium text-sm">{leg.selection.name}</p>
                              <p className="text-gray-400 text-xs">{leg.event.name}</p>
                              <p className="text-gray-500 text-xs">{leg.market.name}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-betting-accent font-semibold">
                                {leg.oddsAtPlacement.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
                      Placed: {date.toLocaleDateString()} {date.toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-xl mb-2">No parlays found</p>
              <p className="text-sm">
                {statusFilter
                  ? `You don't have any ${statusFilter} parlays`
                  : "You haven't placed any parlays yet"}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
