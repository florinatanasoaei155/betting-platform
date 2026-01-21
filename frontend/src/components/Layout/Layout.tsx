import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { clearTokens, isAuthenticated } from '../../lib/auth';
import { useQuery } from '@apollo/client';
import { GET_WALLET } from '../../graphql/queries';
import { BetSlip } from '../BetSlip/BetSlip';
import { apolloClient } from '../../lib/apollo-client';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, setUser, betSlip, showBetSlip, toggleBetSlip } = useStore();
  const navigate = useNavigate();
  const authenticated = isAuthenticated();

  const { data: walletData } = useQuery(GET_WALLET, {
    skip: !authenticated,
    pollInterval: 10000,
  });

  const handleLogout = () => {
    clearTokens();
    setUser(null);
    apolloClient.resetStore();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-betting-dark border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-2xl font-bold text-betting-accent">
                BetPlatform
              </Link>
              <nav className="hidden md:flex space-x-6">
                <Link to="/events" className="hover:text-betting-accent transition-colors">
                  Events
                </Link>
                <Link to="/events?sport=football" className="hover:text-betting-accent transition-colors">
                  Football
                </Link>
                <Link to="/events?sport=basketball" className="hover:text-betting-accent transition-colors">
                  Basketball
                </Link>
                <Link to="/events?sport=tennis" className="hover:text-betting-accent transition-colors">
                  Tennis
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              {authenticated && walletData?.wallet && (
                <Link
                  to="/wallet"
                  className="bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <span className="text-betting-accent font-semibold">
                    ${walletData.wallet.balance.toFixed(2)}
                  </span>
                </Link>
              )}
              {authenticated ? (
                <>
                  <Link to="/my-bets" className="hover:text-betting-accent transition-colors">
                    My Bets
                  </Link>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-300">{user?.username}</span>
                  <button onClick={handleLogout} className="btn-secondary text-sm">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="hover:text-betting-accent transition-colors">
                    Login
                  </Link>
                  <Link to="/register" className="btn-primary text-sm">
                    Register
                  </Link>
                </>
              )}
              {/* Bet slip toggle */}
              <button
                onClick={toggleBetSlip}
                className="relative bg-betting-accent text-betting-dark px-4 py-2 rounded-lg font-semibold"
              >
                Bet Slip
                {betSlip.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {betSlip.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        <main className="flex-1 container mx-auto px-4 py-6">{children}</main>

        {/* Bet slip sidebar */}
        {showBetSlip && (
          <aside className="w-80 bg-betting-dark border-l border-gray-800 p-4">
            <BetSlip />
          </aside>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-betting-dark border-t border-gray-800 py-4">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>BetPlatform - Demo Sports Betting Platform</p>
          <p className="mt-1">This is a mock platform for demonstration purposes only.</p>
        </div>
      </footer>
    </div>
  );
}
