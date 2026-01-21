import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import {
  query,
  SportEvent,
  Market,
  Selection,
  EventWithMarkets,
  MarketWithSelections,
  ApiResponse,
  Sport,
  EventStatus,
  publishEvent,
  connectRabbitMQ,
} from 'shared';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'event-service' });
});

app.get('/events', async (req, res) => {
  try {
    const { sport, status, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT id, sport, name, home_team, away_team, start_time, status, created_at
      FROM events
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (sport) {
      queryText += ` AND sport = $${paramIndex++}`;
      params.push(sport);
    }

    if (status) {
      queryText += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    queryText += ` ORDER BY start_time ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await query(queryText, params);
    const events: SportEvent[] = result.rows;

    const response: ApiResponse<SportEvent[]> = {
      success: true,
      data: events,
    };

    res.json(response);
  } catch (error) {
    console.error('Get events error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.get('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const eventResult = await query(
      `SELECT id, sport, name, home_team, away_team, start_time, status, created_at
       FROM events WHERE id = $1`,
      [id]
    );

    if (eventResult.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Event not found',
      };
      res.status(404).json(response);
      return;
    }

    const event: SportEvent = eventResult.rows[0];

    const marketsResult = await query(
      `SELECT id, event_id, name, type, status, created_at
       FROM markets WHERE event_id = $1`,
      [id]
    );

    const markets: MarketWithSelections[] = [];

    for (const market of marketsResult.rows) {
      const selectionsResult = await query(
        `SELECT id, market_id, name, odds, created_at
         FROM selections WHERE market_id = $1`,
        [market.id]
      );

      markets.push({
        ...market,
        selections: selectionsResult.rows,
      });
    }

    const eventWithMarkets: EventWithMarkets = {
      ...event,
      markets,
    };

    const response: ApiResponse<EventWithMarkets> = {
      success: true,
      data: eventWithMarkets,
    };

    res.json(response);
  } catch (error) {
    console.error('Get event error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.get('/markets/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    const marketsResult = await query(
      `SELECT id, event_id, name, type, status, created_at
       FROM markets WHERE event_id = $1`,
      [eventId]
    );

    const markets: MarketWithSelections[] = [];

    for (const market of marketsResult.rows) {
      const selectionsResult = await query(
        `SELECT id, market_id, name, odds, created_at
         FROM selections WHERE market_id = $1`,
        [market.id]
      );

      markets.push({
        ...market,
        selections: selectionsResult.rows,
      });
    }

    const response: ApiResponse<MarketWithSelections[]> = {
      success: true,
      data: markets,
    };

    res.json(response);
  } catch (error) {
    console.error('Get markets error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.post('/internal/events', async (req, res) => {
  try {
    const { sport, name, home_team, away_team, start_time, markets } = req.body;

    if (!sport || !name || !start_time) {
      res.status(400).json({ success: false, error: 'sport, name, and start_time are required' });
      return;
    }

    await query('BEGIN');

    const eventId = uuidv4();
    await query(
      `INSERT INTO events (id, sport, name, home_team, away_team, start_time, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'upcoming', NOW())`,
      [eventId, sport, name, home_team || null, away_team || null, start_time]
    );

    if (markets && Array.isArray(markets)) {
      for (const market of markets) {
        const marketId = uuidv4();
        await query(
          `INSERT INTO markets (id, event_id, name, type, status, created_at)
           VALUES ($1, $2, $3, $4, 'open', NOW())`,
          [marketId, eventId, market.name, market.type]
        );

        if (market.selections && Array.isArray(market.selections)) {
          for (const selection of market.selections) {
            await query(
              `INSERT INTO selections (id, market_id, name, odds, created_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [uuidv4(), marketId, selection.name, selection.odds]
            );
          }
        }
      }
    }

    await query('COMMIT');

    const eventResult = await query(
      `SELECT id, sport, name, home_team, away_team, start_time, status, created_at
       FROM events WHERE id = $1`,
      [eventId]
    );

    res.status(201).json({ success: true, data: eventResult.rows[0] });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Create event error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.patch('/internal/events/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['upcoming', 'live', 'finished', 'cancelled'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    const currentResult = await query(
      'SELECT status FROM events WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    const oldStatus = currentResult.rows[0].status as EventStatus;

    await query(
      'UPDATE events SET status = $1 WHERE id = $2',
      [status, id]
    );

    if (status === 'live') {
      await query(
        'UPDATE markets SET status = $1 WHERE event_id = $2 AND status = $3',
        ['open', id, 'open']
      );
    } else if (status === 'finished' || status === 'cancelled') {
      await query(
        'UPDATE markets SET status = $1 WHERE event_id = $2',
        ['closed', id]
      );
    }

    try {
      await publishEvent('events.status_changed', {
        type: 'EVENT_STATUS_CHANGED',
        payload: {
          event_id: id,
          old_status: oldStatus,
          new_status: status as EventStatus,
          timestamp: new Date(),
        },
      });
    } catch (mqError) {
      console.error('Failed to publish event status change:', mqError);
    }

    const updatedResult = await query(
      `SELECT id, sport, name, home_team, away_team, start_time, status, created_at
       FROM events WHERE id = $1`,
      [id]
    );

    res.json({ success: true, data: updatedResult.rows[0] });
  } catch (error) {
    console.error('Update event status error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/internal/selections/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT s.id, s.market_id, s.name, s.odds, s.created_at,
              m.event_id, m.name as market_name, m.type as market_type, m.status as market_status
       FROM selections s
       JOIN markets m ON s.market_id = m.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Selection not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get selection error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

async function initializeMessageQueue() {
  try {
    await connectRabbitMQ();
    console.log('Event service connected to RabbitMQ');
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
  }
}

app.listen(PORT, () => {
  console.log(`Event service running on port ${PORT}`);
  initializeMessageQueue();
});
