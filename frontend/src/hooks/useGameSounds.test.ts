import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleGameSoundTransitions, GameSoundStateSnapshot } from './useGameSounds';
import { soundManager } from '../services/soundManager';
import { ClientGameState } from '../types/game';

describe('handleGameSoundTransitions', () => {
  beforeEach(() => {
    soundManager.setSoundEnabled(true);
    vi.restoreAllMocks();
  });

  const createInitialSnapshot = (): GameSoundStateSnapshot => ({
    prevDiscardLength: 1,
    prevDrawPileCount: 94,
    lastShuffleRound: -1,
    lastResultKey: '',
  });

  const baseGameState: NonNullable<ClientGameState['game']> = {
    setupStage: 'SETUP_SHUFFLE',
    setupActorId: 'p1',
    phase: 'LOBBY',
    activePlayerId: 'p1',
    startingPlayerId: 'p1',
    jokerRank: 'A',
    discardPile: [{ id: 'd1', rank: '7', suit: 'hearts', deckId: 1 }],
    drawPileCount: 94,
    myHand: [],
    opponents: [{ id: 'p2', name: 'Player 2', cardCount: 5 }],
    completedRoundScores: [],
  };

  it('plays shuffle sound when setup completes shuffle and distribute, and does not duplicate on repeated updates', () => {
    const shuffleSpy = vi.spyOn(soundManager, 'playShuffle').mockImplementation(() => { });

    // Initial state: SETUP_SHUFFLE
    let snapshot = handleGameSoundTransitions('p1', baseGameState, 1, createInitialSnapshot());
    expect(shuffleSpy).not.toHaveBeenCalled();

    // Transition to SETUP_OPEN_CARD
    const stage2State = { ...baseGameState, setupStage: 'SETUP_OPEN_CARD' as const };
    snapshot = handleGameSoundTransitions('p1', stage2State, 1, snapshot);
    expect(shuffleSpy).toHaveBeenCalledTimes(1);

    // Repeated identical state transitions must NOT re-play shuffle
    snapshot = handleGameSoundTransitions('p1', stage2State, 1, snapshot);
    snapshot = handleGameSoundTransitions('p1', stage2State, 1, snapshot);
    expect(shuffleSpy).toHaveBeenCalledTimes(1);
  });

  it('plays win sound for confirmed round winner once, and does not duplicate', () => {
    const winSpy = vi.spyOn(soundManager, 'playWin').mockImplementation(() => { });
    const loseSpy = vi.spyOn(soundManager, 'playLose').mockImplementation(() => { });

    const playingState = { ...baseGameState, setupStage: 'IN_GAME' as const, phase: 'SELECTING_DROP' as const };
    let snapshot = handleGameSoundTransitions('p1', playingState, 1, createInitialSnapshot());

    // Round completes: p1 has score 0 (winner), p2 has score 15
    const roundCompleteState = {
      ...playingState,
      phase: 'ROUND_COMPLETE' as const,
      completedRoundScores: [{ p1: 0, p2: 15 }],
    };

    snapshot = handleGameSoundTransitions('p1', roundCompleteState, 1, snapshot);
    expect(winSpy).toHaveBeenCalledTimes(1);
    expect(loseSpy).not.toHaveBeenCalled();

    // Repeated state calls must NOT re-play
    snapshot = handleGameSoundTransitions('p1', roundCompleteState, 1, snapshot);
    expect(winSpy).toHaveBeenCalledTimes(1);
  });

  it('plays lose sound for confirmed round loser once', () => {
    const winSpy = vi.spyOn(soundManager, 'playWin').mockImplementation(() => { });
    const loseSpy = vi.spyOn(soundManager, 'playLose').mockImplementation(() => { });

    const playingState = { ...baseGameState, setupStage: 'IN_GAME' as const, phase: 'SELECTING_DROP' as const };
    let snapshot = handleGameSoundTransitions('p1', playingState, 1, createInitialSnapshot());

    // Round completes: p2 has score 0 (winner), p1 has score 20 (loser)
    const roundCompleteState = {
      ...playingState,
      phase: 'ROUND_COMPLETE' as const,
      completedRoundScores: [{ p1: 20, p2: 0 }],
    };

    snapshot = handleGameSoundTransitions('p1', roundCompleteState, 1, snapshot);
    expect(loseSpy).toHaveBeenCalledTimes(1);
    expect(winSpy).not.toHaveBeenCalled();

    // Repeated updates must not replay
    snapshot = handleGameSoundTransitions('p1', roundCompleteState, 1, snapshot);
    expect(loseSpy).toHaveBeenCalledTimes(1);
  });

  it('plays win sound for game winner and lose sound for game loser on GAME_COMPLETE', () => {
    const winSpy = vi.spyOn(soundManager, 'playWin').mockImplementation(() => { });
    const loseSpy = vi.spyOn(soundManager, 'playLose').mockImplementation(() => { });

    const gameCompleteWinner = {
      ...baseGameState,
      setupStage: 'IN_GAME' as const,
      phase: 'GAME_COMPLETE' as const,
      completedRoundScores: [
        { p1: 0, p2: 10 },
        { p1: 5, p2: 12 },
      ],
    };

    // p1 total is 5, p2 total is 22 -> p1 wins!
    handleGameSoundTransitions('p1', gameCompleteWinner, 2, createInitialSnapshot());
    expect(winSpy).toHaveBeenCalledTimes(1);
    expect(loseSpy).not.toHaveBeenCalled();

    winSpy.mockClear();
    loseSpy.mockClear();

    // p2 perspective -> p2 loses!
    handleGameSoundTransitions('p2', gameCompleteWinner, 2, createInitialSnapshot());
    expect(loseSpy).toHaveBeenCalledTimes(1);
    expect(winSpy).not.toHaveBeenCalled();
  });

  it('does NOT play win or lose sound on tie (round continues in SELECTING_DROP)', () => {
    const winSpy = vi.spyOn(soundManager, 'playWin').mockImplementation(() => { });
    const loseSpy = vi.spyOn(soundManager, 'playLose').mockImplementation(() => { });

    const playingState = { ...baseGameState, setupStage: 'IN_GAME' as const, phase: 'SELECTING_DROP' as const };
    let snapshot = handleGameSoundTransitions('p1', playingState, 1, createInitialSnapshot());

    // Tie occurs: notice updated, but phase remains SELECTING_DROP and completedRoundScores is empty
    const tieState = {
      ...playingState,
      roundNotice: 'TIE! Another player also has score 4. Round continues!',
    };

    snapshot = handleGameSoundTransitions('p1', tieState, 1, snapshot);
    expect(winSpy).not.toHaveBeenCalled();
    expect(loseSpy).not.toHaveBeenCalled();
  });

  it('plays shuffle sound when deck recycling occurs', () => {
    const shuffleSpy = vi.spyOn(soundManager, 'playShuffle').mockImplementation(() => { });

    const emptyDrawState = {
      ...baseGameState,
      setupStage: 'IN_GAME' as const,
      phase: 'WAITING_FOR_DRAW' as const,
      drawPileCount: 0,
      discardPile: [
        { id: 'c1', rank: '2' as const, suit: 'hearts' as const, deckId: 1 },
        { id: 'c2', rank: '3' as const, suit: 'spades' as const, deckId: 1 },
        { id: 'c3', rank: '4' as const, suit: 'clubs' as const, deckId: 1 },
      ],
    };

    let snapshot = handleGameSoundTransitions('p1', emptyDrawState, 1, {
      ...createInitialSnapshot(),
      prevDrawPileCount: 0,
      prevDiscardLength: 3,
    });

    expect(shuffleSpy).not.toHaveBeenCalled();

    // Discard recycled: discard becomes 1 card, draw pile restored to 2
    const recycledState = {
      ...emptyDrawState,
      drawPileCount: 2,
      discardPile: [{ id: 'c3', rank: '4' as const, suit: 'clubs' as const, deckId: 1 }],
      phase: 'TURN_COMPLETE' as const,
    };

    snapshot = handleGameSoundTransitions('p1', recycledState, 1, snapshot);
    expect(shuffleSpy).toHaveBeenCalledTimes(1);
  });

  it('plays restrained subtle card drop sound when opponent drops cards', () => {
    const dropSpy = vi.spyOn(soundManager, 'playCardDrop').mockImplementation(() => { });

    const opponentTurnState = {
      ...baseGameState,
      setupStage: 'IN_GAME' as const,
      phase: 'SELECTING_DROP' as const,
      activePlayerId: 'p2', // opponent
      discardPile: [{ id: 'c1', rank: '2' as const, suit: 'hearts' as const, deckId: 1 }],
    };

    let snapshot = handleGameSoundTransitions('p1', opponentTurnState, 1, createInitialSnapshot());

    // Opponent drops cards: discard pile length increases to 2
    const opponentDroppedState = {
      ...opponentTurnState,
      discardPile: [
        { id: 'c1', rank: '2' as const, suit: 'hearts' as const, deckId: 1 },
        { id: 'c2', rank: '8' as const, suit: 'spades' as const, deckId: 1 },
      ],
      phase: 'WAITING_FOR_DRAW' as const,
    };

    snapshot = handleGameSoundTransitions('p1', opponentDroppedState, 1, snapshot);
    expect(dropSpy).toHaveBeenCalledWith(true);
  });
});
