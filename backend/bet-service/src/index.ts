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
  ParlayBet,
  ParlayBetWithLegs,
  ParlayLegWithDetails,
  PlaceParlayRequest,
  ParlayStatus,
  ParlayLegStatus,
} from 'shared';

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

interface ParlayLegQueryRow {
  id: string;
  parlay_id: string;
  selection_id: string;
  odds_at_placement: number;
  status: ParlayLegStatus;
  leg_number: number;
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

const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:3002';
const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || 'http://localhost:3005';
const ODDS_SERVICE_URL = process.env.ODDS_SERVICE_URL || 'http://localhost:3004';

app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'bet-service' });
});

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

    const oddsResponse = await axios.get(`${ODDS_SERVICE_URL}/odds/${selection_id}`);
    const currentOdds = oddsResponse.data.success
      ? oddsResponse.data.data.odds
      : selection.odds;

    const potentialPayout = stake * currentOdds;
    const betId = uuidv4();

    await query('BEGIN');

    try {
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

      await query(
        `INSERT INTO bets (id, user_id, selection_id, stake, odds_at_placement, status, potential_payout, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW())`,
        [betId, userId, selection_id, stake, currentOdds, potentialPayout]
      );

      await query('COMMIT');

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

app.post('/parlays', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { selections, stake } = req.body as PlaceParlayRequest;
    const userId = req.user!.userId;

    if (!selections || !Array.isArray(selections) || selections.length < 2) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'At least 2 selections are required for a parlay',
      };
      res.status(400).json(response);
      return;
    }

    if (!stake || stake <= 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Stake must be greater than 0',
      };
      res.status(400).json(response);
      return;
    }

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

    const selectionDetails: Array<{
      selection_id: string;
      event_id: string;
      odds: number;
      market_status: string;
    }> = [];

    for (const sel of selections) {
      const selectionResponse = await axios.get(
        `${EVENT_SERVICE_URL}/internal/selections/${sel.selection_id}`
      );
      if (!selectionResponse.data.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Selection ${sel.selection_id} not found`,
        };
        res.status(404).json(response);
        return;
      }

      const selection = selectionResponse.data.data;

      if (selection.market_status !== 'open') {
        const response: ApiResponse<null> = {
          success: false,
          error: `Market for selection ${selection.name} is not open for betting`,
        };
        res.status(400).json(response);
        return;
      }

      const oddsResponse = await axios.get(`${ODDS_SERVICE_URL}/odds/${sel.selection_id}`);
      const currentOdds = oddsResponse.data.success
        ? oddsResponse.data.data.odds
        : selection.odds;

      selectionDetails.push({
        selection_id: sel.selection_id,
        event_id: selection.event_id,
        odds: currentOdds,
        market_status: selection.market_status,
      });
    }

    const eventIds = selectionDetails.map((s) => s.event_id);
    const uniqueEventIds = new Set(eventIds);
    if (uniqueEventIds.size !== eventIds.length) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Cannot combine selections from the same event in a parlay',
      };
      res.status(400).json(response);
      return;
    }

    const combinedOdds = selectionDetails.reduce((acc, s) => acc * s.odds, 1);
    const potentialPayout = stake * combinedOdds;
    const parlayId = uuidv4();

    await query('BEGIN');

    try {
      const deductResponse = await axios.post(`${WALLET_SERVICE_URL}/internal/deduct-stake`, {
        userId,
        amount: stake,
        betId: parlayId,
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

      await query(
        `INSERT INTO parlay_bets (id, user_id, total_stake, combined_odds, potential_payout, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW())`,
        [parlayId, userId, stake, combinedOdds, potentialPayout]
      );

      for (let i = 0; i < selectionDetails.length; i++) {
        const sel = selectionDetails[i];
        await query(
          `INSERT INTO parlay_legs (id, parlay_id, selection_id, odds_at_placement, status, leg_number, created_at)
           VALUES ($1, $2, $3, $4, 'pending', $5, NOW())`,
          [uuidv4(), parlayId, sel.selection_id, sel.odds, i + 1]
        );
      }

      await query('COMMIT');

      try {
        await publishEvent('parlays.placed', {
          type: 'PARLAY_PLACED',
          payload: {
            parlay_id: parlayId,
            user_id: userId,
            selections: selectionDetails.map((s) => s.selection_id),
            stake,
            combined_odds: combinedOdds,
            timestamp: new Date(),
          },
        });
      } catch (mqError) {
        console.error('Failed to publish parlay placed event:', mqError);
      }

      const parlayResult = await query(
        `SELECT id, user_id, total_stake, combined_odds, potential_payout, status, settled_at, created_at
         FROM parlay_bets WHERE id = $1`,
        [parlayId]
      );

      const parlay: ParlayBet = parlayResult.rows[0];

      const response: ApiResponse<ParlayBet> = {
        success: true,
        data: parlay,
      };

      res.status(201).json(response);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Place parlay error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.get('/parlays', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { status, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT id, user_id, total_stake, combined_odds, potential_payout, status, settled_at, created_at
      FROM parlay_bets
      WHERE user_id = $1
    `;
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (status) {
      queryText += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const parlaysResult = await query(queryText, params);

    const parlaysWithLegs: ParlayBetWithLegs[] = [];

    for (const parlay of parlaysResult.rows) {
      const legsResult = await query(
        `SELECT pl.id, pl.parlay_id, pl.selection_id, pl.odds_at_placement, pl.status, pl.leg_number, pl.created_at,
                s.name as selection_name, s.odds as current_odds,
                m.id as market_id, m.name as market_name, m.type as market_type,
                e.id as event_id, e.name as event_name, e.sport, e.start_time, e.status as event_status,
                e.home_team, e.away_team
         FROM parlay_legs pl
         JOIN selections s ON pl.selection_id = s.id
         JOIN markets m ON s.market_id = m.id
         JOIN events e ON m.event_id = e.id
         WHERE pl.parlay_id = $1
         ORDER BY pl.leg_number`,
        [parlay.id]
      );

      const legs: ParlayLegWithDetails[] = (legsResult.rows as ParlayLegQueryRow[]).map((row) => ({
        id: row.id,
        parlay_id: row.parlay_id,
        selection_id: row.selection_id,
        odds_at_placement: row.odds_at_placement,
        status: row.status,
        leg_number: row.leg_number,
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

      parlaysWithLegs.push({
        ...parlay,
        legs,
      });
    }

    const response: ApiResponse<ParlayBetWithLegs[]> = {
      success: true,
      data: parlaysWithLegs,
    };

    res.json(response);
  } catch (error) {
    console.error('Get parlays error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.get('/parlays/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const parlayResult = await query(
      `SELECT id, user_id, total_stake, combined_odds, potential_payout, status, settled_at, created_at
       FROM parlay_bets
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (parlayResult.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Parlay not found',
      };
      res.status(404).json(response);
      return;
    }

    const parlay = parlayResult.rows[0];

    const legsResult = await query(
      `SELECT pl.id, pl.parlay_id, pl.selection_id, pl.odds_at_placement, pl.status, pl.leg_number, pl.created_at,
              s.name as selection_name, s.odds as current_odds,
              m.id as market_id, m.name as market_name, m.type as market_type,
              e.id as event_id, e.name as event_name, e.sport, e.start_time, e.status as event_status,
              e.home_team, e.away_team
       FROM parlay_legs pl
       JOIN selections s ON pl.selection_id = s.id
       JOIN markets m ON s.market_id = m.id
       JOIN events e ON m.event_id = e.id
       WHERE pl.parlay_id = $1
       ORDER BY pl.leg_number`,
      [id]
    );

    const legs: ParlayLegWithDetails[] = (legsResult.rows as ParlayLegQueryRow[]).map((row) => ({
      id: row.id,
      parlay_id: row.parlay_id,
      selection_id: row.selection_id,
      odds_at_placement: row.odds_at_placement,
      status: row.status,
      leg_number: row.leg_number,
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

    const parlayWithLegs: ParlayBetWithLegs = {
      ...parlay,
      legs,
    };

    const response: ApiResponse<ParlayBetWithLegs> = {
      success: true,
      data: parlayWithLegs,
    };

    res.json(response);
  } catch (error) {
    console.error('Get parlay error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.post('/internal/settle-parlay-leg', async (req, res) => {
  try {
    const { selection_id, winning } = req.body;

    if (!selection_id || winning === undefined) {
      res.status(400).json({ success: false, error: 'selection_id and winning are required' });
      return;
    }

    const newLegStatus: ParlayLegStatus = winning ? 'won' : 'lost';

    const legsResult = await query(
      'SELECT id, parlay_id FROM parlay_legs WHERE selection_id = $1 AND status = $2',
      [selection_id, 'pending']
    );

    const settledLegs: string[] = [];
    const affectedParlays = new Set<string>();

    for (const leg of legsResult.rows) {
      await query('UPDATE parlay_legs SET status = $1 WHERE id = $2', [newLegStatus, leg.id]);
      settledLegs.push(leg.id);
      affectedParlays.add(leg.parlay_id);
    }

    for (const parlayId of affectedParlays) {
      const allLegsResult = await query(
        'SELECT status, odds_at_placement FROM parlay_legs WHERE parlay_id = $1',
        [parlayId]
      );

      const allLegs = allLegsResult.rows;
      const hasLost = allLegs.some((l: { status: string }) => l.status === 'lost');
      const allSettled = allLegs.every((l: { status: string }) => l.status !== 'pending');
      const allWon = allLegs.every((l: { status: string }) => l.status === 'won');
      const hasVoid = allLegs.some((l: { status: string }) => l.status === 'void');

      if (hasLost) {
        await query(
          "UPDATE parlay_bets SET status = 'lost', settled_at = NOW() WHERE id = $1",
          [parlayId]
        );
      } else if (allSettled && allWon) {
        const parlayResult = await query(
          'SELECT user_id, potential_payout FROM parlay_bets WHERE id = $1',
          [parlayId]
        );
        const parlay = parlayResult.rows[0];

        await query(
          "UPDATE parlay_bets SET status = 'won', settled_at = NOW() WHERE id = $1",
          [parlayId]
        );

        try {
          await axios.post(`${WALLET_SERVICE_URL}/internal/credit-winnings`, {
            userId: parlay.user_id,
            amount: parseFloat(parlay.potential_payout),
            betId: parlayId,
          });
        } catch (walletError) {
          console.error(`Failed to credit parlay winnings for ${parlayId}:`, walletError);
        }
      } else if (allSettled && hasVoid) {
        const nonVoidLegs = allLegs.filter((l: { status: string }) => l.status !== 'void');
        if (nonVoidLegs.every((l: { status: string }) => l.status === 'won')) {
          const newCombinedOdds = nonVoidLegs.reduce(
            (acc: number, l: { odds_at_placement: number }) => acc * l.odds_at_placement,
            1
          );

          const parlayResult = await query(
            'SELECT user_id, total_stake FROM parlay_bets WHERE id = $1',
            [parlayId]
          );
          const parlay = parlayResult.rows[0];
          const newPayout = parlay.total_stake * newCombinedOdds;

          await query(
            "UPDATE parlay_bets SET status = 'partially_void', combined_odds = $1, potential_payout = $2, settled_at = NOW() WHERE id = $3",
            [newCombinedOdds, newPayout, parlayId]
          );

          try {
            await axios.post(`${WALLET_SERVICE_URL}/internal/credit-winnings`, {
              userId: parlay.user_id,
              amount: newPayout,
              betId: parlayId,
            });
          } catch (walletError) {
            console.error(`Failed to credit parlay winnings for ${parlayId}:`, walletError);
          }
        }
      }
    }

    res.json({
      success: true,
      data: {
        selection_id,
        winning,
        settled_legs_count: settledLegs.length,
        affected_parlays: Array.from(affectedParlays),
      },
    });
  } catch (error) {
    console.error('Settle parlay leg error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/internal/settle', async (req, res) => {
  try {
    const { selection_id, winning } = req.body;

    if (!selection_id || winning === undefined) {
      res.status(400).json({ success: false, error: 'selection_id and winning are required' });
      return;
    }

    const newStatus = winning ? 'won' : 'lost';

    const betsResult = await query(
      'SELECT id, user_id, potential_payout FROM bets WHERE selection_id = $1 AND status = $2',
      [selection_id, 'pending']
    );

    const settledBets: string[] = [];

    for (const bet of betsResult.rows) {
      await query(
        'UPDATE bets SET status = $1 WHERE id = $2',
        [newStatus, bet.id]
      );

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
