import { useQuery } from '@apollo/client';
import { useParams, Link } from 'react-router-dom';
import { GET_EVENT } from '../graphql/queries';
import { useStore } from '../store/useStore';

interface Selection {
  id: string;
  marketId: string;
  name: string;
  odds: number;
}

interface Market {
  id: string;
  eventId: string;
  name: string;
  type: string;
  status: string;
  selections: Selection[];
}

interface Event {
  id: string;
  name: string;
  sport: string;
  homeTeam?: string;
  awayTeam?: string;
  startTime: string;
  status: string;
  markets: Market[];
}

export function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { betSlip, addToBetSlip } = useStore();

  const { data, loading, error } = useQuery(GET_EVENT, {
    variables: { id },
    skip: !id,
  });

  const isSelected = (selectionId: string) => {
    return betSlip.some((b) => b.selectionId === selectionId);
  };

  const handleSelectOdds = (selection: Selection, market: Market, event: Event) => {
    addToBetSlip({
      selectionId: selection.id,
      selectionName: selection.name,
      odds: selection.odds,
      eventId: event.id,
      eventName: event.name,
      marketName: market.name,
    });
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading event...</div>;
  }

  if (error || !data?.event) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Event not found</p>
        <Link to="/events" className="text-betting-accent hover:underline">
          Back to events
        </Link>
      </div>
    );
  }

  const event: Event = data.event;
  const date = new Date(event.startTime);
  const isLive = event.status === 'live';

  const sportIcons: Record<string, string> = {
    football: '⚽',
    basketball: '🏀',
    tennis: '🎾',
    horse_racing: '🏇',
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link to="/events" className="text-gray-400 hover:text-betting-accent">
          Events
        </Link>
        <span className="text-gray-600 mx-2">/</span>
        <span className="text-gray-300">{event.name}</span>
      </div>

      {/* Event Header */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{sportIcons[event.sport] || '🏆'}</span>
            <span className="text-gray-400 capitalize">{event.sport.replace('_', ' ')}</span>
          </div>
          {isLive ? (
            <span className="bg-red-500 text-white px-3 py-1 rounded-full animate-pulse">
              LIVE
            </span>
          ) : (
            <span className="text-gray-400">
              {date.toLocaleDateString()} at{' '}
              {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <h1 className="text-3xl font-bold mb-4">{event.name}</h1>

        {event.homeTeam && event.awayTeam && (
          <div className="flex justify-center items-center space-x-8 text-xl">
            <span className="font-semibold">{event.homeTeam}</span>
            <span className="text-betting-accent">vs</span>
            <span className="font-semibold">{event.awayTeam}</span>
          </div>
        )}
      </div>

      {/* Markets */}
      {event.markets.length > 0 ? (
        <div className="space-y-6">
          {event.markets.map((market) => (
            <div key={market.id} className="card">
              <h3 className="text-xl font-semibold mb-4">{market.name}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {market.selections.map((selection) => (
                  <button
                    key={selection.id}
                    onClick={() => handleSelectOdds(selection, market, event)}
                    disabled={market.status !== 'open'}
                    className={`odds-button ${isSelected(selection.id) ? 'selected' : ''} ${
                      market.status !== 'open' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">{selection.name}</div>
                    <div className="text-lg font-bold">{selection.odds.toFixed(2)}</div>
                  </button>
                ))}
              </div>
              {market.status !== 'open' && (
                <p className="text-gray-500 text-sm mt-2">
                  Market is {market.status}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-8 text-gray-400">
          No markets available for this event
        </div>
      )}
    </div>
  );
}
