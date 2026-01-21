import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  query,
  redis,
  Selection,
  ApiResponse,
  publishEvent,
  connectRabbitMQ,
} from 'shared';

const app = express();
const PORT = process.env.PORT || 3004;
const WS_PORT = process.env.WS_PORT || 3014;

app.use(cors());
app.use(express.json());

const wsServer = createServer();
const wss = new WebSocketServer({ server: wsServer });

const eventSubscriptions = new Map<string, Set<WebSocket>>();

const ODDS_CACHE_TTL = 60;

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'odds-service' });
});

app.get('/odds/:selectionId', async (req, res) => {
  try {
    const { selectionId } = req.params;

    const cachedOdds = await redis.get(`odds:${selectionId}`);
    if (cachedOdds) {
      const response: ApiResponse<{ selectionId: string; odds: number }> = {
        success: true,
        data: { selectionId, odds: parseFloat(cachedOdds) },
      };
      res.json(response);
      return;
    }

    const result = await query(
      'SELECT id, market_id, name, odds FROM selections WHERE id = $1',
      [selectionId]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Selection not found',
      };
      res.status(404).json(response);
      return;
    }

    const selection: Selection = result.rows[0];

    await redis.setex(`odds:${selectionId}`, ODDS_CACHE_TTL, selection.odds.toString());

    const response: ApiResponse<Selection> = {
      success: true,
      data: selection,
    };

    res.json(response);
  } catch (error) {
    console.error('Get odds error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.get('/odds/market/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params;

    const result = await query(
      'SELECT id, market_id, name, odds FROM selections WHERE market_id = $1',
      [marketId]
    );

    const selections: Selection[] = result.rows;

    for (const selection of selections) {
      await redis.setex(`odds:${selection.id}`, ODDS_CACHE_TTL, selection.odds.toString());
    }

    const response: ApiResponse<Selection[]> = {
      success: true,
      data: selections,
    };

    res.json(response);
  } catch (error) {
    console.error('Get market odds error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.put('/internal/odds/:selectionId', async (req, res) => {
  try {
    const { selectionId } = req.params;
    const { odds } = req.body;

    if (!odds || odds <= 1.0) {
      res.status(400).json({ success: false, error: 'Odds must be greater than 1.0' });
      return;
    }

    const currentResult = await query(
      `SELECT s.odds, m.event_id
       FROM selections s
       JOIN markets m ON s.market_id = m.id
       WHERE s.id = $1`,
      [selectionId]
    );

    if (currentResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Selection not found' });
      return;
    }

    const oldOdds = parseFloat(currentResult.rows[0].odds);
    const eventId = currentResult.rows[0].event_id;

    await query(
      'UPDATE selections SET odds = $1 WHERE id = $2',
      [odds, selectionId]
    );

    await redis.setex(`odds:${selectionId}`, ODDS_CACHE_TTL, odds.toString());

    try {
      await publishEvent('odds.updated', {
        type: 'ODDS_UPDATED',
        payload: {
          selection_id: selectionId,
          old_odds: oldOdds,
          new_odds: odds,
          timestamp: new Date(),
        },
      });
    } catch (mqError) {
      console.error('Failed to publish odds update:', mqError);
    }

    broadcastOddsUpdate(eventId, selectionId, oldOdds, odds);

    res.json({ success: true, data: { selectionId, odds } });
  } catch (error) {
    console.error('Update odds error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

function broadcastOddsUpdate(eventId: string, selectionId: string, oldOdds: number, newOdds: number) {
  const subscribers = eventSubscriptions.get(eventId);
  if (!subscribers) return;

  const message = JSON.stringify({
    type: 'ODDS_UPDATE',
    data: {
      eventId,
      selectionId,
      oldOdds,
      newOdds,
      timestamp: new Date().toISOString(),
    },
  });

  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'SUBSCRIBE' && message.eventId) {
        if (!eventSubscriptions.has(message.eventId)) {
          eventSubscriptions.set(message.eventId, new Set());
        }
        eventSubscriptions.get(message.eventId)!.add(ws);

        ws.send(JSON.stringify({
          type: 'SUBSCRIBED',
          eventId: message.eventId,
        }));

        console.log(`Client subscribed to event ${message.eventId}`);
      }

      if (message.type === 'UNSUBSCRIBE' && message.eventId) {
        const subscribers = eventSubscriptions.get(message.eventId);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) {
            eventSubscriptions.delete(message.eventId);
          }
        }

        ws.send(JSON.stringify({
          type: 'UNSUBSCRIBED',
          eventId: message.eventId,
        }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    for (const [eventId, subscribers] of eventSubscriptions.entries()) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        eventSubscriptions.delete(eventId);
      }
    }
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

let simulatorInterval: NodeJS.Timeout | null = null;

async function startOddsSimulator() {
  if (simulatorInterval) return;

  simulatorInterval = setInterval(async () => {
    try {
      const result = await query(`
        SELECT s.id, s.odds, m.event_id
        FROM selections s
        JOIN markets m ON s.market_id = m.id
        JOIN events e ON m.event_id = e.id
        WHERE e.status = 'live' AND m.status = 'open'
        ORDER BY RANDOM()
        LIMIT 5
      `);

      for (const row of result.rows) {
        const adjustment = 0.95 + Math.random() * 0.1;
        const newOdds = Math.max(1.01, parseFloat(row.odds) * adjustment);
        const roundedOdds = Math.round(newOdds * 100) / 100;

        await query('UPDATE selections SET odds = $1 WHERE id = $2', [roundedOdds, row.id]);
        await redis.setex(`odds:${row.id}`, ODDS_CACHE_TTL, roundedOdds.toString());

        broadcastOddsUpdate(row.event_id, row.id, parseFloat(row.odds), roundedOdds);

        try {
          await publishEvent('odds.updated', {
            type: 'ODDS_UPDATED',
            payload: {
              selection_id: row.id,
              old_odds: parseFloat(row.odds),
              new_odds: roundedOdds,
              timestamp: new Date(),
            },
          });
        } catch (mqError) {
        }
      }
    } catch (error) {
    }
  }, 5000);
}

app.post('/internal/simulator/start', (_, res) => {
  startOddsSimulator();
  res.json({ success: true, message: 'Odds simulator started' });
});

app.post('/internal/simulator/stop', (_, res) => {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;
  }
  res.json({ success: true, message: 'Odds simulator stopped' });
});

async function initializeMessageQueue() {
  try {
    await connectRabbitMQ();
    console.log('Odds service connected to RabbitMQ');
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
  }
}

app.listen(PORT, () => {
  console.log(`Odds service running on port ${PORT}`);
  initializeMessageQueue();
});

wsServer.listen(WS_PORT, () => {
  console.log(`Odds WebSocket server running on port ${WS_PORT}`);
});
