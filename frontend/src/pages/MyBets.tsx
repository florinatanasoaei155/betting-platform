import { useQuery } from '@apollo/client';
import { useState } from 'react';
import { GET_MY_BETS } from '../graphql/queries';

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

export function MyBets() {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, loading, error } = useQuery(GET_MY_BETS, {
    variables: {
      status: statusFilter || undefined,
      limit: 50,
    },
    pollInterval: 30000,
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-500',
    won: 'bg-green-500/20 text-green-500',
    lost: 'bg-red-500/20 text-red-500',
    void: 'bg-gray-500/20 text-gray-500',
    cashed_out: 'bg-blue-500/20 text-blue-500',
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading your bets...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-red-500">Error loading bets</div>;
  }

  const bets: Bet[] = data?.myBets || [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">My Bets</h1>

      {/* Filter */}
      <div className="card mb-6">
        <label className="block text-sm text-gray-400 mb-1">Filter by Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
        >
          <option value="">All Bets</option>
          <option value="pending">Pending</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="void">Void</option>
          <option value="cashed_out">Cashed Out</option>
        </select>
      </div>

      {/* Bets List */}
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
              : "You haven't placed any bets yet"}
          </p>
        </div>
      )}
    </div>
  );
}
