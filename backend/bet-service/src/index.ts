import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  query,
  authMiddleware,
  AuthenticatedRequest,
  Bet,
  BetWithDetails,
  PlaceBetRequest,
  ApiResponse,
  publishEvent,
  connectRabbitMQ,
  BetStatus,
  Sport,
  EventStatus,
  MarketStatus,
} from 'shared';

// Database row type for bet queries with joins
interface BetQueryRow {
  id: string;
  user_id: string;
  selection_id: string;
  stake: number;
  odds_at_placement: number;
  status: BetStatus;
  potential_payout: number;
  created_at: Date;
  selection_name: string;
  current_odds: number;
  market_id: string;
  market_name: string;
  market_type: string;
  event_id: string;
  event_name: string;
  sport: Sport;
  start_time: Date;
  event_status: EventStatus;
  home_team?: string;
  away_team?: string;
}

const app = express();
const PORT = process.env.PORT || 3003;

// Service URLs
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:3002';
const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || 'http://localhost:3005';
const ODDS_SERVICE_URL = process.env.ODDS_SERVICE_URL || 'http://localhost:3004';

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'bet-service' });
});

// Place a bet (protected)
app.post('/bets', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { selection_id, stake } = req.body as PlaceBetRequest;
    const userId = req.user!.userId;

    if (!selection_id || !stake) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'selection_id and stake are required',
      };
      res.status(400).json(response);
      return;
    }

    if (stake <= 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Stake must be greater than 0',
      };
      res.status(400).json(response);
      return;
    }

    // Check wallet balance
    const walletResponse = await axios.get(`${WALLET_SERVICE_URL}/internal/wallet/${userId}`);
    if (!walletResponse.data.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Could not verify wallet balance',
      };
      res.status(400).json(response);
      return;
    }

    const wallet = walletResponse.data.data;
    if (parseFloat(wallet.balance) < stake) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Insufficient balance',
      };
      res.status(400).json(response);
      return;
    }

    // Verify selection exists and market is open
    const selectionResponse = await axios.get(`${EVENT_SERVICE_URL}/internal/selections/${selection_id}`);
    if (!selectionResponse.data.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Selection not found',
      };
      res.status(404).json(response);
      return;
    }

    const selection = selectionResponse.data.data;

    if (selection.market_status !== 'open') {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Market is not open for betting',
      };
      res.status(400).json(response);
      return;
    }

    // Get current odds (might have changed)
    const oddsResponse = await axios.get(`${ODDS_SERVICE_URL}/odds/${selection_id}`);
    const currentOdds = oddsResponse.data.success
      ? oddsResponse.data.data.odds
      : selection.odds;

    // Calculate potential payout
    const potentialPayout = stake * currentOdds;
    const betId = uuidv4();

    // Start transaction
    await query('BEGIN');

    try {
      // Deduct stake from wallet
      const deductResponse = await axios.post(`${WALLET_SERVICE_URL}/internal/deduct-stake`, {
        userId,
        amount: stake,
        betId,
      });

      if (!deductResponse.data.success) {
        await query('ROLLBACK');
        const response: ApiResponse<null> = {
          success: false,
          error: deductResponse.data.error || 'Could not deduct stake',
        };
        res.status(400).json(response);
        return;
      }

      // Create bet record
      await query(
        `INSERT INTO bets (id, user_id, selection_id, stake, odds_at_placement, status, potential_payout, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW())`,
        [betId, userId, selection_id, stake, currentOdds, potentialPayout]
      );

      await query('COMMIT');

      // Publish bet placed event
      try {
        await publishEvent('bets.placed', {
          type: 'BET_PLACED',
          payload: {
            bet_id: betId,
            user_id: userId,
            selection_id,
            stake,
            odds: currentOdds,
            timestamp: new Date(),
          },
        });
      } catch (mqError) {
        console.error('Failed to publish bet placed event:', mqError);
      }

      // Fetch created bet
      const betResult = await query(
        `SELECT id, user_id, selection_id, stake, odds_at_placement, status, potential_payout, created_at
         FROM bets WHERE id = $1`,
        [betId]
      );

      const bet: Bet = betResult.rows[0];

      const response: ApiResponse<Bet> = {
        success: true,
        data: bet,
      };

      res.status(201).json(response);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Place bet error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

// Get user's bets (protected)
app.get('/bets', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { status, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT b.id, b.user_id, b.selection_id, b.stake, b.odds_at_placement, b.status, b.potential_payout, b.created_at,
             s.name as selection_name, s.odds as current_odds,
             m.id as market_id, m.name as market_name, m.type as market_type,
             e.id as event_id, e.name as event_name, e.sport, e.start_time, e.status as event_status
      FROM bets b
      JOIN selections s ON b.selection_id = s.id
      JOIN markets m ON s.market_id = m.id
      JOIN events e ON m.event_id = e.id
      WHERE b.user_id = $1
    `;
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (status) {
      queryText += ` AND b.status = $${paramIndex++}`;
      params.push(status);
    }

    queryText += ` ORDER BY b.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await query(queryText, params);

    const bets: BetWithDetails[] = (result.rows as BetQueryRow[]).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      selection_id: row.selection_id,
      stake: row.stake,
      odds_at_placement: row.odds_at_placement,
      status: row.status,
      potential_payout: row.potential_payout,
      created_at: row.created_at,
      selection: {
        id: row.selection_id,
        market_id: row.market_id,
        name: row.selection_name,
        odds: row.current_odds,
      },
      market: {
        id: row.market_id,
        event_id: row.event_id,
        name: row.market_name,
        type: row.market_type,
        status: 'open' as MarketStatus,
      },
      event: {
        id: row.event_id,
        sport: row.sport,
        name: row.event_name,
        home_team: row.home_team || '',
        away_team: row.away_team || '',
        start_time: row.start_time,
        status: row.event_status,
        created_at: row.created_at,
      },
    }));

    const response: ApiResponse<BetWithDetails[]> = {
      success: true,
      data: bets,
    };

    res.json(response);
  } catch (error) {
    console.error('Get bets error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

// Get single bet (protected)
app.get('/bets/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const result = await query(
      `SELECT b.id, b.user_id, b.selection_id, b.stake, b.odds_at_placement, b.status, b.potential_payout, b.created_at,
              s.name as selection_name, s.odds as current_odds,
              m.id as market_id, m.name as market_name, m.type as market_type,
              e.id as event_id, e.name as event_name, e.sport, e.start_time, e.status as event_status,
              e.home_team, e.away_team
       FROM bets b
       JOIN selections s ON b.selection_id = s.id
       JOIN markets m ON s.market_id = m.id
       JOIN events e ON m.event_id = e.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Bet not found',
      };
      res.status(404).json(response);
      return;
    }

    const row = result.rows[0];
    const bet: BetWithDetails = {
      id: row.id,
      user_id: row.user_id,
      selection_id: row.selection_id,
      stake: row.stake,
      odds_at_placement: row.odds_at_placement,
      status: row.status,
      potential_payout: row.potential_payout,
      created_at: row.created_at,
      selection: {
        id: row.selection_id,
        market_id: row.market_id,
        name: row.selection_name,
        odds: row.current_odds,
      },
      market: {
        id: row.market_id,
        event_id: row.event_id,
        name: row.market_name,
        type: row.market_type,
        status: 'open',
      },
      event: {
        id: row.event_id,
        sport: row.sport,
        name: row.event_name,
        home_team: row.home_team,
        away_team: row.away_team,
        start_time: row.start_time,
        status: row.event_status,
        created_at: row.created_at,
      },
    };

    const response: ApiResponse<BetWithDetails> = {
      success: true,
      data: bet,
    };

    res.json(response);
  } catch (error) {
    console.error('Get bet error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

// Internal: Settle bets for a selection
app.post('/internal/settle', async (req, res) => {
  try {
    const { selection_id, winning } = req.body;

    if (!selection_id || winning === undefined) {
      res.status(400).json({ success: false, error: 'selection_id and winning are required' });
      return;
    }

    const newStatus = winning ? 'won' : 'lost';

    // Get all pending bets for this selection
    const betsResult = await query(
      'SELECT id, user_id, potential_payout FROM bets WHERE selection_id = $1 AND status = $2',
      [selection_id, 'pending']
    );

    const settledBets: string[] = [];

    for (const bet of betsResult.rows) {
      // Update bet status
      await query(
        'UPDATE bets SET status = $1 WHERE id = $2',
        [newStatus, bet.id]
      );

      // If winning, credit the user's wallet
      if (winning) {
        try {
          await axios.post(`${WALLET_SERVICE_URL}/internal/credit-winnings`, {
            userId: bet.user_id,
            amount: parseFloat(bet.potential_payout),
            betId: bet.id,
          });
        } catch (walletError) {
          console.error(`Failed to credit winnings for bet ${bet.id}:`, walletError);
        }
      }

      settledBets.push(bet.id);
    }

    res.json({
      success: true,
      data: {
        selection_id,
        winning,
        settled_count: settledBets.length,
        settled_bets: settledBets,
      },
    });
  } catch (error) {
    console.error('Settle bets error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Initialize RabbitMQ connection
async function initializeMessageQueue() {
  try {
    await connectRabbitMQ();
    console.log('Bet service connected to RabbitMQ');
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
  }
}

app.listen(PORT, () => {
  console.log(`Bet service running on port ${PORT}`);
  initializeMessageQueue();
});
