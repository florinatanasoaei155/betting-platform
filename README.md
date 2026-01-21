# Betting Platform

A mock sports betting platform (Betfair-style) with React frontend and Node.js microservices backend, featuring GraphQL API Gateway.

## Architecture

```
┌─────────────────┐
│   React (Vite)  │
│    Frontend     │
│   Port: 5173    │
└────────┬────────┘
         │
┌────────▼────────┐
│   API Gateway   │
│   (GraphQL)     │
│   Port: 3000    │
└────────┬────────┘
         │
┌────────┴────────┬────────────────┬────────────────┬────────────────┐
│                 │                │                │                │
▼                 ▼                ▼                ▼                ▼
┌─────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│  User   │ │  Wallet   │ │    Bet    │ │   Odds    │ │   Event   │
│ Service │ │  Service  │ │  Service  │ │  Service  │ │  Service  │
│  :3001  │ │   :3002   │ │   :3003   │ │   :3004   │ │   :3005   │
└─────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘

Data Stores (Docker):
├── PostgreSQL (port 5432) - Users, Wallets, Bets, Events
├── Redis (port 6379) - Odds cache, Sessions, Rate limiting
└── RabbitMQ (port 5672/15672) - Event messaging
```

## Technology Choices

### Frontend

| Technology | Purpose | Why This Choice |
|------------|---------|-----------------|
| **React 19** | UI Framework | Latest stable version with improved performance, automatic batching, and better concurrent features. The new compiler optimizations reduce bundle size and improve runtime performance. |
| **Vite** | Build Tool | Extremely fast HMR (Hot Module Replacement) with native ESM support. Development server starts in milliseconds compared to webpack's seconds. Zero-config TypeScript and JSX support. |
| **Apollo Client** | GraphQL Client | Intelligent caching with normalized data store, automatic query refetching on mutations, built-in WebSocket subscription support for real-time updates. |
| **React Router v6** | Routing | Type-safe routing with nested routes support, declarative navigation, and built-in loader/action patterns for data fetching. |
| **Zustand** | State Management | Minimal footprint (~1kb gzipped), no boilerplate or providers required, works seamlessly with React 19's concurrent features. Chosen over Redux for simplicity in this scope. |
| **Tailwind CSS** | Styling | Utility-first approach eliminates CSS naming conflicts, enables rapid prototyping, and creates a consistent design system. Purges unused styles in production for optimal bundle size. |
| **TypeScript** | Type Safety | Compile-time error catching, better IDE autocompletion, and self-documenting code. Shared types with backend ensure API contract consistency. |

### Backend

| Technology | Purpose | Why This Choice |
|------------|---------|-----------------|
| **Node.js + Express** | HTTP Server | Non-blocking I/O is ideal for I/O-bound microservices. Express provides minimal overhead with extensive middleware ecosystem for authentication, CORS, and rate limiting. |
| **Apollo Server** | GraphQL Gateway | Industry-standard GraphQL implementation with built-in schema stitching, caching directives, and excellent developer tooling (GraphQL Playground). |
| **PostgreSQL** | Primary Database | ACID compliance essential for financial transactions (bets, wallet balances). Complex query support for event filtering, JSON types for flexible data, and proven reliability at scale. |
| **Redis** | Caching Layer | Sub-millisecond read latency for odds caching, built-in pub/sub for real-time event broadcasting, and rate limiting support via sliding window algorithms. |
| **RabbitMQ** | Message Queue | Reliable message delivery with acknowledgments, flexible routing patterns (topic exchange), and service decoupling for bet placement events and odds updates. |
| **JWT** | Authentication | Stateless authentication scales horizontally without session storage. Access tokens (1h) and refresh tokens (7d) balance security with user experience. |
| **TypeScript** | Type Safety | Shared type definitions between services eliminate API contract mismatches. Runtime type validation reduces bugs in production. |

### Infrastructure

| Technology | Purpose | Why This Choice |
|------------|---------|-----------------|
| **Docker Compose** | Container Orchestration | Ensures consistent development environments across teams. Single command spins up all infrastructure dependencies. Profile support separates dev and production configurations. |
| **npm Workspaces** | Monorepo Management | Shared dependencies reduce disk usage, coordinated builds ensure compatibility, single package-lock provides reproducible installs. Simpler than Turborepo/Nx for this project scope. |

### Why GraphQL at Gateway, REST Internally?

The hybrid API approach combines the best of both worlds:

**GraphQL at Gateway:**
- Single endpoint reduces client-side complexity
- Schema acts as API documentation
- Clients request exactly the data they need (no over-fetching)
- WebSocket subscriptions for real-time odds updates

**REST Between Services:**
- Simpler to implement and debug
- Well-understood patterns for inter-service communication
- No GraphQL federation complexity needed for internal calls
- Easier to add caching headers and monitoring

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm 9+

