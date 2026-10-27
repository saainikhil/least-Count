import { RANKS, type Rank, type Suit, type Card, type GamePhase, type SetupStage } from '../types/game.js';
export { RANKS };
export type { Rank, Suit, Card, GamePhase, SetupStage };

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export function getCardValue(card: Card, jokerRank?: Rank): number {
  if (jokerRank && card.rank === jokerRank) return 0;
  if (card.rank === 'A') return 1;
  if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 10;
  return Number(card.rank);
}

export function scoreHand(hand: Card[], jokerRank?: Rank): number {
  return hand.reduce((sum, card) => sum + getCardValue(card, jokerRank), 0);
}

export function createDecksForPlayers(playerCount: number): Card[] {
  const decksCount = Math.max(2, Math.ceil((playerCount * 5 + 20) / 52));
  const cards: Card[] = [];
  for (let d = 1; d <= decksCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `deck${d}-${rank}-${suit}`,
          deckId: d,
          rank,
          suit,
        });
      }
    }
  }
  return cards;
}

export function shuffleDeck<T>(items: T[], rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function isValidDrop(cards: Card[]): boolean {
  if (!cards || cards.length === 0) return false;
  const firstRank = cards[0].rank;
  return cards.every(c => c.rank === firstRank);
}

export class GameEngine {
  readonly players: string[];
  readonly hands = new Map<string, Card[]>();
  playerNames = new Map<string, string>();
  setupStage: SetupStage = 'SETUP_SHUFFLE';
  setupActorId = '';
  drawPile: Card[] = [];
  discardPile: Card[] = [];
  jokerRank!: Rank;
  openCard?: Card;
  activePlayerId = '';
  startingPlayerId = '';
  roundNumber = 1;
  totalRounds = 10;
  phase: GamePhase = 'LOBBY';
  pendingPick: Card | null = null;
  completedRoundScores: Record<string, number>[] = [];
  roundNotice?: string;
  private tempDeck: Card[] = [];

  constructor(
    playerIds: string[],
    totalRounds = 10,
    customJoker?: Rank,
    playerNamesMap?: Map<string, string> | Record<string, string>,
    autoStartSetup = false
  ) {
    if (playerIds.length < 2) throw new Error('At least 2 players required');
    this.players = [...playerIds];
    this.totalRounds = Math.max(1, totalRounds);
    if (playerNamesMap) {
      this.setPlayerNames(playerNamesMap);
    }
    this.startRound(1, customJoker, autoStartSetup);
  }

  setPlayerNames(names: Map<string, string> | Record<string, string>) {
    if (names instanceof Map) {
      this.playerNames = new Map(names);
    } else if (names && typeof names === 'object') {
      this.playerNames = new Map(Object.entries(names));
    }
  }

  getPlayerName(playerId: string): string {
    return this.playerNames.get(playerId) || playerId;
  }

  startRound(roundNum: number, customJoker?: Rank, autoStartSetup = false) {
    this.roundNumber = roundNum;
    this.roundNotice = undefined;
    
    // Rotating distributor/dealer: Round 1 -> P0, Round 2 -> P1, etc.
    const startIdx = (roundNum - 1) % this.players.length;
    this.startingPlayerId = this.players[startIdx];

    // Setup starts with distributor
    this.setupStage = 'SETUP_SHUFFLE';
    this.setupActorId = this.startingPlayerId;
    this.hands.clear();
    this.drawPile = [];
    this.discardPile = [];
    this.openCard = undefined;
    this.pendingPick = null;
    this.phase = 'LOBBY';

    if (customJoker) {
      this.jokerRank = customJoker;
    } else {
      this.jokerRank = 'A';
    }

    if (autoStartSetup) {
      this.autoCompleteSetup(customJoker);
    }
  }

  autoCompleteSetup(customJoker?: Rank) {
    const dealerId = this.setupActorId;
    this.shuffleAndDistribute(dealerId);
    const actor2 = this.setupActorId;
    this.pickOpenCard(actor2);
    const actor3 = this.setupActorId;
    this.pickJokerCard(actor3, customJoker);
  }

  shuffleAndDistribute(playerId: string) {
    if (this.setupStage !== 'SETUP_SHUFFLE') {
      throw new Error('Shuffle and Distribute is not allowed in current setup stage');
    }
    if (playerId !== this.setupActorId) {
      throw new Error(`Only ${this.getPlayerName(this.setupActorId)} can shuffle and distribute cards`);
    }

    // Generate & shuffle decks (104 cards for 2+ players)
    const deckCards = shuffleDeck(createDecksForPlayers(this.players.length));

    // Deal 5 cards to each player in exact room join order
    this.hands.clear();
    for (const pId of this.players) {
      this.hands.set(pId, deckCards.splice(0, 5));
    }

    this.tempDeck = deckCards;
    this.drawPile = [...deckCards];

    // Advance to Pick Open Card setup stage for the same setup player
    this.setupStage = 'SETUP_OPEN_CARD';
    this.setupActorId = this.startingPlayerId;
  }

  pickOpenCard(playerId: string) {
    if (this.setupStage !== 'SETUP_OPEN_CARD') {
      throw new Error('Pick Open Card is not allowed in current setup stage');
    }
    if (playerId !== this.setupActorId) {
      throw new Error(`Only ${this.getPlayerName(this.setupActorId)} can pick the open card`);
    }

    const openCard = this.tempDeck.pop();
    if (!openCard) throw new Error('Failed to draw open card');
    this.openCard = openCard;
    this.discardPile = [openCard];
    this.drawPile = [...this.tempDeck];

    // Advance to Pick Joker Card setup stage for the same setup player
    this.setupStage = 'SETUP_JOKER_CARD';
    this.setupActorId = this.startingPlayerId;
  }

  pickJokerCard(playerId: string, customJoker?: Rank) {
    if (this.setupStage !== 'SETUP_JOKER_CARD') {
      throw new Error('Pick Joker Card is not allowed in current setup stage');
    }
    if (playerId !== this.setupActorId) {
      throw new Error(`Only ${this.getPlayerName(this.setupActorId)} can pick the joker card`);
    }

    if (customJoker) {
      this.jokerRank = customJoker;
    } else {
      const jokerCard = this.tempDeck.pop();
      if (!jokerCard) throw new Error('Failed to draw joker card');
      this.jokerRank = jokerCard.rank;
    }

    this.drawPile = [...this.tempDeck];

    // Setup complete! Game starts with player NEXT to the distributor in right-side turn order
    const dealerIdx = this.players.indexOf(this.startingPlayerId);
    const startTurnIdx = (dealerIdx + 1) % this.players.length;
    this.activePlayerId = this.players[startTurnIdx];
    this.setupStage = 'IN_GAME';
    this.phase = 'SELECTING_DROP';
  }

  private assertTurn(playerId: string) {
    if (playerId !== this.activePlayerId) {
      throw new Error(`It is not your turn. Current turn: ${this.activePlayerId}`);
    }
  }

  drop(playerId: string, cardIds: string[]) {
    this.assertTurn(playerId);
    if (this.phase !== 'SELECTING_DROP') {
      throw new Error('Drop is not allowed in current phase');
    }
    if (!cardIds || cardIds.length === 0) {
      throw new Error('Select at least one card to drop');
    }

    const hand = this.hands.get(playerId) || [];
    const selectedCards = cardIds.map(id => hand.find(c => c.id === id)).filter((c): c is Card => !!c);

    if (selectedCards.length !== cardIds.length) {
      throw new Error('You can only drop cards from your own hand');
    }

    if (!isValidDrop(selectedCards)) {
      throw new Error('These cards do not match. Only cards of the same rank can be dropped together');
    }

    const topDiscardBeforeDrop = this.discardPile.at(-1);

    // Remove cards from player hand
    const nextHand = hand.filter(c => !cardIds.includes(c.id));
    this.hands.set(playerId, nextHand);

    // Add selected cards to discard pile
    this.discardPile.push(...selectedCards);

    // Check matching dropped card rule against top card of discard pile prior to drop
    if (topDiscardBeforeDrop && selectedCards[0].rank === topDiscardBeforeDrop.rank) {
      // Matching drop! Turn finishes immediately, no pickup needed
      this.phase = 'TURN_COMPLETE';
      this.nextTurn();
    } else {
      // Non-matching drop -> must pick a card
      this.pendingPick = topDiscardBeforeDrop || null;
      this.phase = 'WAITING_FOR_DRAW';
    }
  }

  recycleDiscardPileIntoDrawPile(): boolean {
    if (this.drawPile.length > 0) {
      return false;
    }
    if (this.discardPile.length <= 1) {
      return false;
    }

    const topDiscard = this.discardPile[this.discardPile.length - 1];
    const recyclable = this.discardPile.slice(0, -1);
    this.discardPile = [topDiscard];
    this.drawPile = shuffleDeck(recyclable);
    return true;
  }

  acquire(playerId: string, kind: 'draw' | 'pick') {
    this.assertTurn(playerId);
    if (this.phase !== 'WAITING_FOR_DRAW') {
      throw new Error('You must drop cards before drawing/picking');
    }

    const hand = this.hands.get(playerId) || [];
    let acquiredCard: Card | undefined;

    if (kind === 'draw') {
      if (this.drawPile.length === 0) {
        this.recycleDiscardPileIntoDrawPile();
      }
      if (this.drawPile.length === 0) {
        throw new Error('No cards remaining in draw pile');
      }
      acquiredCard = this.drawPile.pop();
    } else { // pick
      if (!this.pendingPick) {
        throw new Error('No legal previously dropped card available to pick');
      }
      // Remove pendingPick from discard pile
      const index = this.discardPile.findIndex(c => c.id === this.pendingPick!.id);
      if (index >= 0) {
        this.discardPile.splice(index, 1);
      }
      acquiredCard = this.pendingPick;
      this.pendingPick = null;
    }

    if (!acquiredCard) {
      throw new Error('Failed to acquire card');
    }

    this.hands.set(playerId, [...hand, acquiredCard]);
    this.phase = 'TURN_COMPLETE';
    this.nextTurn();
  }

  nextTurn() {
    if (this.phase !== 'TURN_COMPLETE') return;

    const currentIdx = this.players.indexOf(this.activePlayerId);
    const nextIdx = (currentIdx + 1) % this.players.length;
    this.activePlayerId = this.players[nextIdx];
    this.phase = 'SELECTING_DROP';
    this.pendingPick = null;
  }

  leastCount(playerId: string) {
    this.assertTurn(playerId);
    if (this.phase !== 'SELECTING_DROP') {
      throw new Error('Least Count call is only allowed at start of your turn');
    }

    const hand = this.hands.get(playerId) || [];
    const callerScore = scoreHand(hand, this.jokerRank);

    if (callerScore > 5) {
      throw new Error(`Least Count is available only when your score is 5 or lower. Your score: ${callerScore}`);
    }

    // Calculate score for all players
    const scores: Record<string, number> = {};
    for (const pId of this.players) {
      scores[pId] = scoreHand(this.hands.get(pId) || [], this.jokerRank);
    }

    const lowestScore = Math.min(...Object.values(scores));
    const lowestPlayers = Object.entries(scores).filter(([, s]) => s === lowestScore).map(([id]) => id);

    // Case 1: Unique Lowest Score -> Winner!
    if (lowestPlayers.length === 1 && lowestPlayers[0] === playerId) {
      const roundResult: Record<string, number> = {};
      for (const pId of this.players) {
        roundResult[pId] = pId === playerId ? 0 : scores[pId];
      }
      this.completedRoundScores.push(roundResult);
      const callerName = this.getPlayerName(playerId);
      this.roundNotice = `${callerName} called Least Count (${callerScore}) and WON the round!`;

      if (this.roundNumber >= this.totalRounds) {
        this.phase = 'GAME_COMPLETE';
      } else {
        this.phase = 'ROUND_COMPLETE';
      }
      return { success: true, tie: false, scores: roundResult, winner: playerId };
    }

    // Case 2: Someone else has a strictly lower score -> Caller gets 50 Penalty!
    const possessesLowerPlayer = Object.entries(scores).some(([id, s]) => id !== playerId && s < callerScore);
    if (possessesLowerPlayer) {
      const roundResult: Record<string, number> = {};
      for (const pId of this.players) {
        roundResult[pId] = pId === playerId ? 50 : scores[pId];
      }
      this.completedRoundScores.push(roundResult);
      const callerName = this.getPlayerName(playerId);
      this.roundNotice = `${callerName} called Least Count (${callerScore}) but another player had a lower score! Penalty 50 applied.`;

      if (this.roundNumber >= this.totalRounds) {
        this.phase = 'GAME_COMPLETE';
      } else {
        this.phase = 'ROUND_COMPLETE';
      }
      return { success: false, tie: false, penalty: true, scores: roundResult };
    }

    // Case 3: Tied lowest score (callerScore === lowestScore, but another player also has lowestScore)
    // Tie state: round does NOT end, no penalty, notice shown, play continues!
    this.roundNotice = `TIE! Another player also has score ${callerScore}. Round continues!`;
    return { success: false, tie: true, scores };
  }

  // Calculate cumulative scores across all completed rounds
  getCumulativeScores(): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const pId of this.players) {
      totals[pId] = 0;
    }
    for (const roundScores of this.completedRoundScores) {
      for (const pId of this.players) {
        totals[pId] = (totals[pId] || 0) + (roundScores[pId] || 0);
      }
    }
    return totals;
  }

  toSnapshot(): SystemEngineSnapshot {
    return {
      players: [...this.players],
      hands: Array.from(this.hands.entries()),
      playerNames: Array.from(this.playerNames.entries()),
      drawPile: [...this.drawPile],
      discardPile: [...this.discardPile],
      jokerRank: this.jokerRank,
      openCard: this.openCard,
      activePlayerId: this.activePlayerId,
      startingPlayerId: this.startingPlayerId,
      setupStage: this.setupStage,
      setupActorId: this.setupActorId,
      roundNumber: this.roundNumber,
      totalRounds: this.totalRounds,
      phase: this.phase,
      pendingPick: this.pendingPick,
      completedRoundScores: [...this.completedRoundScores],
      roundNotice: this.roundNotice,
    };
  }

  static fromSnapshot(snapshot: SystemEngineSnapshot): GameEngine {
    const engine = Object.create(GameEngine.prototype);
    engine.players = [...snapshot.players];
    engine.hands = new Map(snapshot.hands);
    engine.playerNames = new Map(snapshot.playerNames);
    engine.drawPile = [...snapshot.drawPile];
    engine.discardPile = [...snapshot.discardPile];
    engine.jokerRank = snapshot.jokerRank;
    engine.openCard = snapshot.openCard;
    engine.activePlayerId = snapshot.activePlayerId;
    engine.startingPlayerId = snapshot.startingPlayerId;
    engine.setupStage = snapshot.setupStage;
    engine.setupActorId = snapshot.setupActorId;
    engine.roundNumber = snapshot.roundNumber;
    engine.totalRounds = snapshot.totalRounds;
    engine.phase = snapshot.phase;
    engine.pendingPick = snapshot.pendingPick;
    engine.completedRoundScores = [...snapshot.completedRoundScores];
    engine.roundNotice = snapshot.roundNotice;
    engine.tempDeck = [];
    return engine;
  }
}

export interface SystemEngineSnapshot {
  players: string[];
  hands: Array<[string, Card[]]>;
  playerNames: Array<[string, string]>;
  drawPile: Card[];
  discardPile: Card[];
  jokerRank: Rank;
  openCard?: Card;
  activePlayerId: string;
  startingPlayerId: string;
  setupStage: SetupStage;
  setupActorId: string;
  roundNumber: number;
  totalRounds: number;
  phase: GamePhase;
  pendingPick: Card | null;
  completedRoundScores: Record<string, number>[];
  roundNotice?: string;
}
