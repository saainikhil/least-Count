import { useEffect, useRef } from 'react';
import { ClientGameState } from '../types/game';
import { soundManager } from '../services/soundManager';

export interface GameSoundStateSnapshot {
  prevActivePlayer?: string;
  prevPhase?: string;
  prevSetupStage?: string;
  prevDiscardLength: number;
  prevDrawPileCount: number;
  lastShuffleRound: number;
  lastResultKey: string;
}

export function handleGameSoundTransitions(
  myPlayerId: string,
  gameState: ClientGameState['game'] | null | undefined,
  currentRound: number,
  snapshot: GameSoundStateSnapshot
): GameSoundStateSnapshot {
  if (!gameState) {
    return {
      prevActivePlayer: undefined,
      prevPhase: undefined,
      prevSetupStage: undefined,
      prevDiscardLength: 0,
      prevDrawPileCount: 0,
      lastShuffleRound: snapshot.lastShuffleRound,
      lastResultKey: snapshot.lastResultKey,
    };
  }

  const {
    phase,
    setupStage,
    activePlayerId,
    completedRoundScores = [],
    discardPile = [],
    drawPileCount = 0,
  } = gameState;

  let lastShuffleRound = snapshot.lastShuffleRound;
  let lastResultKey = snapshot.lastResultKey;

  // 1. Shuffle & Distribution Sound
  // Trigger when setup stage moves past SETUP_SHUFFLE
  if (
    snapshot.prevSetupStage === 'SETUP_SHUFFLE' &&
    setupStage &&
    setupStage !== 'SETUP_SHUFFLE' &&
    lastShuffleRound !== currentRound
  ) {
    lastShuffleRound = currentRound;
    soundManager.playShuffle();
  }

  // 2. Automatic Deck Recycling Sound
  // Trigger when draw pile was empty and discard pile was recycled into it
  if (
    snapshot.prevDrawPileCount === 0 &&
    drawPileCount > 0 &&
    snapshot.prevDiscardLength > 1 &&
    discardPile.length === 1
  ) {
    soundManager.playShuffle();
  }

  // 3. Opponent Action Sounds (Restrained volume)
  const isLocalPlayer =
    snapshot.prevActivePlayer === myPlayerId ||
    snapshot.prevActivePlayer === 'human-player';

  if (snapshot.prevActivePlayer && !isLocalPlayer) {
    // Opponent dropped cards
    if (
      snapshot.prevPhase === 'SELECTING_DROP' &&
      discardPile.length > snapshot.prevDiscardLength
    ) {
      soundManager.playCardDrop(true);
    }

    // Opponent drew or picked a card
    if (
      snapshot.prevPhase === 'WAITING_FOR_DRAW' &&
      (phase === 'TURN_COMPLETE' || phase === 'SELECTING_DROP')
    ) {
      soundManager.playCardDraw(true);
    }
  }

  // 4. Confirmed Win / Loss Sounds
  if ((phase === 'ROUND_COMPLETE' || phase === 'GAME_COMPLETE') && completedRoundScores.length > 0) {
    const resultKey = `${phase}-round-${currentRound}-scores-${completedRoundScores.length}`;

    if (lastResultKey !== resultKey) {
      lastResultKey = resultKey;

      if (phase === 'GAME_COMPLETE') {
        const cumulativeTotals: Record<string, number> = {};
        for (const round of completedRoundScores) {
          for (const [pId, score] of Object.entries(round)) {
            cumulativeTotals[pId] = (cumulativeTotals[pId] || 0) + score;
          }
        }

        const scores = Object.values(cumulativeTotals);
        const minScore = scores.length > 0 ? Math.min(...scores) : 0;
        const myScore = cumulativeTotals[myPlayerId] ?? cumulativeTotals['human-player'] ?? Infinity;

        if (myScore === minScore) {
          soundManager.playWin();
        } else {
          soundManager.playLose();
        }
      } else {
        // ROUND_COMPLETE
        const latestRound = completedRoundScores[completedRoundScores.length - 1];
        if (latestRound) {
          const scores = Object.values(latestRound);
          const minScore = scores.length > 0 ? Math.min(...scores) : 0;
          const myScore = latestRound[myPlayerId] ?? latestRound['human-player'] ?? Infinity;

          if (myScore === minScore) {
            soundManager.playWin();
          } else {
            soundManager.playLose();
          }
        }
      }
    }
  }

  return {
    prevActivePlayer: activePlayerId,
    prevPhase: phase,
    prevSetupStage: setupStage,
    prevDiscardLength: discardPile.length,
    prevDrawPileCount: drawPileCount,
    lastShuffleRound,
    lastResultKey,
  };
}

interface UseGameSoundsOptions {
  myPlayerId: string;
  gameState: ClientGameState['game'] | null | undefined;
  currentRound: number;
}

export function useGameSounds({ myPlayerId, gameState, currentRound }: UseGameSoundsOptions) {
  const snapshotRef = useRef<GameSoundStateSnapshot>({
    prevDiscardLength: 0,
    prevDrawPileCount: 0,
    lastShuffleRound: -1,
    lastResultKey: '',
  });

  useEffect(() => {
    snapshotRef.current = handleGameSoundTransitions(
      myPlayerId,
      gameState,
      currentRound,
      snapshotRef.current
    );
  }, [gameState, myPlayerId, currentRound]);
}