## Quick Start

> **Important:** All commands below should be run from the **project root directory** (`betting-platform/`), not from subdirectories like `frontend/` or `backend/`.

### 1. Start Infrastructure (Docker)

```bash
npm run docker:up

docker ps
```

Expected containers:
- `betting-postgres` - PostgreSQL database
- `betting-redis` - Redis cache
- `betting-rabbitmq` - RabbitMQ message broker

### 2. Install Dependencies

```bash
npm install
```

### 3. Seed the Database

```bash
npm run db:seed
```

This creates:
- 10 Football events
- 10 Basketball events
- 10 Tennis events
- Multiple markets per event (Match Winner, Over/Under, etc.)
- 3 events set to "live" status for testing

### 4. Start All Services

**Option A: Run locally (Node.js)**

```bash
npm run dev
```

Or start separately:

```bash
npm run dev:frontend

npm run dev:backend
```

**Option B: Run frontend in Docker (with hot reloading)**

```bash
npm run docker:dev

npm run docker:dev:build

npm run docker:dev:logs

npm run dev:backend
```

The Docker frontend runs with hot reloading enabled via Vite's polling mode.

### 5. Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React application |
| GraphQL Playground | http://localhost:3000/graphql | API testing interface |
| RabbitMQ Management | http://localhost:15672 | Message broker admin (betting/betting123) |

## Services Deep Dive

### API Gateway (Port 3000)

**Technology Stack:** Apollo Server, GraphQL, WebSocket

The API Gateway aggregates all backend microservices through a single GraphQL endpoint.

**Key Responsibilities:**
- **Single Entry Point**: Clients only need to know one endpoint
- **Authorization**: Centralized JWT validation before routing requests
- **Rate Limiting**: Redis-backed request throttling (100 requests/minute per IP)
- **WebSocket Subscriptions**: Real-time odds updates via GraphQL subscriptions

**GraphQL Schema:**
```graphql
type Query {
  me: User
  events(sport: Sport, status: EventStatus): [Event!]!
  event(id: ID!): Event
  myBets: [Bet!]!
  wallet: Wallet
  transactions: [Transaction!]!
}

type Mutation {
  register(input: RegisterInput!): AuthPayload!
  login(input: LoginInput!): AuthPayload!
  placeBet(input: PlaceBetInput!): Bet!
  deposit(amount: Float!): Wallet!
  withdraw(amount: Float!): Wallet!
}

type Subscription {
  oddsUpdated(eventId: ID!): OddsUpdate!
}
```

### User Service (Port 3001)

**Technology Stack:** Express, bcryptjs, JWT

Handles authentication and user management.

**Security Implementation:**
- Password hashing with bcrypt (10 salt rounds)
- JWT access tokens (1 hour expiry) for API authentication
- JWT refresh tokens (7 days expiry) for session continuity
- Automatic wallet creation with $100 demo balance on registration

**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /register | No | Create account |
| POST | /login | No | Authenticate |
| POST | /refresh | No | Refresh access token |
| GET | /profile | Yes | Get user profile |
| GET | /internal/user/:id | Internal | Service lookup |

### Wallet Service (Port 3002)

**Technology Stack:** Express, PostgreSQL transactions

Manages user balances and transactions with ACID compliance.

**Data Integrity Features:**
- All balance changes wrapped in PostgreSQL transactions
- Automatic rollback on any failure
- Transaction history for complete audit trail
- Optimistic locking prevents race conditions

**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /balance | Yes | Get wallet balance |
| POST | /deposit | Yes | Add funds |
| POST | /withdraw | Yes | Remove funds |
| GET | /transactions | Yes | Transaction history |
| POST | /internal/deduct-stake | Internal | Deduct bet stake |
| POST | /internal/credit-winnings | Internal | Credit winnings |

### Bet Service (Port 3003)

**Technology Stack:** Express, Axios for inter-service communication

Handles bet placement and management with distributed transaction coordination.

**Bet Placement Flow:**
1. Validate user balance via Wallet Service
2. Verify selection exists and market is open via Event Service
3. Lock current odds at placement time (protects user from odds drift)
4. Deduct stake from wallet (transactional)
5. Create bet record in database
6. Publish BET_PLACED event to RabbitMQ

**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /bets | Yes | Place a bet |
| GET | /bets | Yes | List user's bets |
| GET | /bets/:id | Yes | Get single bet |
| POST | /internal/settle | Internal | Settle bets for selection |

### Odds Service (Port 3004)

**Technology Stack:** Express, Redis caching, WebSocket

Manages odds with real-time updates and intelligent caching.

**Caching Strategy:**
- Redis cache with 60-second TTL for all odds
- Cache-aside pattern: check cache first, fallback to database
- Cache invalidation on odds update

