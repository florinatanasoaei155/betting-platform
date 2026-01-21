import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { typeDefs } from './schema';
import { resolvers, Context, pubsub } from './resolvers';
import { verifyToken, redis, JwtPayload } from 'shared';

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const httpServer = createServer(app);

// Create executable schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Create WebSocket server for subscriptions
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

// Set up WebSocket server
const serverCleanup = useServer(
  {
    schema,
    context: async (ctx) => {
      // Get token from connection params
      const token = ctx.connectionParams?.authorization as string;
      if (token) {
        try {
          const payload = verifyToken(token.replace('Bearer ', ''));
          return { user: payload, token: token.replace('Bearer ', '') };
        } catch {
          return {};
        }
      }
      return {};
    },
  },
  wsServer
);

// Create Apollo Server
const apolloServer = new ApolloServer<Context>({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

// Rate limiter using Redis
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rate_limit',
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
});

// Rate limiting middleware
const rateLimitMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    await rateLimiter.consume(ip);
    next();
  } catch {
    res.status(429).json({ error: 'Too many requests' });
  }
};

// WebSocket handler for odds updates (connect to odds service)
function setupOddsWebSocket() {
  const ODDS_WS_URL = process.env.ODDS_WS_URL || 'ws://localhost:3014';
  const WebSocket = require('ws');

  let ws: InstanceType<typeof WebSocket> | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;

  function connect() {
    ws = new WebSocket(ODDS_WS_URL);

    ws.on('open', () => {
      console.log('Connected to odds WebSocket');
      reconnectAttempts = 0;
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'ODDS_UPDATE') {
          // Publish to GraphQL subscriptions
          pubsub.publish(`ODDS_UPDATED_${message.data.eventId}`, {
            oddsUpdated: message.data,
          });
        }
      } catch (error) {
        console.error('Error processing odds update:', error);
      }
    });

    ws.on('close', () => {
      console.log('Odds WebSocket connection closed');
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(connect, 5000);
      }
    });

    ws.on('error', (error: Error) => {
      console.error('Odds WebSocket error:', error.message);
    });
  }

  // Initial connection attempt with delay
  setTimeout(connect, 5000);
}

async function startServer() {
  await apolloServer.start();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_, res) => {
    res.json({ status: 'ok', service: 'api-gateway' });
  });

  // Apply rate limiting and GraphQL middleware
  app.use(
    '/graphql',
    rateLimitMiddleware,
    expressMiddleware(apolloServer, {
      context: async ({ req }): Promise<Context> => {
        const authHeader = req.headers.authorization;
        if (authHeader) {
          const token = authHeader.replace('Bearer ', '');
          try {
            const payload = verifyToken(token) as JwtPayload;
            return { user: payload, token };
          } catch {
            return {};
          }
        }
        return {};
      },
    })
  );

  httpServer.listen(PORT, () => {
    console.log(`API Gateway running at http://localhost:${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
    console.log(`WebSocket subscriptions: ws://localhost:${PORT}/graphql`);
  });

  // Connect to odds service WebSocket
  setupOddsWebSocket();
}

startServer().catch(console.error);
