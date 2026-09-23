import { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { io, Socket } from 'socket.io-client';
import { ClientGameState, PlayerInfo } from './types/game';
import { GameEngine } from './game/engine';
import { runBotTurn } from './game/systemBot';

import { HomePage } from './pages/HomePage';
import { FriendsPage } from './pages/FriendsPage';
import { SettingsPage } from './pages/SettingsPage';
import { RulesPage } from './pages/RulesPage';
import { LobbyPage } from './pages/LobbyPage';
import { Table } from './components/Table';
import { ScoreModal } from './components/ScoreModal';
import { GameOverModal } from './components/GameOverModal';

import './styles/styles.css';

const getOrCreatePlayerId = (): string => {
  let pid = sessionStorage.getItem('lc_player_id');
  if (!pid) {
    pid = 'p_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    sessionStorage.setItem('lc_player_id', pid);
  }
  return pid;
};

export function App() {
  const [screen, setScreen] = useState<'home' | 'friends' | 'lobby' | 'game' | 'system' | 'settings' | 'rules'>('home');
  const [name, setName] = useState('');
  const [initialRoomCode, setInitialRoomCode] = useState('');
  const [notice, setNotice] = useState('');
  const [showScoreModal, setShowScoreModal] = useState(false);

  // Settings
  const [theme, setTheme] = useState('Green');
  const [font, setFont] = useState('DM Sans');
  const [cardStyle, setCardStyle] = useState('Classic');

  // Socket & Room State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sState, setSState] = useState<ClientGameState | null>(null);

  // System Mode Local Engine State
  const systemEngineRef = useRef<GameEngine | null>(null);
  const [systemStateTick, setSystemStateTick] = useState(0);

  // Check URL params & handle auto-reconnect on browser refresh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInitialRoomCode(roomParam.toUpperCase());
      setScreen('friends');
      return;
    }

    // 1. Session restoration for System (Single-Player) Mode
    const savedMode = sessionStorage.getItem('lc_mode');
    const savedSystemState = sessionStorage.getItem('lc_system_engine_state');
    if (savedMode === 'system' && savedSystemState) {
      try {
        const parsed = JSON.parse(savedSystemState);
        const engine = GameEngine.fromSnapshot(parsed);
        systemEngineRef.current = engine;
        const savedName = sessionStorage.getItem('lc_display_name') || 'You';
        setName(savedName);
        setScreen('system');
        setSystemStateTick(t => t + 1);
        return;
      } catch {
        sessionStorage.removeItem('lc_mode');
        sessionStorage.removeItem('lc_system_engine_state');
      }
    }

    // 2. Session restoration for Multiplayer Mode
    const savedCode = sessionStorage.getItem('lc_room_code');
    const savedName = sessionStorage.getItem('lc_display_name');
    const pid = getOrCreatePlayerId();
    if (savedCode && savedName) {
      setName(savedName);
      const s = connectSocket();
      s.emit('room:reconnect', { roomCode: savedCode, name: savedName, playerId: pid }, (res: any) => {
        if (res?.error) {
          sessionStorage.removeItem('lc_room_code');
          sessionStorage.removeItem('lc_display_name');
          sessionStorage.removeItem('lc_mode');
        } else if (res?.playerId) {
          sessionStorage.setItem('lc_player_id', res.playerId);
          sessionStorage.setItem('lc_mode', 'multiplayer');
        }
      });
    }
  }, []);

  // Sync settings to DOM
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.cardStyle = cardStyle;
    document.documentElement.style.fontFamily = font === 'System' ? 'sans-serif' : font;
  }, [theme, font, cardStyle]);

  // Clean up socket on unmount
  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  // Auto-persist System Mode single-player state on changes
  useEffect(() => {
    if (screen === 'system' && systemEngineRef.current) {
      sessionStorage.setItem('lc_mode', 'system');
      sessionStorage.setItem('lc_system_engine_state', JSON.stringify(systemEngineRef.current.toSnapshot()));
      if (name) {
        sessionStorage.setItem('lc_display_name', name);
      }
    }
  }, [systemStateTick, screen, name]);

  const connectSocket = () => {
    if (socket && socket.connected) return socket;
    const endpoint = (import.meta.env.VITE_SOCKET_URL as string) || `${window.location.protocol}//${window.location.hostname}:3001`;
    const s = io(endpoint);

    s.on('game:state', (newState: ClientGameState) => {
      setSState(newState);
      if (newState.roomCode) {
        sessionStorage.setItem('lc_room_code', newState.roomCode);
        sessionStorage.setItem('lc_mode', 'multiplayer');
        if (name) sessionStorage.setItem('lc_display_name', name);
      }
      if (newState.status === 'IN_GAME' || newState.status === 'FINISHED') {
        setScreen('game');
      } else if (newState.status === 'LOBBY' || newState.status === 'WAITING_FOR_PLAYERS') {
        setScreen('lobby');
      }
    });

    s.on('connect_error', () => {
      setNotice('Unable to connect to game server. Make sure server is running on port 3001.');
    });

    setSocket(s);
    return s;
  };

  // Friends Mode Actions
  const handleCreateRoom = (userName: string, players: number, rounds: number) => {
    if (!userName.trim()) return setNotice('Please enter your display name.');
    const trimmedName = userName.trim();
    setName(trimmedName);
    sessionStorage.setItem('lc_display_name', trimmedName);
    setNotice('');
    const pid = getOrCreatePlayerId();
    const s = connectSocket();
    s.emit('room:create', { name: trimmedName, expectedPlayers: players, totalRounds: rounds, playerId: pid }, (res: any) => {
      if (res?.error) {
        setNotice(res.error);
      } else {
        if (res?.playerId) sessionStorage.setItem('lc_player_id', res.playerId);
        if (res?.roomCode) sessionStorage.setItem('lc_room_code', res.roomCode);
        sessionStorage.setItem('lc_mode', 'multiplayer');
      }
    });
  };

  const handleJoinRoom = (userName: string, roomCode: string) => {
    if (!userName.trim() || !roomCode.trim()) return setNotice('Please enter your name and room code.');
    const trimmedName = userName.trim();
    setName(trimmedName);
    sessionStorage.setItem('lc_display_name', trimmedName);
    setNotice('');
    const pid = getOrCreatePlayerId();
    const s = connectSocket();
    s.emit('room:join', { name: trimmedName, roomCode: roomCode.trim().toUpperCase(), playerId: pid }, (res: any) => {
      if (res?.error) {
        setNotice(res.error);
      } else {
        if (res?.playerId) sessionStorage.setItem('lc_player_id', res.playerId);
        if (res?.roomCode) sessionStorage.setItem('lc_room_code', res.roomCode);
        sessionStorage.setItem('lc_mode', 'multiplayer');
      }
    });
  };

  const handleToggleReady = () => {
    if (!sState || !socket) return;
    socket.emit('room:ready', { roomCode: sState.roomCode });
  };

  const handleStartGame = () => {
    if (!sState || !socket) return;
    socket.emit('room:start', { roomCode: sState.roomCode }, (res: any) => {
      if (res?.error) setNotice(res.error);
    });
  };

  // Setup Actions
  const handleSetupShuffle = () => {
    if (!sState || !socket) return;
    socket.emit('game:setup-shuffle', { roomCode: sState.roomCode }, (res: any) => {
      if (res?.error) setNotice(res.error);
    });
  };

  const handleSetupOpenCard = () => {
    if (!sState || !socket) return;
    socket.emit('game:setup-open-card', { roomCode: sState.roomCode }, (res: any) => {
      if (res?.error) setNotice(res.error);
    });
  };

  const handleSetupJokerCard = () => {
    if (!sState || !socket) return;
    socket.emit('game:setup-joker-card', { roomCode: sState.roomCode }, (res: any) => {
      if (res?.error) setNotice(res.error);
    });
  };

  const handleExitGame = () => {
    if (sState?.roomCode && socket) {
      socket.emit('room:leave', { roomCode: sState.roomCode });
    }
    sessionStorage.removeItem('lc_room_code');
    sessionStorage.removeItem('lc_display_name');
    sessionStorage.removeItem('lc_mode');
    sessionStorage.removeItem('lc_system_engine_state');
    socket?.disconnect();
    setSocket(null);
    setSState(null);
    systemEngineRef.current = null;
    setScreen('home');
  };

  // System Bot Mode Actions
  const startSystemMode = () => {
    const humanId = 'human-player';
    const botId = 'system-bot';
    const engine = new GameEngine([humanId, botId], 5);
    systemEngineRef.current = engine;
    setNotice('Game setup ready. Perform setup actions to start!');
    setScreen('system');
    sessionStorage.setItem('lc_mode', 'system');
    sessionStorage.setItem('lc_system_engine_state', JSON.stringify(engine.toSnapshot()));
    setSystemStateTick(t => t + 1);
  };

  // System Bot turn and setup triggers
  const triggerBotIfNeeded = () => {
    const engine = systemEngineRef.current;
    if (!engine) return;

    // Handle bot setup actions if bot is setup actor
    if (engine.setupStage && engine.setupStage !== 'IN_GAME') {
      if (engine.setupActorId === 'system-bot') {
        setTimeout(() => {
          if (engine.setupStage === 'SETUP_SHUFFLE') {
            engine.shuffleAndDistribute('system-bot');
          } else if (engine.setupStage === 'SETUP_OPEN_CARD') {
            engine.pickOpenCard('system-bot');
          } else if (engine.setupStage === 'SETUP_JOKER_CARD') {
            engine.pickJokerCard('system-bot');
          }
          setSystemStateTick(t => t + 1);
        }, 700);
      }
      return;
    }

    if (engine.activePlayerId === 'system-bot' && engine.phase !== 'ROUND_COMPLETE' && engine.phase !== 'GAME_COMPLETE') {
      setTimeout(() => {
        runBotTurn(engine, 'system-bot');
        setSystemStateTick(t => t + 1);
      }, 700);
    }
  };

  useEffect(() => {
    if (screen === 'system') {
      triggerBotIfNeeded();
    }
  }, [systemStateTick, screen]);

  // System Mode Setup Controls
  const handleSystemSetupShuffle = () => {
    const engine = systemEngineRef.current;
    if (!engine) return;
    try {
      engine.shuffleAndDistribute('human-player');
      setSystemStateTick(t => t + 1);
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  const handleSystemSetupOpenCard = () => {
    const engine = systemEngineRef.current;
    if (!engine) return;
    try {
      engine.pickOpenCard('human-player');
      setSystemStateTick(t => t + 1);
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  const handleSystemSetupJokerCard = () => {
    const engine = systemEngineRef.current;
    if (!engine) return;
    try {
      engine.pickJokerCard('human-player');
      setSystemStateTick(t => t + 1);
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  // System Mode Controls
  const handleSystemDrop = (cardIds: string[]) => {
    const engine = systemEngineRef.current;
    if (!engine) return;
    try {
      engine.drop('human-player', cardIds);
      setNotice('');
      setSystemStateTick(t => t + 1);
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  const handleSystemAcquire = (kind: 'draw' | 'pick') => {
    const engine = systemEngineRef.current;
    if (!engine) return;
    try {
      engine.acquire('human-player', kind);
      setNotice('');
      setSystemStateTick(t => t + 1);
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  const handleSystemLeastCount = () => {
    const engine = systemEngineRef.current;
    if (!engine) return;
    try {
      engine.leastCount('human-player');
      setNotice('');
      setSystemStateTick(t => t + 1);
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  const myPlayerId = sessionStorage.getItem('lc_player_id') || socket?.id || '';

  // Render Page Views
  if (screen === 'home') {
    return (
      <HomePage
        onSelectSystem={startSystemMode}
        onSelectFriends={() => setScreen('friends')}
        onSelectRules={() => setScreen('rules')}
        onSelectSettings={() => setScreen('settings')}
      />
    );
  }

  if (screen === 'rules') {
    return <RulesPage onBack={() => setScreen('home')} />;
  }

  if (screen === 'settings') {
    return (
      <SettingsPage
        theme={theme}
        font={font}
        cardStyle={cardStyle}
        onThemeChange={setTheme}
        onFontChange={setFont}
        onCardStyleChange={setCardStyle}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'friends') {
    return (
      <FriendsPage
        initialRoomCode={initialRoomCode}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onBack={() => setScreen('home')}
        notice={notice}
      />
    );
  }

  if (screen === 'lobby' && sState) {
    return (
      <LobbyPage
        myPlayerId={myPlayerId}
        myPlayerName={name}
        gameState={sState}
        onToggleReady={handleToggleReady}
        onStartGame={handleStartGame}
        onBack={handleExitGame}
        notice={notice}
      />
    );
  }

  // Multiplayer Game Screen
  if (screen === 'game' && sState && sState.game) {
    const g = sState.game;
    const players: PlayerInfo[] = sState.players;

    return (
      <main className="app game-screen">
        <Table
          myPlayerId={myPlayerId}
          gameState={g}
          totalRounds={sState.totalRounds}
          currentRound={sState.currentRound}
          roomCode={sState.roomCode}
          noticeMessage={notice}
          roomPlayers={players}
          onDrop={ids => socket?.emit('game:drop', { roomCode: sState.roomCode, cardIds: ids })}
          onAcquire={kind => socket?.emit('game:acquire', { roomCode: sState.roomCode, kind })}
          onLeastCount={() => socket?.emit('game:least-count', { roomCode: sState.roomCode })}
          onShowScores={() => setShowScoreModal(true)}
          onSetupShuffle={handleSetupShuffle}
          onSetupOpenCard={handleSetupOpenCard}
          onSetupJokerCard={handleSetupJokerCard}
          onExit={handleExitGame}
        />

        {showScoreModal && (
          <ScoreModal
            players={players}
            completedScores={g.completedRoundScores}
            totalRounds={sState.totalRounds}
            onClose={() => setShowScoreModal(false)}
          />
        )}

        {g.phase === 'ROUND_COMPLETE' && (
          <div className="round-complete-banner">
            <h2>ROUND {sState.currentRound} COMPLETE</h2>
            <p>{g.roundNotice}</p>
            <button
              className="cta"
              onClick={() => {
                socket?.emit('game:next-round', { roomCode: sState.roomCode });
              }}
            >
              NEXT ROUND ({sState.currentRound + 1}/{sState.totalRounds})
            </button>
          </div>
        )}

        {g.phase === 'GAME_COMPLETE' && (
          <GameOverModal
            players={players}
            completedScores={g.completedRoundScores}
            onReturnToHome={handleExitGame}
          />
        )}
      </main>
    );
  }

  // System Single-Player Game Screen
  if (screen === 'system' && systemEngineRef.current) {
    const engine = systemEngineRef.current;
    const humanHand = engine.hands.get('human-player') || [];
    const botHand = engine.hands.get('system-bot') || [];

    const players: PlayerInfo[] = [
      { id: 'human-player', name: name || 'You', ready: true },
      { id: 'system-bot', name: 'System Bot', ready: true },
    ];

    const clientGameStateData = {
      setupStage: engine.setupStage,
      setupActorId: engine.setupActorId,
      phase: engine.phase,
      activePlayerId: engine.activePlayerId,
      startingPlayerId: engine.startingPlayerId,
      jokerRank: engine.jokerRank,
      openCard: engine.openCard,
      discardTop: engine.discardPile.at(-1),
      discardPile: engine.discardPile,
      drawPileCount: engine.drawPile.length,
      myHand: humanHand,
      opponents: [
        {
          id: 'system-bot',
          name: 'System Bot',
          cardCount: botHand.length,
        },
      ],
      completedRoundScores: engine.completedRoundScores,
      roundNotice: engine.roundNotice,
    };

    return (
      <main className="app game-screen">
        <Table
          myPlayerId="human-player"
          gameState={clientGameStateData}
          totalRounds={engine.totalRounds}
          currentRound={engine.roundNumber}
          noticeMessage={notice}
          roomPlayers={players}
          onDrop={handleSystemDrop}
          onAcquire={handleSystemAcquire}
          onLeastCount={handleSystemLeastCount}
          onShowScores={() => setShowScoreModal(true)}
          onSetupShuffle={handleSystemSetupShuffle}
          onSetupOpenCard={handleSystemSetupOpenCard}
          onSetupJokerCard={handleSystemSetupJokerCard}
          onExit={handleExitGame}
        />

        {showScoreModal && (
          <ScoreModal
            players={players}
            completedScores={engine.completedRoundScores}
            totalRounds={engine.totalRounds}
            onClose={() => setShowScoreModal(false)}
          />
        )}

        {engine.phase === 'ROUND_COMPLETE' && (
          <div className="round-complete-banner">
            <h2>ROUND {engine.roundNumber} COMPLETE</h2>
            <p>{engine.roundNotice}</p>
            <button
              className="cta"
              onClick={() => {
                engine.startRound(engine.roundNumber + 1);
                setSystemStateTick(t => t + 1);
              }}
            >
              NEXT ROUND ({engine.roundNumber + 1}/{engine.totalRounds})
            </button>
          </div>
        )}

        {engine.phase === 'GAME_COMPLETE' && (
          <GameOverModal
            players={players}
            completedScores={engine.completedRoundScores}
            onReturnToHome={handleExitGame}
          />
        )}
      </main>
    );
  }

  return null;
}

createRoot(document.getElementById('root')!).render(<App />);
