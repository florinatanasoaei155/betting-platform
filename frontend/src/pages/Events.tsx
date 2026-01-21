import { useQuery } from '@apollo/client';
import { useSearchParams } from 'react-router-dom';
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

export function Events() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sport = searchParams.get('sport');
  const status = searchParams.get('status');

  const { data, loading, error } = useQuery(GET_EVENTS, {
    variables: {
      sport: sport || undefined,
      status: status || undefined,
      limit: 50,
    },
  });

  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Events</h1>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Sport</label>
            <select
              value={sport || ''}
              onChange={(e) => updateFilter('sport', e.target.value || null)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
            >
              <option value="">All Sports</option>
              <option value="football">Football</option>
              <option value="basketball">Basketball</option>
              <option value="tennis">Tennis</option>
              <option value="horse_racing">Horse Racing</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Status</label>
            <select
              value={status || ''}
              onChange={(e) => updateFilter('status', e.target.value || null)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
            >
              <option value="">All Status</option>
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="finished">Finished</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading events...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">Error loading events</div>
      ) : data?.events?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.events.map((event: Event) => (
            <EventCard key={event.id} {...event} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400 card">
          No events found with current filters
        </div>
      )}
    </div>
  );
}
