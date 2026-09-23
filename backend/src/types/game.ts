export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = typeof RANKS[number];

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  deckId: number;
}

export type SetupStage =
  | 'SETUP_SHUFFLE'
  | 'SETUP_OPEN_CARD'
  | 'SETUP_JOKER_CARD'
  | 'IN_GAME';

export type GamePhase =
  | 'LOBBY'
  | 'SELECTING_DROP'
  | 'WAITING_FOR_DRAW'
  | 'TURN_COMPLETE'
  | 'ROUND_COMPLETE'
  | 'GAME_COMPLETE';

export interface PlayerInfo {
  id: string;
  socketId?: string;
  name: string;
  ready: boolean;
  connected?: boolean;
}

export interface PlayerPublicState {
  id: string;
  name: string;
  cardCount: number;
}

export interface ClientGameState {
  roomCode: string;
  hostId: string;
  expectedPlayers: number;
  totalRounds: number;
  currentRound: number;
  status: 'WAITING_FOR_PLAYERS' | 'LOBBY' | 'IN_GAME' | 'FINISHED';
  players: PlayerInfo[];
  
  // Active round state (only present when IN_GAME)
  game?: {
    setupStage?: SetupStage;
    setupActorId?: string;
    phase: GamePhase;
    activePlayerId: string;
    startingPlayerId: string;
    jokerRank: Rank;
    openCard?: Card;
    discardTop?: Card;
    discardPile: Card[];
    drawPileCount: number;
    myHand: Card[];
    opponents: PlayerPublicState[];
    completedRoundScores: Record<string, number>[];
    roundNotice?: string;
  };
}

