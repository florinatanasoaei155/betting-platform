import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { GET_EVENTS } from '../graphql/queries';
import { EventCard } from '../components/EventCard/EventCard';

interface Event {
  id: string;
  name: string;
  sport: string;
  homeTeam?: string;
  awayTeam?: string;
  startTime: string;
  status: string;
}

export function Home() {
  const { data: liveData, loading: liveLoading } = useQuery(GET_EVENTS, {
    variables: { status: 'live', limit: 6 },
  });

  const { data: upcomingData, loading: upcomingLoading } = useQuery(GET_EVENTS, {
    variables: { status: 'upcoming', limit: 6 },
  });

  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Welcome to <span className="text-betting-accent">BetPlatform</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Experience the thrill of sports betting with our mock platform.
          Browse events, place bets, and track your winnings.
        </p>
        <div className="mt-6 flex justify-center space-x-4">
          <Link to="/events" className="btn-primary text-lg px-8 py-3">
            Browse Events
          </Link>
          <Link to="/register" className="btn-secondary text-lg px-8 py-3">
            Create Account
          </Link>
        </div>
      </div>

      {/* Live Events */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center">
            <span className="w-3 h-3 bg-red-500 rounded-full mr-3 animate-pulse"></span>
            Live Events
          </h2>
          <Link to="/events?status=live" className="text-betting-accent hover:underline">
            View all live events
          </Link>
        </div>
        {liveLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : liveData?.events?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveData.events.map((event: Event) => (
              <EventCard key={event.id} {...event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 card">
            No live events at the moment
          </div>
        )}
      </section>

      {/* Upcoming Events */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Upcoming Events</h2>
          <Link to="/events?status=upcoming" className="text-betting-accent hover:underline">
            View all upcoming events
          </Link>
        </div>
        {upcomingLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : upcomingData?.events?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingData.events.map((event: Event) => (
              <EventCard key={event.id} {...event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 card">
            No upcoming events
          </div>
        )}
      </section>

      {/* Sports Categories */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Browse by Sport</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/events?sport=football" className="card hover:bg-gray-800/50 transition-colors text-center py-8">
            <span className="text-4xl mb-2 block">⚽</span>
            <span className="font-semibold">Football</span>
          </Link>
          <Link to="/events?sport=basketball" className="card hover:bg-gray-800/50 transition-colors text-center py-8">
            <span className="text-4xl mb-2 block">🏀</span>
            <span className="font-semibold">Basketball</span>
          </Link>
          <Link to="/events?sport=tennis" className="card hover:bg-gray-800/50 transition-colors text-center py-8">
            <span className="text-4xl mb-2 block">🎾</span>
            <span className="font-semibold">Tennis</span>
          </Link>
          <Link to="/events?sport=horse_racing" className="card hover:bg-gray-800/50 transition-colors text-center py-8">
            <span className="text-4xl mb-2 block">🏇</span>
            <span className="font-semibold">Horse Racing</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
