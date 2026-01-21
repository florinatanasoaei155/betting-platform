import { Link } from 'react-router-dom';

interface EventCardProps {
  id: string;
  name: string;
  sport: string;
  homeTeam?: string;
  awayTeam?: string;
  startTime: string;
  status: string;
}

export function EventCard({ id, name, sport, homeTeam, awayTeam, startTime, status }: EventCardProps) {
  const date = new Date(startTime);
  const isLive = status === 'live';

  const sportIcons: Record<string, string> = {
    football: 'â\9a\bd',
    basketball: 'ð\9f\8f\80',
    tennis: 'ð\9f\8e¾',
    horse_racing: 'ð\9f\8f\87',
  };

  return (
    <Link to={`/events/${id}`} className="card hover:bg-gray-800/50 transition-colors block">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{sportIcons[sport] || 'ð\9f\8f\86'}</span>
          <span className="text-sm text-gray-400 capitalize">{sport.replace('_', ' ')}</span>
        </div>
        {isLive ? (
          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
            LIVE
          </span>
        ) : (
          <span className="text-xs text-gray-500">
            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <h3 className="font-semibold text-lg mb-2">{name}</h3>

      {homeTeam && awayTeam && (
        <div className="flex justify-between items-center text-sm text-gray-400">
          <span>{homeTeam}</span>
          <span className="text-betting-accent">vs</span>
          <span>{awayTeam}</span>
        </div>
      )}

      <div className="mt-4 text-right">
        <span className="text-betting-accent text-sm hover:underline">
          View Markets â\86\92
        </span>
      </div>
    </Link>
  );
}
