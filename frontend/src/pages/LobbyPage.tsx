import React, { useState } from 'react';
import { ClientGameState, PlayerInfo } from '../types/game';

interface LobbyPageProps {
  myPlayerId: string;
  myPlayerName?: string;
  gameState: ClientGameState;
  onToggleReady: () => void;
  onStartGame: () => void;
  onBack: () => void;
  notice?: string;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({
  myPlayerId,
  myPlayerName,
  gameState,
  onToggleReady,
  onStartGame,
  onBack,
  notice,
}) => {
  const [copied, setCopied] = useState(false);

  const currentDisplayName = (myPlayerName || sessionStorage.getItem('lc_display_name') || '').trim();
  const currentPid = (myPlayerId || sessionStorage.getItem('lc_player_id') || '').trim();

  // Find player record for 'me' checking stable id, socketId, or display name
  const me = gameState.players.find(
    (p: PlayerInfo) =>
      (currentPid && (p.id === currentPid || (p as any).socketId === currentPid)) ||
      (currentDisplayName && p.name.trim().toLowerCase() === currentDisplayName.toLowerCase())
  );

  // Robust host check
  const isHost =
    (me ? me.id === gameState.hostId : false) ||
    (currentPid !== '' && gameState.hostId === currentPid) ||
    (gameState.players[0] &&
      ((me && gameState.players[0].id === me.id) ||
        (currentPid !== '' && (gameState.players[0].id === currentPid || (gameState.players[0] as any).socketId === currentPid)) ||
        (currentDisplayName !== '' && gameState.players[0].name.trim().toLowerCase() === currentDisplayName.toLowerCase())));

  const isReady = isHost ? true : (me?.ready || false);

  const allPlayersJoined = gameState.players.length === gameState.expectedPlayers;
  // Non-host players must be ready
  const nonHostPlayers = gameState.players.filter((p: PlayerInfo, idx: number) => idx !== 0 && p.id !== gameState.hostId);
  const allNonHostReady = nonHostPlayers.every((p: PlayerInfo) => p.ready);
  const canStartGame = allPlayersJoined && (nonHostPlayers.length === 0 || allNonHostReady);

  const shareableUrl = `${window.location.origin}${window.location.pathname}?room=${gameState.roomCode}`;

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <main className="app simple-screen">
      <button className="back-link" onClick={onBack}>
        ← Leave Room
      </button>

      <div className="friends-heading">
        <h2>Room: {gameState.roomCode}</h2>
        <span className="connection online">
          <i></i>
          {gameState.players.length} / {gameState.expectedPlayers} Players Joined
        </span>
      </div>

      <section className="simple-card lobby">
        <div className="lobby-header">
          <div>
            <strong>HOST: </strong>
            <span>{gameState.players.find((p: PlayerInfo) => p.id === gameState.hostId)?.name || 'Host'}</span>
          </div>
          <div>
            <strong>ROUNDS: </strong>
            <span>{gameState.totalRounds}</span>
          </div>
        </div>

        <div className="share-link-box">
          <small>SHAREABLE ROOM LINK</small>
          <div className="share-url-row">
            <input type="text" readOnly value={shareableUrl} />
            <button className="cta secondary copy-btn" onClick={copyShareLink}>
              {copied ? 'COPIED!' : 'COPY'}
            </button>
          </div>
        </div>

        <h3>PLAYER LIST</h3>
        <div className="player-list">
          {Array.from({ length: gameState.expectedPlayers }, (_, i) => {
            const p = gameState.players[i];
            if (p) {
              const isPlayerHost = i === 0 || p.id === gameState.hostId;
              const isMe =
                (me && p.id === me.id) ||
                (currentPid !== '' && (p.id === currentPid || (p as any).socketId === currentPid)) ||
                (currentDisplayName !== '' && p.name.trim().toLowerCase() === currentDisplayName.toLowerCase());
              const isPlayerReady = p.ready || isPlayerHost;

              return (
                <div className="player-line" key={p.id}>
                  <span className="player-index">{i + 1}.</span>
                  <span className="player-name-text">
                    {p.name} {isPlayerHost && ' 👑 (HOST)'} {isMe && ' (YOU)'}
                  </span>
                  <b className={isPlayerReady ? 'ready-text' : 'not-ready-text'}>
                    {isPlayerReady ? '✓ READY' : '⏳ NOT READY'}
                  </b>
                </div>
              );
            }
            return (
              <div className="player-line waiting" key={i}>
                <span className="player-index">{i + 1}.</span>
                <span className="player-name-text">Waiting for player to join...</span>
              </div>
            );
          })}
        </div>

        <div className="lobby-actions">
          {isHost ? (
            <button
              className="cta"
              disabled={!canStartGame}
              onClick={onStartGame}
            >
              {allPlayersJoined
                ? canStartGame
                  ? '🚀 START GAME'
                  : '⏳ WAITING FOR PLAYERS TO BE READY'
                : `⏳ WAITING FOR PLAYERS (${gameState.players.length}/${gameState.expectedPlayers})`}
            </button>
          ) : (
            <button className={`cta ${isReady ? 'secondary' : ''}`} onClick={onToggleReady}>
              {isReady ? '✓ READY (CLICK TO UNREADY)' : '⚡ TOGGLE READY'}
            </button>
          )}
        </div>

        {notice && <p className="status status-error">{notice}</p>}
      </section>
    </main>
  );
};

