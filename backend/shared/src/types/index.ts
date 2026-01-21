export interface User {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  created_at: Date;
}

export interface UserDTO {
  id: string;
  email: string;
  username: string;
  created_at: Date;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserDTO;
  accessToken: string;
  refreshToken: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  created_at: Date;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  type: 'deposit' | 'withdraw' | 'bet_stake' | 'bet_win';
  amount: number;
  reference: string;
  created_at: Date;
}

export interface DepositRequest {
  amount: number;
}

export interface WithdrawRequest {
  amount: number;
}

export type Sport = 'football' | 'basketball' | 'tennis' | 'horse_racing';
export type EventStatus = 'upcoming' | 'live' | 'finished' | 'cancelled';
export type MarketStatus = 'open' | 'suspended' | 'closed' | 'settled';

export interface SportEvent {
  id: string;
  sport: Sport;
  name: string;
  home_team: string;
  away_team: string;
  start_time: Date;
  status: EventStatus;
  created_at: Date;
}

export interface Market {
  id: string;
  event_id: string;
  name: string;
  type: string;
  status: MarketStatus;
}

export interface Selection {
  id: string;
  market_id: string;
  name: string;
  odds: number;
}

export interface EventWithMarkets extends SportEvent {
  markets: MarketWithSelections[];
}

export interface MarketWithSelections extends Market {
  selections: Selection[];
}

export type BetStatus = 'pending' | 'won' | 'lost' | 'void' | 'cashed_out';

export interface Bet {
  id: string;
  user_id: string;
  selection_id: string;
  stake: number;
  odds_at_placement: number;
  status: BetStatus;
  potential_payout: number;
  created_at: Date;
}

export interface PlaceBetRequest {
  selection_id: string;
  stake: number;
}

export interface BetWithDetails extends Bet {
  selection: Selection;
  market: Market;
  event: SportEvent;
}

export interface BetPlacedEvent {
  type: 'BET_PLACED';
  payload: {
    bet_id: string;
    user_id: string;
    selection_id: string;
    stake: number;
    odds: number;
    timestamp: Date;
  };
}

export interface OddsUpdatedEvent {
  type: 'ODDS_UPDATED';
  payload: {
    selection_id: string;
    old_odds: number;
    new_odds: number;
    timestamp: Date;
  };
}

export interface EventStatusChangedEvent {
  type: 'EVENT_STATUS_CHANGED';
  payload: {
    event_id: string;
    old_status: EventStatus;
    new_status: EventStatus;
    timestamp: Date;
  };
}

export type QueueEvent = BetPlacedEvent | OddsUpdatedEvent | EventStatusChangedEvent;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
}
