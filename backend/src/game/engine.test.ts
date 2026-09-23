import { describe, expect, it } from 'vitest';
import {
  GameEngine,
  getCardValue,
  scoreHand,
  createDecksForPlayers,
  isValidDrop,
  Card
} from './engine.js';

describe('Least Count Game Engine - Core Rules Verification', () => {
  it('1. Card Values: A=1, 2-9 face value, 10/J/Q/K = 10', () => {
    const cardA: Card = { id: 'c1', rank: 'A', suit: 'spades', deckId: 1 };
    const card5: Card = { id: 'c2', rank: '5', suit: 'hearts', deckId: 1 };
    const card10: Card = { id: 'c3', rank: '10', suit: 'diamonds', deckId: 1 };
    const cardJ: Card = { id: 'c4', rank: 'J', suit: 'clubs', deckId: 1 };
    const cardQ: Card = { id: 'c5', rank: 'Q', suit: 'spades', deckId: 1 };
    const cardK: Card = { id: 'c6', rank: 'K', suit: 'hearts', deckId: 1 };

    expect(getCardValue(cardA)).toBe(1);
    expect(getCardValue(card5)).toBe(5);
    expect(getCardValue(card10)).toBe(10);
    expect(getCardValue(cardJ)).toBe(10);
    expect(getCardValue(cardQ)).toBe(10);
    expect(getCardValue(cardK)).toBe(10);
  });

  it('2. Joker Rule: Selected Joker rank scores 0 points', () => {
    const card6: Card = { id: 'c1', rank: '6', suit: 'spades', deckId: 1 };
    const cardJ: Card = { id: 'c2', rank: 'J', suit: 'hearts', deckId: 1 };

    expect(getCardValue(card6, '6')).toBe(0);
    expect(getCardValue(cardJ, '6')).toBe(10);
    expect(scoreHand([card6, cardJ], '6')).toBe(10);
  });

  it('3. Initial Hand & Decks: 5 cards per player, dynamic deck generation', () => {
    const engine = new GameEngine(['p1', 'p2', 'p3'], 5, '7', undefined, true);
    expect(engine.hands.get('p1')).toHaveLength(5);
    expect(engine.hands.get('p2')).toHaveLength(5);
    expect(engine.hands.get('p3')).toHaveLength(5);
    expect(engine.jokerRank).toBe('7');
    expect(engine.openCard).toBeDefined();
    expect(engine.discardPile).toHaveLength(1);

    const twoPlayerDecks = createDecksForPlayers(2);
    expect(twoPlayerDecks).toHaveLength(104); // 2 decks x 52
  });

  it('4. Multi-card Same-Rank Drop Validation', () => {
    const q1: Card = { id: '1', rank: 'Q', suit: 'spades', deckId: 1 };
    const q2: Card = { id: '2', rank: 'Q', suit: 'hearts', deckId: 1 };
    const k1: Card = { id: '3', rank: 'K', suit: 'clubs', deckId: 1 };

    expect(isValidDrop([q1, q2])).toBe(true);
    expect(isValidDrop([q1, k1])).toBe(false);
  });

  it('5. Matching Previous Drop Rule (No Pick Required)', () => {
    const engine = new GameEngine(['p1', 'p2'], 3, '5', undefined, true);
    // Set explicit hands and discard pile for test
    const p1Hand: Card[] = [
      { id: 'p1_q1', rank: 'Q', suit: 'spades', deckId: 1 },
      { id: 'p1_a', rank: 'A', suit: 'hearts', deckId: 1 },
      { id: 'p1_2', rank: '2', suit: 'diamonds', deckId: 1 },
      { id: 'p1_3', rank: '3', suit: 'clubs', deckId: 1 },
      { id: 'p1_4', rank: '4', suit: 'spades', deckId: 1 },
    ];
    const p2Hand: Card[] = [
      { id: 'p2_q2', rank: 'Q', suit: 'diamonds', deckId: 1 },
      { id: 'p2_7', rank: '7', suit: 'hearts', deckId: 1 },
      { id: 'p2_8', rank: '8', suit: 'clubs', deckId: 1 },
      { id: 'p2_9', rank: '9', suit: 'spades', deckId: 1 },
      { id: 'p2_10', rank: '10', suit: 'hearts', deckId: 1 },
    ];
    engine.hands.set('p1', p1Hand);
    engine.hands.set('p2', p2Hand);
    engine.activePlayerId = 'p1';
    engine.phase = 'SELECTING_DROP';
    // P1 drops non-matching Q -> P1 must draw
    engine.drop('p1', ['p1_q1']);
    expect(engine.phase).toBe('WAITING_FOR_DRAW');
    engine.acquire('p1', 'draw');
    expect(engine.activePlayerId).toBe('p2');

    // P2 drops matching Q -> P2 DOES NOT need to draw! Turn advances to P1 immediately
    engine.drop('p2', ['p2_q2']);
    expect(engine.activePlayerId).toBe('p1');
    expect(engine.phase).toBe('SELECTING_DROP');
  });

  it('6. Turn Direction: Always Moves Right (P1 -> P2 -> P3 -> P1)', () => {
    const engine = new GameEngine(['p1', 'p2', 'p3'], 3, '5', undefined, true);
    engine.activePlayerId = 'p1';
    engine.phase = 'SELECTING_DROP';
    expect(engine.activePlayerId).toBe('p1');

    // Make non-matching drops for p1 and p2
    engine.hands.set('p1', [{ id: '1', rank: 'A', suit: 'spades', deckId: 1 }]);
    engine.hands.set('p2', [{ id: '2', rank: '2', suit: 'spades', deckId: 1 }]);
    engine.hands.set('p3', [{ id: '3', rank: '3', suit: 'spades', deckId: 1 }]);
    engine.discardPile = [{ id: 'top', rank: 'K', suit: 'spades', deckId: 1 }];

    engine.drop('p1', ['1']);
    engine.acquire('p1', 'draw');
    expect(engine.activePlayerId).toBe('p2');

    engine.drop('p2', ['2']);
    engine.acquire('p2', 'draw');
    expect(engine.activePlayerId).toBe('p3');

    engine.drop('p3', ['3']);
    engine.acquire('p3', 'draw');
    expect(engine.activePlayerId).toBe('p1');
  });

  it('7. Least Count: Correct Lowest (0 pts), Incorrect Penalty (50 pts), Tie (Round continues)', () => {
    // Case 1: Correct Lowest Call -> Winner gets 0
    const engine1 = new GameEngine(['p1', 'p2', 'p3'], 3, 'K', undefined, true);
    engine1.hands.set('p1', [{ id: 'a1', rank: 'A', suit: 'spades', deckId: 1 }]); // score 1
    engine1.hands.set('p2', [{ id: 'a2', rank: '7', suit: 'hearts', deckId: 1 }]); // score 7
    engine1.hands.set('p3', [{ id: 'a3', rank: '9', suit: 'diamonds', deckId: 1 }]); // score 9

    engine1.activePlayerId = 'p1';
    engine1.phase = 'SELECTING_DROP';
    const res1 = engine1.leastCount('p1');
    expect(res1.success).toBe(true);
    expect(res1.scores!['p1']).toBe(0);
    expect(res1.scores!['p2']).toBe(7);
    expect(res1.scores!['p3']).toBe(9);

    // Case 2: Incorrect Call (Opponent lower) -> Penalty 50
    const engine2 = new GameEngine(['p1', 'p2', 'p3'], 3, 'K', undefined, true);
    engine2.hands.set('p1', [{ id: 'b1', rank: '4', suit: 'spades', deckId: 1 }]); // score 4
    engine2.hands.set('p2', [{ id: 'b2', rank: '2', suit: 'hearts', deckId: 1 }]); // score 2 (lower!)
    engine2.hands.set('p3', [{ id: 'b3', rank: '8', suit: 'diamonds', deckId: 1 }]); // score 8

    engine2.activePlayerId = 'p1';
    engine2.phase = 'SELECTING_DROP';
    const res2 = engine2.leastCount('p1');
    expect(res2.success).toBe(false);
    expect(res2.penalty).toBe(true);
    expect(res2.scores!['p1']).toBe(50);
    expect(res2.scores!['p2']).toBe(2);

    // Case 3: Tie for lowest -> Round does NOT end
    const engine3 = new GameEngine(['p1', 'p2', 'p3'], 3, 'K', undefined, true);
    engine3.hands.set('p1', [{ id: 'c1', rank: '3', suit: 'spades', deckId: 1 }]); // score 3
    engine3.hands.set('p2', [{ id: 'c2', rank: '3', suit: 'hearts', deckId: 1 }]); // score 3 (tie!)
    engine3.hands.set('p3', [{ id: 'c3', rank: '8', suit: 'diamonds', deckId: 1 }]); // score 8

    engine3.activePlayerId = 'p1';
    engine3.phase = 'SELECTING_DROP';
    const res3 = engine3.leastCount('p1');
    expect(res3.tie).toBe(true);
    expect(engine3.phase).toBe('SELECTING_DROP'); // round continues
  });

  it('8. Rotating Starting Player Per Round', () => {
    const engine = new GameEngine(['p1', 'p2', 'p3'], 3, '5', undefined, true);
    expect(engine.startingPlayerId).toBe('p1');

    engine.startRound(2);
    expect(engine.startingPlayerId).toBe('p2');

    engine.startRound(3);
    expect(engine.startingPlayerId).toBe('p3');

    engine.startRound(4);
    expect(engine.startingPlayerId).toBe('p1');
  });
});