**Real-time Updates:**
- WebSocket server on port 3014 for live odds streaming
- Built-in odds fluctuation simulator (adjusts by -5% to +5% every 5 seconds for live events)
- Publishes ODDS_UPDATED to RabbitMQ for cross-service communication

**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /odds/:selectionId | No | Get current odds |
| GET | /odds/market/:marketId | No | Get all market odds |
| PUT | /internal/odds/:selectionId | Internal | Update odds |
| POST | /internal/simulator/start | Internal | Start odds simulator |
| POST | /internal/simulator/stop | Internal | Stop odds simulator |

### Event Service (Port 3005)

**Technology Stack:** Express, PostgreSQL

Manages sports events, markets, and selections.

**Data Model:**
- **Events**: Sports matches (football, basketball, tennis) with home/away teams and status (upcoming, live, finished, cancelled)
- **Markets**: Betting options per event (Match Winner, Over/Under, Both Teams to Score, Handicap)
- **Selections**: Individual outcomes with decimal odds

**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /events | No | List events with filters |
| GET | /events/:id | No | Get event with markets |
| GET | /markets/:eventId | No | Get markets for event |
| POST | /internal/events | Internal | Create event |
| PATCH | /internal/events/:id/status | Internal | Update event status |
| GET | /internal/selections/:id | Internal | Get selection details |

## Project Structure

```
betting-platform/
├── docker-compose.yml
├── package.json
├── scripts/
│   └── cleanup.sh
├── frontend/
│   ├── Dockerfile.dev
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── components/
│       │   ├── Layout/
│       │   ├── EventCard/
│       │   └── BetSlip/
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── Events.tsx
│       │   ├── EventDetail.tsx
│       │   ├── Login.tsx
│       │   ├── Register.tsx
│       │   ├── MyBets.tsx
│       │   └── Wallet.tsx
│       ├── graphql/
│       │   ├── queries.ts
│       │   └── mutations.ts
│       ├── lib/
│       │   ├── apollo-client.ts
│       │   └── auth.ts
│       └── store/
│           └── useStore.ts
└── backend/
    ├── shared/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── types/
    │       │   └── index.ts
    │       ├── middleware/
    │       │   └── auth.ts
    │       └── utils/
    │           ├── db.ts
    │           ├── redis.ts
    │           └── rabbitmq.ts
    ├── api-gateway/
    │   └── src/
    │       ├── index.ts
    │       ├── schema.ts
    │       └── resolvers.ts
    ├── user-service/
    │   └── src/
    │       └── index.ts
    ├── wallet-service/
    │   └── src/
    │       └── index.ts
    ├── bet-service/
    │   └── src/
    │       └── index.ts
    ├── odds-service/
    │   └── src/
    │       └── index.ts
    ├── event-service/
    │   └── src/
    │       └── index.ts
    └── database/
        ├── init.sql
        └── seed.ts
```

## Development

### Environment Variables

Services use these defaults (override via environment):

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=betting_platform
DB_USER=betting
DB_PASSWORD=betting123

REDIS_HOST=localhost
REDIS_PORT=6379

RABBITMQ_URL=amqp://betting:betting123@localhost:5672

JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

### Useful Commands

```bash
npm run docker:down

npm run docker:down && npm run docker:up

npm run docker:clean

docker logs betting-postgres
docker logs betting-redis
docker logs betting-rabbitmq
```

### Testing the API

Using GraphQL Playground at http://localhost:3000/graphql:

```graphql
mutation {
  register(input: {
    email: "test@example.com"
    username: "testuser"
    password: "password123"
  }) {
    user { id username }
    accessToken
  }
}

mutation {
  login(input: {
    email: "test@example.com"
    password: "password123"
  }) {
    accessToken
    refreshToken
  }
}

query {
  events(sport: football, status: upcoming) {
    id
    name
    startTime
    status
  }
}

mutation {
  placeBet(input: {
    selectionId: "<selection-id>"
    stake: 10.00
  }) {
    id
    status
    potentialPayout
  }
}
```

## Tech Stack Summary

### Frontend
- React 19 + TypeScript
- Vite (build tool)
- Apollo Client (GraphQL)
- React Router v6
- Zustand (state management)
- Tailwind CSS

### Backend
- Node.js + Express + TypeScript
- Apollo Server (GraphQL gateway)
- PostgreSQL (database)
- Redis (caching)
- RabbitMQ (messaging)
- JWT (authentication)

## Features

- User registration with $100 demo balance
- Browse events by sport and status
- Real-time odds updates via WebSocket
- Bet slip with multiple selections
- Transaction history
- Responsive dark theme UI

## Cleanup

To completely remove all Docker resources:

```bash
npm run docker:clean
```

This will:
- Stop all betting-platform containers
- Remove containers, images, and volumes
- Prune dangling images and unused networks
