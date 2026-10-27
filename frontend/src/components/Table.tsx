import React, { useState, useEffect } from 'react';
import { Card as CardType, ClientGameState, PlayerPublicState, PlayerInfo } from '../types/game';
import { Card } from './Card';
import { scoreHand } from '../game/engine';
import { soundManager } from '../services/soundManager';

interface TableProps {
  myPlayerId: string;
  gameState: NonNullable<ClientGameState['game']>;
  totalRounds: number;
  currentRound: number;
  roomCode?: string;
  noticeMessage?: string;
  roomPlayers?: PlayerInfo[];
  onDrop: (cardIds: string[]) => void;
  onAcquire: (kind: 'draw' | 'pick') => void;
  onLeastCount: () => void;
  onShowScores: () => void;
  onSetupShuffle?: () => void;
  onSetupOpenCard?: () => void;
  onSetupJokerCard?: () => void;
  onExit?: () => void;
}

export const Table: React.FC<TableProps> = ({
  myPlayerId,
  gameState,
  totalRounds,
  currentRound,
  roomCode,
  noticeMessage,
  roomPlayers,
  onDrop,
  onAcquire,
  onLeastCount,
  onShowScores,
  onSetupShuffle,
  onSetupOpenCard,
  onSetupJokerCard,
  onExit,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dragOverDiscard, setDragOverDiscard] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showDevScore, setShowDevScore] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showPlayerOrderMenu, setShowPlayerOrderMenu] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isSoundEnabled());

  useEffect(() => {
    return soundManager.subscribe(setSoundEnabled);
  }, []);

  const currentPid = (myPlayerId || sessionStorage.getItem('lc_player_id') || '').trim();
  const currentDisplayName = (sessionStorage.getItem('lc_display_name') || '').trim();

  // Find 'me' player in room
  const meInRoom = roomPlayers?.find(
    p =>
      (currentPid !== '' && (p.id === currentPid || (p as any).socketId === currentPid)) ||
      (currentDisplayName !== '' && p.name.trim().toLowerCase() === currentDisplayName.toLowerCase())
  );

  const activeId = gameState.activePlayerId;
  const startingId = gameState.startingPlayerId;

  const isMyTurn =
    activeId === myPlayerId ||
    (currentPid !== '' && activeId === currentPid) ||
    (meInRoom ? activeId === meInRoom.id || activeId === (meInRoom as any).socketId : false) ||
    (myPlayerId === 'human-player' && activeId === 'human-player');

  const isMyDealer =
    startingId === myPlayerId ||
    (currentPid !== '' && startingId === currentPid) ||
    (meInRoom ? startingId === meInRoom.id || startingId === (meInRoom as any).socketId : false) ||
    (myPlayerId === 'human-player' && startingId === 'human-player');

  const myHandScore = scoreHand(gameState.myHand, gameState.jokerRank);
  const canCallLeastCount = isMyTurn && gameState.phase === 'SELECTING_DROP' && myHandScore <= 5;
  const isSetupActive = gameState.setupStage && gameState.setupStage !== 'IN_GAME';

  const setupId = gameState.setupActorId;
  const isSetupActor =
    setupId === myPlayerId ||
    (currentPid !== '' && setupId === currentPid) ||
    (meInRoom ? setupId === meInRoom.id || setupId === (meInRoom as any).socketId : false) ||
    (myPlayerId === 'human-player' && setupId === 'human-player');

  // Construct all players list in join order
  const allPlayersInJoinOrder = roomPlayers && roomPlayers.length > 0
    ? roomPlayers
    : [
        { id: myPlayerId, name: 'You', ready: true },
        ...gameState.opponents.map(o => ({ id: o.id, name: o.name, ready: true })),
      ];

  const getActorName = (actorId?: string): string => {
    if (!actorId) return 'Player';
    if (actorId === myPlayerId) return 'You';
    const found = allPlayersInJoinOrder.find(p => p.id === actorId);
    return found ? found.name : 'Player';
  };

  // Discard pile visual deduplication: show ONLY ONE top representative card of current rank,
  // and show the previous top card of a DIFFERENT rank underneath it.
  const discardPile = gameState.discardPile || [];
  const topCard = gameState.discardTop || discardPile.at(-1);

  let prevCard: CardType | undefined = undefined;
  if (topCard && discardPile.length > 1) {
    for (let i = discardPile.length - 2; i >= 0; i--) {
      if (discardPile[i].rank !== topCard.rank) {
        prevCard = discardPile[i];
        break;
      }
    }
  }

  const formatNoticeText = (text?: string): string => {
    if (!text) return '';
    let result = text;
    if (myPlayerId && result.includes(myPlayerId)) {
      result = result.split(myPlayerId).join('You');
    }
    for (const o of gameState.opponents) {
      if (o.id && o.name && result.includes(o.id)) {
        result = result.split(o.id).join(o.name);
      }
    }
    return result;
  };

  const getOpponentStyle = (index: number, totalOpponents: number): React.CSSProperties => {
    if (totalOpponents <= 1) {
      return {};
    }
    const angleRad = Math.PI - (index * Math.PI) / (totalOpponents - 1);
    const rx = 38;
    const ry = 22;
    const centerX = 50;
    const centerY = 28;

    const left = centerX + rx * Math.cos(angleRad);
    const top = centerY - ry * Math.sin(angleRad);

    return {
      position: 'absolute',
      left: `${left}%`,
      top: `${top}%`,
      transform: 'translate(-50%, -50%)',
      zIndex: 10,
    };
  };

  const toggleSelectCard = (cardId: string) => {
    if (!isMyTurn || isSetupActive) return;
    setSelectedIds(prev => {
      const willSelect = !prev.includes(cardId);
      if (willSelect) {
        soundManager.playCardSelect();
      }
      return willSelect ? [...prev, cardId] : prev.filter(id => id !== cardId);
    });
  };

  const handleDropClick = () => {
    if (!selectedIds.length || isSetupActive) return;
    onDrop(selectedIds);
    setSelectedIds([]);
  };

  const handleDragStartCard = (e: React.DragEvent, cardId: string) => {
    if (!isMyTurn || isSetupActive) return;
    const cardsToDrag = selectedIds.includes(cardId) ? selectedIds : [cardId];
    if (!selectedIds.includes(cardId)) {
      setSelectedIds([cardId]);
      soundManager.playCardSelect();
    }
    e.dataTransfer.setData('application/json', JSON.stringify({ cardIds: cardsToDrag }));
  };

  const handleDragOverDiscard = (e: React.DragEvent) => {
    e.preventDefault();
    if (isMyTurn && gameState.phase === 'SELECTING_DROP' && !isSetupActive) {
      setDragOverDiscard(true);
    }
  };

  const handleDragLeaveDiscard = () => {
    setDragOverDiscard(false);
  };

  const handleDropDiscardZone = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDiscard(false);
    if (!isMyTurn || gameState.phase !== 'SELECTING_DROP' || isSetupActive) return;

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (dataStr) {
        const parsed = JSON.parse(dataStr);
        if (parsed.cardIds && Array.isArray(parsed.cardIds)) {
          onDrop(parsed.cardIds);
          setSelectedIds([]);
        }
      }
    } catch {
      if (selectedIds.length > 0) {
        onDrop(selectedIds);
        setSelectedIds([]);
      }
    }
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="table-container">
      {/* Top Navbar */}
      <header className="topbar">
        <div
          className="topbar-left clickable-brand"
          onClick={onExit}
          title="Return to Main Menu"
          style={{ cursor: onExit ? 'pointer' : 'default' }}
        >
          <span className="brand-logo">LC</span>
          <span className="brand-title">LEAST COUNT</span>
          {roomCode && (
            <button
              className="room-code-badge"
              onClick={e => {
                e.stopPropagation();
                copyRoomLink();
              }}
              title="Click to copy invite link"
            >
              {copiedLink ? '✓ LINK COPIED!' : `ROOM: ${roomCode}`}
            </button>
          )}
        </div>

        <div className="topbar-center">
          <div className="round-badge">
            ROUND <span>{currentRound}</span> / {totalRounds}
          </div>

          {/* Player Order Dropdown Button */}
          <div className="player-order-wrapper">
            <button
              className={`score-button player-order-toggle ${showPlayerOrderMenu ? 'active' : ''}`}
              onClick={() => setShowPlayerOrderMenu(prev => !prev)}
              title="Player Order"
            >
              📋 PLAYER ORDER
            </button>
            {showPlayerOrderMenu && (
              <div className="player-order-popover">
                <div className="player-order-header">ROOM JOIN ORDER</div>
                <div className="player-order-list">
                  {allPlayersInJoinOrder.map((p, index) => {
                    const isDistributor = p.id === gameState.startingPlayerId;
                    return (
                      <div
                        key={p.id}
                        className={`player-order-item ${isDistributor ? 'dealer-red-neon' : ''}`}
                      >
                        <span className="order-number">{index + 1}.</span>
                        <span className="player-order-name">
                          {p.name} {p.id === myPlayerId ? '(YOU)' : ''}
                        </span>
                        {isDistributor && (
                          <span className="dealer-neon-badge">★ DISTRIBUTOR</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="topbar-right">
          <div className="dev-settings-wrapper">
            <button
              className={`score-button dev-settings-toggle ${showSettingsMenu ? 'active' : ''}`}
              onClick={() => setShowSettingsMenu(prev => !prev)}
              title="Settings"
            >
              ⚙️ SETTINGS
            </button>
            {showSettingsMenu && (
              <div className="dev-settings-popover">
                <div className="dev-settings-header">SETTINGS</div>
                <label className="dev-setting-option">
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={e => soundManager.setSoundEnabled(e.target.checked)}
                  />
                  <span>SOUND EFFECTS: {soundEnabled ? 'ON' : 'OFF'}</span>
                </label>
                <label className="dev-setting-option">
                  <input
                    type="checkbox"
                    checked={showDevScore}
                    onChange={e => setShowDevScore(e.target.checked)}
                  />
                  <span>SHOW CURRENT SCORE</span>
                </label>
                {onExit && (
                  <div className="settings-exit-wrapper">
                    <button className="exit-button-red" onClick={onExit}>
                      🚪 EXIT GAME
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <button className="score-button" onClick={onShowScores}>
            📊 SHOW SCORES
          </button>
        </div>
      </header>

      {/* Main Felt Play Area */}
      <section className={`felt ${gameState.opponents.length > 1 ? 'radial-felt' : ''}`}>
        {/* Opponents Area */}
        <div className={`opponents-container ${gameState.opponents.length > 1 ? 'radial-mode' : 'flat-mode'}`}>
          {gameState.opponents.map((opp: PlayerPublicState, index: number) => {
            const isOppTurn = gameState.activePlayerId === opp.id;
            const isOppDealer = gameState.startingPlayerId === opp.id;
            const style = getOpponentStyle(index, gameState.opponents.length);

            return (
              <div
                className={`opponent-card ${isOppTurn ? 'active-turn' : ''} ${isOppDealer ? 'dealer-card' : ''}`}
                key={opp.id}
                style={style}
              >
                <div className="avatar">{opp.name.charAt(0).toUpperCase()}</div>
                <div className="opp-info">
                  <div className="opp-name-row">
                    <span className="opp-name">{opp.name}</span>
                    {isOppDealer && <span className="dealer-badge-pill" title="Round Dealer">★ DEALER</span>}
                  </div>
                  <div className="opp-cards-count">{opp.cardCount} CARDS</div>
                </div>
                <div className="mini-card-backs">
                  {Array.from({ length: opp.cardCount }).map((_, i) => (
                    <Card key={i} isBack />
                  ))}
                </div>
                {isOppTurn && <span className="turn-indicator-pill">PLAYING...</span>}
              </div>
            );
          })}
        </div>

        {/* Table Center */}
        <div className="table-center">
          {isSetupActive ? (
            /* Interactive Setup Stage Area */
            <div className="setup-container">
              <div className="setup-banner">
                <div className="setup-title">🎮 GAME SETUP SEQUENCE</div>
                <div className="setup-decks-preview">
                  <div className="deck-visual">
                    <Card isBack />
                  </div>
                  <div className="deck-visual offset">
                    <Card isBack />
                  </div>
                  <div className="deck-caption">TWO STANDARD DECKS (104 CARDS)</div>
                </div>

                {gameState.setupStage === 'SETUP_SHUFFLE' && (
                  <div className="setup-step-box">
                    <div className="step-badge">STEP 1 OF 3</div>
                    <h3>SHUFFLE & DISTRIBUTE</h3>
                    <p>Deal 5 cards to each player from two standard decks (104 cards).</p>
                    {isSetupActor ? (
                      <button className="cta setup-action-btn" onClick={onSetupShuffle}>
                        🔀 SHUFFLE AND DISTRIBUTE
                      </button>
                    ) : (
                      <div className="setup-waiting-text">
                        Waiting for <strong>{getActorName(gameState.setupActorId)}</strong> to shuffle and distribute...
                      </div>
                    )}
                  </div>
                )}

                {gameState.setupStage === 'SETUP_OPEN_CARD' && (
                  <div className="setup-step-box">
                    <div className="step-badge">STEP 2 OF 3</div>
                    <h3>PICK OPEN CARD</h3>
                    <p>Select the first card from the deck to serve as the initial open card.</p>
                    {isSetupActor ? (
                      <button className="cta setup-action-btn" onClick={onSetupOpenCard}>
                        🃏 PICK OPEN CARD
                      </button>
                    ) : (
                      <div className="setup-waiting-text">
                        Waiting for <strong>{getActorName(gameState.setupActorId)}</strong> to pick the open card...
                      </div>
                    )}
                  </div>
                )}

                {gameState.setupStage === 'SETUP_JOKER_CARD' && (
                  <div className="setup-step-box">
                    <div className="step-badge">STEP 3 OF 3</div>
                    <h3>PICK JOKER CARD</h3>
                    <p>Select the card that determines the Joker rank for this round.</p>
                    {isSetupActor ? (
                      <button className="cta setup-action-btn" onClick={onSetupJokerCard}>
                        🌟 PICK JOKER CARD
                      </button>
                    ) : (
                      <div className="setup-waiting-text">
                        Waiting for <strong>{getActorName(gameState.setupActorId)}</strong> to pick the joker card...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Normal Game Piles (Joker, Draw, Discard) */
            <div className="piles-container">
              {/* Left: Joker Card */}
              <div className="pile joker-pile">
                <div className="pile-label">JOKER</div>
                <Card isJokerDisplay jokerRank={gameState.jokerRank} />
              </div>

              {/* Center: Draw Pile */}
              <div
                className={`pile draw-pile ${
                  isMyTurn && gameState.phase === 'WAITING_FOR_DRAW' ? 'actionable' : ''
                }`}
                onClick={() => {
                  if (isMyTurn && gameState.phase === 'WAITING_FOR_DRAW') {
                    onAcquire('draw');
                  }
                }}
              >
                <div className="pile-label">DRAW DECK ({gameState.drawPileCount})</div>
                <Card isBack />
              </div>

              {/* Right: Discard Pile (Visual Stack & Pick Target) */}
              <div
                className={`pile discard-pile ${dragOverDiscard ? 'drag-over' : ''} ${
                  isMyTurn && gameState.phase === 'WAITING_FOR_DRAW' ? 'actionable' : ''
                }`}
                onDragOver={handleDragOverDiscard}
                onDragLeave={handleDragLeaveDiscard}
                onDrop={handleDropDiscardZone}
                onClick={() => {
                  if (isMyTurn && gameState.phase === 'WAITING_FOR_DRAW') {
                    onAcquire('pick');
                  }
                }}
              >
                <div className="pile-label">TOP DISCARD</div>
                <div className="discard-stack-wrapper">
                  {prevCard && (
                    <div className="discard-card-underneath">
                      <Card card={prevCard} />
                    </div>
                  )}
                  {topCard && (
                    <div className="discard-card-top-tilted">
                      <Card card={topCard} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Turn Banner / Status Notice */}
          <div className={`status-banner ${isMyTurn && !isSetupActive ? 'my-turn-banner' : ''}`}>
            {formatNoticeText(noticeMessage || gameState.roundNotice) ||
              (isSetupActive
                ? `Game Setup Stage: ${gameState.setupStage?.replace('SETUP_', '').replace('_', ' ')}`
                : isMyTurn
                ? gameState.phase === 'WAITING_FOR_DRAW'
                  ? 'SELECT PICKUP: Draw from Deck or Pick Top Discard'
                  : 'YOUR TURN: Drag or select matching rank cards to drop'
                : `Waiting for ${
                    gameState.opponents.find((o: PlayerPublicState) => o.id === gameState.activePlayerId)?.name || 'opponent'
                  }'s turn...`)}
          </div>
        </div>

        {/* Player's Own Area */}
        <div className="your-area">
          <div className="your-header">
            <div className="avatar active-me">YOU</div>
            <div className="your-info">
              <div className="your-name-row">
                <span className="your-name">MY HAND</span>
                {isMyDealer && <span className="dealer-badge-pill" title="Round Dealer">★ DEALER</span>}
              </div>
              {showDevScore && <span className="your-score dev-score">Dev Score: {myHandScore} pts</span>}
            </div>
          </div>

          {/* Cards Hand */}
          <div className="hand-container">
            {gameState.myHand.map((c: CardType) => {
              const isJoker = c.rank === gameState.jokerRank;
              const isSelected = selectedIds.includes(c.id);
              return (
                <Card
                  key={c.id}
                  card={c}
                  selected={isSelected}
                  isJoker={isJoker}
                  disabled={!isMyTurn || isSetupActive}
                  onClick={() => toggleSelectCard(c.id)}
                  onDragStart={e => handleDragStartCard(e, c.id)}
                />
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            {gameState.phase === 'SELECTING_DROP' && !isSetupActive && (
              <button
                className="cta"
                disabled={!isMyTurn || selectedIds.length === 0}
                onClick={handleDropClick}
              >
                DROP SELECTED ({selectedIds.length})
              </button>
            )}

            {gameState.phase === 'WAITING_FOR_DRAW' && !isSetupActive && (
              <>
                <button className="cta" disabled={!isMyTurn} onClick={() => onAcquire('draw')}>
                  DRAW FROM DECK
                </button>
                <button className="cta secondary" disabled={!isMyTurn} onClick={() => onAcquire('pick')}>
                  PICK TOP DISCARD
                </button>
              </>
            )}

            <button
              className={`cta least-count-btn ${canCallLeastCount && !isSetupActive ? 'glowing' : ''}`}
              disabled={!canCallLeastCount || isSetupActive}
              onClick={onLeastCount}
            >
              ⚡ LEAST COUNT
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
