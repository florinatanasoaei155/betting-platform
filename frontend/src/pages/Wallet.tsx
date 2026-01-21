import { useQuery, useMutation } from '@apollo/client';
import { useState } from 'react';
import { GET_WALLET, GET_TRANSACTIONS } from '../graphql/queries';
import { DEPOSIT, WITHDRAW } from '../graphql/mutations';

interface Transaction {
  id: string;
  walletId: string;
  type: string;
  amount: number;
  reference: string;
  createdAt: string;
}

export function Wallet() {
  const [amount, setAmount] = useState<number>(50);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: walletData, loading: walletLoading, refetch: refetchWallet } = useQuery(GET_WALLET);
  const { data: transactionsData, loading: transactionsLoading, refetch: refetchTransactions } = useQuery(GET_TRANSACTIONS, {
    variables: { limit: 20 },
  });

  const [deposit, { loading: depositLoading }] = useMutation(DEPOSIT, {
    onCompleted: () => {
      setSuccess('Deposit successful!');
      refetchWallet();
      refetchTransactions();
    },
    onError: (err) => setError(err.message),
  });

  const [withdraw, { loading: withdrawLoading }] = useMutation(WITHDRAW, {
    onCompleted: () => {
      setSuccess('Withdrawal successful!');
      refetchWallet();
      refetchTransactions();
    },
    onError: (err) => setError(err.message),
  });

  const handleDeposit = () => {
    setError(null);
    setSuccess(null);
    if (amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }
    deposit({ variables: { amount } });
  };

  const handleWithdraw = () => {
    setError(null);
    setSuccess(null);
    if (amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }
    withdraw({ variables: { amount } });
  };

  const typeColors: Record<string, string> = {
    deposit: 'text-green-500',
    withdraw: 'text-red-500',
    bet_stake: 'text-yellow-500',
    bet_win: 'text-green-500',
  };

  const typeLabels: Record<string, string> = {
    deposit: 'Deposit',
    withdraw: 'Withdrawal',
    bet_stake: 'Bet Stake',
    bet_win: 'Bet Win',
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Wallet</h1>

      {/* Balance Card */}
      <div className="card mb-6">
        <div className="text-center py-8">
          <p className="text-gray-400 mb-2">Available Balance</p>
          <p className="text-5xl font-bold text-betting-accent">
            {walletLoading ? (
              '...'
            ) : (
              `$${walletData?.wallet?.balance?.toFixed(2) || '0.00'}`
            )}
          </p>
          <p className="text-gray-500 mt-2">
            {walletData?.wallet?.currency || 'USD'}
          </p>
        </div>
      </div>

      {/* Deposit/Withdraw */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-4">Manage Funds</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="input pl-8"
              />
            </div>
          </div>
          <div className="flex gap-2 md:items-end">
            <button
              onClick={handleDeposit}
              disabled={depositLoading || withdrawLoading}
              className="btn-primary flex-1 md:flex-none"
            >
              {depositLoading ? 'Processing...' : 'Deposit'}
            </button>
            <button
              onClick={handleWithdraw}
              disabled={depositLoading || withdrawLoading}
              className="btn-secondary flex-1 md:flex-none"
            >
              {withdrawLoading ? 'Processing...' : 'Withdraw'}
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {[10, 25, 50, 100, 200].map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className={`flex-1 py-2 rounded-lg border transition-colors ${
                amount === preset
                  ? 'border-betting-accent text-betting-accent'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              ${preset}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Transaction History</h2>

        {transactionsLoading ? (
          <div className="text-center py-8 text-gray-400">Loading transactions...</div>
        ) : transactionsData?.transactions?.length > 0 ? (
          <div className="space-y-3">
            {transactionsData.transactions.map((tx: Transaction) => {
              const date = new Date(tx.createdAt);
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0"
                >
                  <div>
                    <p className="font-medium">{typeLabels[tx.type] || tx.type}</p>
                    {tx.reference && (
                      <p className="text-gray-500 text-sm">{tx.reference}</p>
                    )}
                    <p className="text-gray-500 text-xs">
                      {date.toLocaleDateString()} {date.toLocaleTimeString()}
                    </p>
                  </div>
                  <p className={`font-semibold ${typeColors[tx.type] || ''}`}>
                    {tx.amount > 0 ? '+' : ''}${tx.amount.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">No transactions yet</div>
        )}
      </div>
    </div>
  );
}
