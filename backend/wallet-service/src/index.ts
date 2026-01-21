import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import {
  query,
  authMiddleware,
  AuthenticatedRequest,
  Wallet,
  Transaction,
  DepositRequest,
  WithdrawRequest,
  ApiResponse,
  consumeQueue,
  QUEUES,
  connectRabbitMQ,
} from 'shared';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'wallet-service' });
});

app.get('/balance', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await query(
      'SELECT id, user_id, balance, currency, created_at FROM wallets WHERE user_id = $1',
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Wallet not found',
      };
      res.status(404).json(response);
      return;
    }

    const wallet: Wallet = result.rows[0];
    const response: ApiResponse<Wallet> = {
      success: true,
      data: wallet,
    };

    res.json(response);
  } catch (error) {
    console.error('Get balance error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.post('/deposit', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { amount } = req.body as DepositRequest;

    if (!amount || amount <= 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Amount must be greater than 0',
      };
      res.status(400).json(response);
      return;
    }

    const walletResult = await query(
      'SELECT id, balance FROM wallets WHERE user_id = $1',
      [req.user!.userId]
    );

    if (walletResult.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Wallet not found',
      };
      res.status(404).json(response);
      return;
    }

    const wallet = walletResult.rows[0];
    const newBalance = parseFloat(wallet.balance) + amount;

    await query('BEGIN');

    await query(
      'UPDATE wallets SET balance = $1 WHERE id = $2',
      [newBalance, wallet.id]
    );

    await query(
      `INSERT INTO transactions (id, wallet_id, type, amount, reference, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), wallet.id, 'deposit', amount, `Deposit of $${amount}`]
    );

    await query('COMMIT');

    const updatedResult = await query(
      'SELECT id, user_id, balance, currency, created_at FROM wallets WHERE id = $1',
      [wallet.id]
    );

    const response: ApiResponse<Wallet> = {
      success: true,
      data: updatedResult.rows[0],
    };

    res.json(response);
  } catch (error) {
    await query('ROLLBACK');
    console.error('Deposit error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.post('/withdraw', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { amount } = req.body as WithdrawRequest;

    if (!amount || amount <= 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Amount must be greater than 0',
      };
      res.status(400).json(response);
      return;
    }

    const walletResult = await query(
      'SELECT id, balance FROM wallets WHERE user_id = $1',
      [req.user!.userId]
    );

    if (walletResult.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Wallet not found',
      };
      res.status(404).json(response);
      return;
    }

    const wallet = walletResult.rows[0];
    const currentBalance = parseFloat(wallet.balance);

    if (currentBalance < amount) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Insufficient balance',
      };
      res.status(400).json(response);
      return;
    }

    const newBalance = currentBalance - amount;

    await query('BEGIN');

    await query(
      'UPDATE wallets SET balance = $1 WHERE id = $2',
      [newBalance, wallet.id]
    );

    await query(
      `INSERT INTO transactions (id, wallet_id, type, amount, reference, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), wallet.id, 'withdraw', -amount, `Withdrawal of $${amount}`]
    );

    await query('COMMIT');

    const updatedResult = await query(
      'SELECT id, user_id, balance, currency, created_at FROM wallets WHERE id = $1',
      [wallet.id]
    );

    const response: ApiResponse<Wallet> = {
      success: true,
      data: updatedResult.rows[0],
    };

    res.json(response);
  } catch (error) {
    await query('ROLLBACK');
    console.error('Withdraw error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.get('/transactions', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const walletResult = await query(
      'SELECT id FROM wallets WHERE user_id = $1',
      [req.user!.userId]
    );

    if (walletResult.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Wallet not found',
      };
      res.status(404).json(response);
      return;
    }

    const walletId = walletResult.rows[0].id;

    const result = await query(
      `SELECT id, wallet_id, type, amount, reference, created_at
       FROM transactions
       WHERE wallet_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [walletId, limit, offset]
    );

    const transactions: Transaction[] = result.rows;

    const response: ApiResponse<Transaction[]> = {
      success: true,
      data: transactions,
    };

    res.json(response);
  } catch (error) {
    console.error('Get transactions error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.get('/internal/wallet/:userId', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, user_id, balance, currency, created_at FROM wallets WHERE user_id = $1',
      [req.params.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Wallet not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/internal/deduct-stake', async (req, res) => {
  try {
    const { userId, amount, betId } = req.body;

    if (!userId || !amount || !betId) {
      res.status(400).json({ success: false, error: 'userId, amount, and betId are required' });
      return;
    }

    const walletResult = await query(
      'SELECT id, balance FROM wallets WHERE user_id = $1',
      [userId]
    );

    if (walletResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Wallet not found' });
      return;
    }

    const wallet = walletResult.rows[0];
    const currentBalance = parseFloat(wallet.balance);

    if (currentBalance < amount) {
      res.status(400).json({ success: false, error: 'Insufficient balance' });
      return;
    }

    const newBalance = currentBalance - amount;

    await query('BEGIN');

    await query(
      'UPDATE wallets SET balance = $1 WHERE id = $2',
      [newBalance, wallet.id]
    );

    await query(
      `INSERT INTO transactions (id, wallet_id, type, amount, reference, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), wallet.id, 'bet_stake', -amount, `Bet stake for bet ${betId}`]
    );

    await query('COMMIT');

    res.json({ success: true, data: { newBalance } });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Deduct stake error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/internal/credit-winnings', async (req, res) => {
  try {
    const { userId, amount, betId } = req.body;

    if (!userId || !amount || !betId) {
      res.status(400).json({ success: false, error: 'userId, amount, and betId are required' });
      return;
    }

    const walletResult = await query(
      'SELECT id, balance FROM wallets WHERE user_id = $1',
      [userId]
    );

    if (walletResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Wallet not found' });
      return;
    }

    const wallet = walletResult.rows[0];
    const newBalance = parseFloat(wallet.balance) + amount;

    await query('BEGIN');

    await query(
      'UPDATE wallets SET balance = $1 WHERE id = $2',
      [newBalance, wallet.id]
    );

    await query(
      `INSERT INTO transactions (id, wallet_id, type, amount, reference, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), wallet.id, 'bet_win', amount, `Winnings for bet ${betId}`]
    );

    await query('COMMIT');

    res.json({ success: true, data: { newBalance } });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Credit winnings error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

async function initializeMessageConsumer() {
  try {
    await connectRabbitMQ();
    console.log('Wallet service connected to RabbitMQ');
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
  }
}

app.listen(PORT, () => {
  console.log(`Wallet service running on port ${PORT}`);
  initializeMessageConsumer();
});
