import { describe, expect, it } from 'vitest';
import { GameEngine, getCardValue, scoreHand } from './engine';

describe('Frontend Core Engine Exports', () => {
  it('correctly scores cards and hands in frontend', () => {
    expect(getCardValue({ id: '1', rank: 'A', suit: 'spades', deckId: 1 })).toBe(1);
    expect(getCardValue({ id: '2', rank: 'J', suit: 'hearts', deckId: 1 })).toBe(10);
  });

  it('can initialize engine for system bot mode', () => {
    const engine = new GameEngine(['Player', 'System Bot'], 5, 'J');
    expect(engine.players).toEqual(['Player', 'System Bot']);
    expect(engine.jokerRank).toBe('J');
  });
});
