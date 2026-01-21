import { gql } from '@apollo/client';

export const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      user {
        id
        email
        username
        createdAt
      }
      accessToken
      refreshToken
    }
  }
`;

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      user {
        id
        email
        username
        createdAt
      }
      accessToken
      refreshToken
    }
  }
`;

export const PLACE_BET = gql`
  mutation PlaceBet($input: PlaceBetInput!) {
    placeBet(input: $input) {
      id
      userId
      selectionId
      stake
      oddsAtPlacement
      status
      potentialPayout
      createdAt
    }
  }
`;

export const DEPOSIT = gql`
  mutation Deposit($amount: Float!) {
    deposit(amount: $amount) {
      id
      userId
      balance
      currency
      createdAt
    }
  }
`;

export const WITHDRAW = gql`
  mutation Withdraw($amount: Float!) {
    withdraw(amount: $amount) {
      id
      userId
      balance
      currency
      createdAt
    }
  }
`;

export const PLACE_PARLAY = gql`
  mutation PlaceParlay($input: PlaceParlayInput!) {
    placeParlay(input: $input) {
      id
      userId
      totalStake
      combinedOdds
      potentialPayout
      status
      createdAt
    }
  }
`;
