import { gql } from '@apollo/client';

export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      username
      createdAt
    }
  }
`;

export const GET_WALLET = gql`
  query GetWallet {
    wallet {
      id
      userId
      balance
      currency
      createdAt
    }
  }
`;

export const GET_TRANSACTIONS = gql`
  query GetTransactions($limit: Int, $offset: Int) {
    transactions(limit: $limit, offset: $offset) {
      id
      walletId
      type
      amount
      reference
      createdAt
    }
  }
`;

export const GET_EVENTS = gql`
  query GetEvents($sport: Sport, $status: EventStatus, $limit: Int, $offset: Int) {
    events(sport: $sport, status: $status, limit: $limit, offset: $offset) {
      id
      sport
      name
      homeTeam
      awayTeam
      startTime
      status
      createdAt
    }
  }
`;

export const GET_EVENT = gql`
  query GetEvent($id: ID!) {
    event(id: $id) {
      id
      sport
      name
      homeTeam
      awayTeam
      startTime
      status
      createdAt
      markets {
        id
        eventId
        name
        type
        status
        selections {
          id
          marketId
          name
          odds
        }
      }
    }
  }
`;

export const GET_MY_BETS = gql`
  query GetMyBets($status: BetStatus, $limit: Int, $offset: Int) {
    myBets(status: $status, limit: $limit, offset: $offset) {
      id
      userId
      selectionId
      stake
      oddsAtPlacement
      status
      potentialPayout
      createdAt
      selection {
        id
        name
        odds
      }
      market {
        id
        name
        type
      }
      event {
        id
        name
        sport
        startTime
        status
      }
    }
  }
`;

export const GET_MY_PARLAYS = gql`
  query GetMyParlays($status: ParlayStatus, $limit: Int, $offset: Int) {
    myParlays(status: $status, limit: $limit, offset: $offset) {
      id
      userId
      totalStake
      combinedOdds
      potentialPayout
      status
      settledAt
      createdAt
      legs {
        id
        parlayId
        selectionId
        oddsAtPlacement
        status
        legNumber
        createdAt
        selection {
          id
          name
          odds
        }
        market {
          id
          name
          type
        }
        event {
          id
          name
          sport
          startTime
          status
        }
      }
    }
  }
`;
