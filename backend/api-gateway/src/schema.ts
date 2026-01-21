export const typeDefs = `#graphql
  enum Sport {
    football
    basketball
    tennis
    horse_racing
  }

  enum EventStatus {
    upcoming
    live
    finished
    cancelled
  }

  enum MarketStatus {
    open
    suspended
    closed
    settled
  }

  enum BetStatus {
    pending
    won
    lost
    void
    cashed_out
  }

  enum ParlayStatus {
    pending
    won
    lost
    partially_void
    void
  }

  enum ParlayLegStatus {
    pending
    won
    lost
    void
  }

  type User {
    id: ID!
    email: String!
    username: String!
    createdAt: String!
  }

  type AuthPayload {
    user: User!
    accessToken: String!
    refreshToken: String!
  }

  type Wallet {
    id: ID!
    userId: ID!
    balance: Float!
    currency: String!
    createdAt: String!
  }

  type Transaction {
    id: ID!
    walletId: ID!
    type: String!
    amount: Float!
    reference: String
    createdAt: String!
  }

  type Selection {
    id: ID!
    marketId: ID!
    name: String!
    odds: Float!
  }

  type Market {
    id: ID!
    eventId: ID!
    name: String!
    type: String!
    status: MarketStatus!
    selections: [Selection!]!
  }

  type Event {
    id: ID!
    sport: Sport!
    name: String!
    homeTeam: String
    awayTeam: String
    startTime: String!
    status: EventStatus!
    createdAt: String!
    markets: [Market!]!
  }

  type Bet {
    id: ID!
    userId: ID!
    selectionId: ID!
    stake: Float!
    oddsAtPlacement: Float!
    status: BetStatus!
    potentialPayout: Float!
    createdAt: String!
    selection: Selection
    market: Market
    event: Event
  }

  type OddsUpdate {
    eventId: ID!
    selectionId: ID!
    oldOdds: Float!
    newOdds: Float!
    timestamp: String!
  }

  type ParlayLeg {
    id: ID!
    parlayId: ID!
    selectionId: ID!
    oddsAtPlacement: Float!
    status: ParlayLegStatus!
    legNumber: Int!
    createdAt: String!
    selection: Selection!
    market: Market!
    event: Event!
  }

  type ParlayBet {
    id: ID!
    userId: ID!
    totalStake: Float!
    combinedOdds: Float!
    potentialPayout: Float!
    status: ParlayStatus!
    settledAt: String
    createdAt: String!
    legs: [ParlayLeg!]!
  }

  input RegisterInput {
    email: String!
    username: String!
    password: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input PlaceBetInput {
    selectionId: ID!
    stake: Float!
  }

  input ParlaySelectionInput {
    selectionId: ID!
  }

  input PlaceParlayInput {
    selections: [ParlaySelectionInput!]!
    stake: Float!
  }

  type Query {
    # User
    me: User

    # Events
    events(sport: Sport, status: EventStatus, limit: Int, offset: Int): [Event!]!
    event(id: ID!): Event

    # Bets
    myBets(status: BetStatus, limit: Int, offset: Int): [Bet!]!
    bet(id: ID!): Bet

    # Parlays
    myParlays(status: ParlayStatus, limit: Int, offset: Int): [ParlayBet!]!
    parlay(id: ID!): ParlayBet

    # Wallet
    wallet: Wallet
    transactions(limit: Int, offset: Int): [Transaction!]!
  }

  type Mutation {
    # Auth
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    refreshToken(refreshToken: String!): String!

    # Betting
    placeBet(input: PlaceBetInput!): Bet!
    placeParlay(input: PlaceParlayInput!): ParlayBet!

    # Wallet
    deposit(amount: Float!): Wallet!
    withdraw(amount: Float!): Wallet!
  }

  type Subscription {
    oddsUpdated(eventId: ID!): OddsUpdate!
  }
`;
