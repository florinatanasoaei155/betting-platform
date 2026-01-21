CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdraw', 'bet_stake', 'bet_win')),
    amount DECIMAL(12, 2) NOT NULL,
    reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sport VARCHAR(50) NOT NULL CHECK (sport IN ('football', 'basketball', 'tennis', 'horse_racing')),
    name VARCHAR(255) NOT NULL,
    home_team VARCHAR(100),
    away_team VARCHAR(100),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'finished', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_events_sport ON events(sport);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_time ON events(start_time);

CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'suspended', 'closed', 'settled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_markets_event_id ON markets(event_id);
CREATE INDEX idx_markets_status ON markets(status);

CREATE TABLE IF NOT EXISTS selections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    odds DECIMAL(8, 2) NOT NULL CHECK (odds > 1.0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_selections_market_id ON selections(market_id);

CREATE TABLE IF NOT EXISTS bets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    selection_id UUID NOT NULL REFERENCES selections(id),
    stake DECIMAL(12, 2) NOT NULL CHECK (stake > 0),
    odds_at_placement DECIMAL(8, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void', 'cashed_out')),
    potential_payout DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_selection_id ON bets(selection_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bets_created_at ON bets(created_at DESC);

CREATE TABLE IF NOT EXISTS parlay_bets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_stake DECIMAL(12, 2) NOT NULL CHECK (total_stake > 0),
    combined_odds DECIMAL(10, 4) NOT NULL CHECK (combined_odds > 1.0),
    potential_payout DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'partially_void', 'void')),
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_parlay_bets_user_id ON parlay_bets(user_id);
CREATE INDEX idx_parlay_bets_status ON parlay_bets(status);
CREATE INDEX idx_parlay_bets_created_at ON parlay_bets(created_at DESC);

CREATE TABLE IF NOT EXISTS parlay_legs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parlay_id UUID NOT NULL REFERENCES parlay_bets(id) ON DELETE CASCADE,
    selection_id UUID NOT NULL REFERENCES selections(id),
    odds_at_placement DECIMAL(8, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void')),
    leg_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_parlay_legs_parlay_id ON parlay_legs(parlay_id);
CREATE INDEX idx_parlay_legs_selection_id ON parlay_legs(selection_id);
CREATE INDEX idx_parlay_legs_status ON parlay_legs(status);
