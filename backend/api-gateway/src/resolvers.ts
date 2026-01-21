import axios from 'axios';
import { GraphQLError } from 'graphql';
import { PubSub } from 'graphql-subscriptions';

// Service URLs
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:3002';
const BET_SERVICE_URL = process.env.BET_SERVICE_URL || 'http://localhost:3003';
const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || 'http://localhost:3005';

const pubsub = new PubSub();

export interface Context {
  user?: {
    userId: string;
    email: string;
  };
  token?: string;
}

function requireAuth(context: Context) {
  if (!context.user) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

// Helper to transform snake_case to camelCase
function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

export const resolvers = {
  Query: {
    me: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      try {
        const response = await axios.get(`${USER_SERVICE_URL}/profile`, {
          headers: { Authorization: `Bearer ${context.token}` },
        });
        if (response.data.success) {
          return toCamelCase(response.data.data);
        }
        return null;
      } catch (error) {
        console.error('Error fetching user:', error);
        return null;
      }
    },

    events: async (_: unknown, args: { sport?: string; status?: string; limit?: number; offset?: number }) => {
      try {
        const params = new URLSearchParams();
        if (args.sport) params.append('sport', args.sport);
        if (args.status) params.append('status', args.status);
        if (args.limit) params.append('limit', args.limit.toString());
        if (args.offset) params.append('offset', args.offset.toString());

        const response = await axios.get(`${EVENT_SERVICE_URL}/events?${params.toString()}`);
        if (response.data.success) {
          return response.data.data.map((event: Record<string, unknown>) => toCamelCase(event));
        }
        return [];
      } catch (error) {
        console.error('Error fetching events:', error);
        return [];
      }
    },

    event: async (_: unknown, args: { id: string }) => {
      try {
        const response = await axios.get(`${EVENT_SERVICE_URL}/events/${args.id}`);
        if (response.data.success) {
          const event = response.data.data;
          return {
            ...toCamelCase(event),
            markets: event.markets?.map((market: Record<string, unknown>) => ({
              ...toCamelCase(market),
              selections: (market.selections as Record<string, unknown>[])?.map(
                (sel: Record<string, unknown>) => toCamelCase(sel)
              ),
            })),
          };
        }
        return null;
      } catch (error) {
        console.error('Error fetching event:', error);
        return null;
      }
    },

    myBets: async (_: unknown, args: { status?: string; limit?: number; offset?: number }, context: Context) => {
      requireAuth(context);
      try {
        const params = new URLSearchParams();
        if (args.status) params.append('status', args.status);
        if (args.limit) params.append('limit', args.limit.toString());
        if (args.offset) params.append('offset', args.offset.toString());

        const response = await axios.get(`${BET_SERVICE_URL}/bets?${params.toString()}`, {
          headers: { Authorization: `Bearer ${context.token}` },
        });
        if (response.data.success) {
          return response.data.data.map((bet: Record<string, unknown>) => ({
            ...toCamelCase(bet),
            selection: bet.selection ? toCamelCase(bet.selection as Record<string, unknown>) : null,
            market: bet.market ? toCamelCase(bet.market as Record<string, unknown>) : null,
            event: bet.event ? toCamelCase(bet.event as Record<string, unknown>) : null,
          }));
        }
        return [];
      } catch (error) {
        console.error('Error fetching bets:', error);
        return [];
      }
    },

    bet: async (_: unknown, args: { id: string }, context: Context) => {
      requireAuth(context);
      try {
        const response = await axios.get(`${BET_SERVICE_URL}/bets/${args.id}`, {
          headers: { Authorization: `Bearer ${context.token}` },
        });
        if (response.data.success) {
          const bet = response.data.data;
          return {
            ...toCamelCase(bet),
            selection: bet.selection ? toCamelCase(bet.selection) : null,
            market: bet.market ? toCamelCase(bet.market) : null,
            event: bet.event ? toCamelCase(bet.event) : null,
          };
        }
        return null;
      } catch (error) {
        console.error('Error fetching bet:', error);
        return null;
      }
    },

    wallet: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context);
      try {
        const response = await axios.get(`${WALLET_SERVICE_URL}/balance`, {
          headers: { Authorization: `Bearer ${context.token}` },
        });
        if (response.data.success) {
          return toCamelCase(response.data.data);
        }
        return null;
      } catch (error) {
        console.error('Error fetching wallet:', error);
        return null;
      }
    },

    transactions: async (_: unknown, args: { limit?: number; offset?: number }, context: Context) => {
      requireAuth(context);
      try {
        const params = new URLSearchParams();
        if (args.limit) params.append('limit', args.limit.toString());
        if (args.offset) params.append('offset', args.offset.toString());

        const response = await axios.get(`${WALLET_SERVICE_URL}/transactions?${params.toString()}`, {
          headers: { Authorization: `Bearer ${context.token}` },
        });
        if (response.data.success) {
          return response.data.data.map((tx: Record<string, unknown>) => toCamelCase(tx));
        }
        return [];
      } catch (error) {
        console.error('Error fetching transactions:', error);
        return [];
      }
    },
  },

  Mutation: {
    register: async (_: unknown, args: { input: { email: string; username: string; password: string } }) => {
      try {
        const response = await axios.post(`${USER_SERVICE_URL}/register`, args.input);
        if (response.data.success) {
          return {
            user: toCamelCase(response.data.data.user),
            accessToken: response.data.data.accessToken,
            refreshToken: response.data.data.refreshToken,
          };
        }
        throw new GraphQLError(response.data.error || 'Registration failed', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.data?.error) {
          throw new GraphQLError(error.response.data.error, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        throw new GraphQLError('Registration failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    login: async (_: unknown, args: { input: { email: string; password: string } }) => {
      try {
        const response = await axios.post(`${USER_SERVICE_URL}/login`, args.input);
        if (response.data.success) {
          return {
            user: toCamelCase(response.data.data.user),
            accessToken: response.data.data.accessToken,
            refreshToken: response.data.data.refreshToken,
          };
        }
        throw new GraphQLError(response.data.error || 'Login failed', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.data?.error) {
          throw new GraphQLError(error.response.data.error, {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }
        throw new GraphQLError('Login failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    refreshToken: async (_: unknown, args: { refreshToken: string }) => {
      try {
        const response = await axios.post(`${USER_SERVICE_URL}/refresh`, {
          refreshToken: args.refreshToken,
        });
        if (response.data.success) {
          return response.data.data.accessToken;
        }
        throw new GraphQLError('Invalid refresh token', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      } catch (error) {
        throw new GraphQLError('Token refresh failed', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
    },

    placeBet: async (_: unknown, args: { input: { selectionId: string; stake: number } }, context: Context) => {
      requireAuth(context);
      try {
        const response = await axios.post(
          `${BET_SERVICE_URL}/bets`,
          { selection_id: args.input.selectionId, stake: args.input.stake },
          { headers: { Authorization: `Bearer ${context.token}` } }
        );
        if (response.data.success) {
          return toCamelCase(response.data.data);
        }
        throw new GraphQLError(response.data.error || 'Failed to place bet', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.data?.error) {
          throw new GraphQLError(error.response.data.error, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        throw new GraphQLError('Failed to place bet', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    deposit: async (_: unknown, args: { amount: number }, context: Context) => {
      requireAuth(context);
      try {
        const response = await axios.post(
          `${WALLET_SERVICE_URL}/deposit`,
          { amount: args.amount },
          { headers: { Authorization: `Bearer ${context.token}` } }
        );
        if (response.data.success) {
          return toCamelCase(response.data.data);
        }
        throw new GraphQLError(response.data.error || 'Deposit failed', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.data?.error) {
          throw new GraphQLError(error.response.data.error, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        throw new GraphQLError('Deposit failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    withdraw: async (_: unknown, args: { amount: number }, context: Context) => {
      requireAuth(context);
      try {
        const response = await axios.post(
          `${WALLET_SERVICE_URL}/withdraw`,
          { amount: args.amount },
          { headers: { Authorization: `Bearer ${context.token}` } }
        );
        if (response.data.success) {
          return toCamelCase(response.data.data);
        }
        throw new GraphQLError(response.data.error || 'Withdrawal failed', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.data?.error) {
          throw new GraphQLError(error.response.data.error, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        throw new GraphQLError('Withdrawal failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },
  },

  Subscription: {
    oddsUpdated: {
      subscribe: (_: unknown, args: { eventId: string }) => {
        return pubsub.asyncIterator([`ODDS_UPDATED_${args.eventId}`]);
      },
    },
  },
};

// Export pubsub for use in WebSocket handler
export { pubsub };
