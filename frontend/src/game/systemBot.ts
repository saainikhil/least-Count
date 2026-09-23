import { GameEngine, getCardValue, scoreHand } from './engine';
import { Card } from '../types/game';

export function runBotTurn(engine: GameEngine, botId: string): void {
  if (engine.activePlayerId !== botId || engine.phase === 'ROUND_COMPLETE' || engine.phase === 'GAME_COMPLETE') {
    return;
  }

  const botHand = engine.hands.get(botId) || [];
  const currentScore = scoreHand(botHand, engine.jokerRank);

  // 1. Check Least Count
  if (engine.phase === 'SELECTING_DROP' && currentScore <= 5) {
    try {
      engine.leastCount(botId);
      return;
    } catch {
      // ignore
    }
  }

  // 2. Drop Phase
  if (engine.phase === 'SELECTING_DROP') {
    const topDiscard = engine.discardPile.at(-1);

    // Group cards by rank
    const rankGroups = new Map<string, Card[]>();
    for (const card of botHand) {
      const existing = rankGroups.get(card.rank) || [];
      rankGroups.set(card.rank, [...existing, card]);
    }

    let cardsToDrop: Card[] = [];

    // Check if any rank group matches top discard
    if (topDiscard && rankGroups.has(topDiscard.rank)) {
      cardsToDrop = rankGroups.get(topDiscard.rank)!;
    } else {
      // Find rank group with highest total point value
      let maxGroupValue = -1;
      for (const [, group] of rankGroups.entries()) {
        const groupVal = group.reduce((sum, c) => sum + getCardValue(c, engine.jokerRank), 0);
        if (groupVal > maxGroupValue) {
          maxGroupValue = groupVal;
          cardsToDrop = group;
        }
      }
    }

    if (cardsToDrop.length > 0) {
      engine.drop(botId, cardsToDrop.map(c => c.id));
    }
  }

  // 3. Acquire Phase (if non-matching drop)
  if (engine.phase === 'WAITING_FOR_DRAW' && engine.activePlayerId === botId) {
    const pending = engine.pendingPick;

    // Pick top discard if it's a Joker (0 pts) or value <= 3
    if (pending && getCardValue(pending, engine.jokerRank) <= 3) {
      engine.acquire(botId, 'pick');
    } else {
      engine.acquire(botId, 'draw');
    }
  }
}
