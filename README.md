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

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm 9+

## Quick Start

> **Important:** All commands below should be run from the **project root directory** (`betting-platform/`), not from subdirectories like `frontend/` or `backend/`.

### 1. Start Infrastructure (Docker)

```bash
# Start PostgreSQL, Redis, and RabbitMQ containers
npm run docker:up

# Verify containers are running
docker ps
```

Expected containers:
- `betting-postgres` - PostgreSQL database
- `betting-redis` - Redis cache
- `betting-rabbitmq` - RabbitMQ message broker

### 2. Install Dependencies

```bash
# Install all workspace dependencies
npm install
```

### 3. Seed the Database

```bash
# Populate database with test events, markets, and selections
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
# Start frontend + all backend services
npm run dev
```

Or start separately:

```bash
# Frontend only
npm run dev:frontend

# Backend services only
npm run dev:backend
```

**Option B: Run frontend in Docker (with hot reloading)**

```bash
# Start infrastructure + frontend container
npm run docker:dev

# Or rebuild and start (after Dockerfile changes)
npm run docker:dev:build

# View frontend logs
npm run docker:dev:logs

# Then start backend services locally
npm run dev:backend
```

The Docker frontend runs with hot reloading enabled - any changes to files in `frontend/src/` will automatically trigger a rebuild.

### 5. Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React application |
| GraphQL Playground | http://localhost:3000/graphql | API testing interface |
| RabbitMQ Management | http://localhost:15672 | Message broker admin (betting/betting123) |

## Services Overview

### API Gateway (Port 3000)

GraphQL endpoint aggregating all backend services.

**Key Operations:**
```graphql
# Queries
me                    # Current user profile
events(sport, status) # List events with filters
event(id)            # Single event with markets
myBets               # User's bet history
wallet               # User's wallet balance
transactions         # Transaction history

# Mutations
register(input)      # Create account
login(input)         # Authenticate
placeBet(input)      # Place a bet
deposit(amount)      # Add funds
withdraw(amount)     # Remove funds

# Subscriptions
oddsUpdated(eventId) # Real-time odds changes
```

### User Service (Port 3001)

Handles authentication and user management.

- `POST /register` - Create new account (includes $100 demo balance)
- `POST /login` - Authenticate user
- `POST /refresh` - Refresh access token
- `GET /profile` - Get user profile (protected)

### Wallet Service (Port 3002)

Manages user balances and transactions.

- `GET /balance` - Get wallet balance
- `POST /deposit` - Add funds
- `POST /withdraw` - Remove funds
- `GET /transactions` - Transaction history

### Bet Service (Port 3003)

Handles bet placement and management.

- `POST /bets` - Place a bet
- `GET /bets` - List user's bets
- `GET /bets/:id` - Get single bet details

### Odds Service (Port 3004)

Manages odds with real-time updates.

- `GET /odds/:selectionId` - Get current odds
- `GET /odds/market/:marketId` - Get all odds for market
- WebSocket server on port 3014 for live updates
- Built-in odds fluctuation simulator for live events

### Event Service (Port 3005)

Manages sports events and markets.

- `GET /events` - List events (filterable by sport/status)
- `GET /events/:id` - Get event with markets and selections
- `GET /markets/:eventId` - Get markets for event

## Project Structure

```
betting-platform/
├── docker-compose.yml          # Infrastructure containers
├── package.json                # Root workspace config
├── frontend/                   # React + Vite application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Route pages
│   │   ├── graphql/           # Queries and mutations
│   │   ├── lib/               # Apollo client, auth helpers
│   │   └── store/             # Zustand state (bet slip)
│   └── ...
└── backend/
    ├── shared/                # Shared utilities and types
    │   └── src/
    │       ├── types/         # TypeScript interfaces
    │       ├── middleware/    # Auth middleware
    │       └── utils/         # DB, Redis, RabbitMQ clients
    ├── api-gateway/           # GraphQL gateway
    ├── user-service/          # Authentication service
    ├── wallet-service/        # Balance management
    ├── bet-service/           # Bet placement
    ├── odds-service/          # Odds management + WebSocket
    ├── event-service/         # Events and markets
    └── database/
        ├── init.sql           # Schema initialization
        └── seed.ts            # Test data seeder
```

## Development

### Environment Variables

Services use these defaults (override via environment):

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=betting_platform
DB_USER=betting
DB_PASSWORD=betting123

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_URL=amqp://betting:betting123@localhost:5672

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

### Useful Commands

```bash
# Stop all Docker containers
npm run docker:down

# Rebuild and restart containers
npm run docker:down && npm run docker:up

# View service logs
docker logs betting-postgres
docker logs betting-redis
docker logs betting-rabbitmq
```

### Testing the API

Using GraphQL Playground at http://localhost:3000/graphql:

```graphql
# Register a new user
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

# Login
mutation {
  login(input: {
    email: "test@example.com"
    password: "password123"
  }) {
    accessToken
    refreshToken
  }
}

# Get events (set Authorization header: Bearer <token>)
query {
  events(sport: football, status: upcoming) {
    id
    name
    startTime
    status
  }
}

# Place a bet
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

## Tech Stack

### Frontend
- React 18 + TypeScript
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
