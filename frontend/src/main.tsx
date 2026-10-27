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
import { AboutUsPage } from './pages/AboutUsPage';
import { LobbyPage } from './pages/LobbyPage';
import { Table } from './components/Table';
import { ScoreModal } from './components/ScoreModal';
import { GameOverModal } from './components/GameOverModal';
import { ProfileModal } from './components/ProfileModal';
import { soundManager } from './services/soundManager';
import { useGameSounds } from './hooks/useGameSounds';
import { playerProfileManager, PlayerProfile } from './services/playerProfile';

import './styles/styles.css';

export function App() {
  const [screen, setScreen] = useState<'home' | 'friends' | 'lobby' | 'game' | 'system' | 'settings' | 'rules' | 'about'>('home');
  const [name, setName] = useState('');
  const [initialRoomCode, setInitialRoomCode] = useState('');
  const [notice, setNotice] = useState('');
  const [showScoreModal, setShowScoreModal] = useState(false);

  // Player Profile State
  const [profile, setProfile] = useState<PlayerProfile | null>(() => playerProfileManager.getProfile());
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isFirstTimeProfile, setIsFirstTimeProfile] = useState(false);

  useEffect(() => {
    return playerProfileManager.subscribe(p => {
      setProfile(p);
      if (p?.name) {
        setName(p.name);
      }
    });
  }, []);

  // Settings
  const [theme, setTheme] = useState('Green');
  const [font, setFont] = useState('DM Sans');
  const [cardStyle, setCardStyle] = useState('Classic');
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isSoundEnabled());

  useEffect(() => {
    return soundManager.subscribe(setSoundEnabled);
  }, []);

  // Socket & Room State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sState, setSState] = useState<ClientGameState | null>(null);

  // System Mode Local Engine State
  const systemEngineRef = useRef<GameEngine | null>(null);
  const [systemStateTick, setSystemStateTick] = useState(0);

  // Check URL params & handle auto-reconnect on browser refresh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room')?.toUpperCase().trim();

    const currentProfile = playerProfileManager.getProfile();
    if (currentProfile?.name) {
      setName(currentProfile.name);
    }

    // 1. Session restoration for System (Single-Player) Mode
    const savedMode = sessionStorage.getItem('lc_mode');
    const savedSystemState = sessionStorage.getItem('lc_system_engine_state');
    if (savedMode === 'system' && savedSystemState) {
      try {
        const parsed = JSON.parse(savedSystemState);
        const engine = GameEngine.fromSnapshot(parsed);
        systemEngineRef.current = engine;
        const savedName = sessionStorage.getItem('lc_display_name') || currentProfile?.name || 'You';
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
    const savedRoomCode = (sessionStorage.getItem('lc_room_code') || localStorage.getItem('lc_active_room_code') || '').toUpperCase().trim();
    const identity = playerProfileManager.getOrCreateIdentity();
    const displayName = currentProfile?.name || sessionStorage.getItem('lc_display_name') || '';

    // If player has an active room session and refreshed the browser:
    if (savedRoomCode && (!roomParam || roomParam === savedRoomCode)) {
      if (roomParam) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (displayName) setName(displayName);

      const s = connectSocket();
      s.emit('room:reconnect', {
        roomCode: savedRoomCode,
        playerId: identity.id,
        playerToken: identity.token,
        name: displayName,
      }, (res: any) => {
        if (res?.error) {
          sessionStorage.removeItem('lc_room_code');
          sessionStorage.removeItem('lc_mode');
          localStorage.removeItem('lc_active_room_code');
          setNotice(res.error);
          setScreen('home');
        } else {
          sessionStorage.setItem('lc_room_code', savedRoomCode);
          sessionStorage.setItem('lc_mode', 'multiplayer');
          localStorage.setItem('lc_active_room_code', savedRoomCode);
        }
      });
      return;
    }

    // 3. Opening a shared Friends invite link
    if (roomParam) {
      setInitialRoomCode(roomParam);
      if (currentProfile?.name) {
        // Auto-join directly with saved profile!
        const s = connectSocket();
        s.emit('room:join', {
          roomCode: roomParam,
          name: currentProfile.name,
          playerId: identity.id,
          playerToken: identity.token,
        }, (res: any) => {
          if (res?.error) {
            setNotice(res.error);
            setScreen('friends');
          } else {
            window.history.replaceState({}, '', window.location.pathname);
            sessionStorage.setItem('lc_room_code', roomParam);
            sessionStorage.setItem('lc_mode', 'multiplayer');
            localStorage.setItem('lc_active_room_code', roomParam);
          }
        });
      } else {
        // Prompt first-time profile creation, then join room
        setIsFirstTimeProfile(true);
        setShowProfileModal(true);
        setScreen('friends');
      }
      return;
    }

    // 4. First-time visitor without profile
    if (!currentProfile) {
      setIsFirstTimeProfile(true);
      setShowProfileModal(true);
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

    const rawSocketUrl = ((import.meta.env.VITE_SOCKET_URL as string) || '').trim();
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
    const endpoint = rawSocketUrl || (isLocalhost ? `${window.location.protocol}//${window.location.hostname}:3001` : '');

    if (!endpoint) {
      setNotice('Server URL is not configured. Please set VITE_SOCKET_URL in your deployment settings.');
      const fallback = socket || io({ autoConnect: false });
      if (!socket) setSocket(fallback);
      return fallback;
    }

    const s = io(endpoint);

    s.on('connect', () => {
      // Automatic re-handshake on socket reconnect
      const savedCode = (sessionStorage.getItem('lc_room_code') || localStorage.getItem('lc_active_room_code') || '').toUpperCase().trim();
      const identity = playerProfileManager.getOrCreateIdentity();
      const currentName = playerProfileManager.getProfile()?.name || sessionStorage.getItem('lc_display_name') || '';

      if (savedCode && identity.id) {
        s.emit('room:reconnect', {
          roomCode: savedCode,
          playerId: identity.id,
          playerToken: identity.token,
          name: currentName,
        }, (res: any) => {
          if (res?.error && res.error.includes('no longer exists')) {
            sessionStorage.removeItem('lc_room_code');
            sessionStorage.removeItem('lc_mode');
            localStorage.removeItem('lc_active_room_code');
            setNotice('Previous room session has ended.');
            setScreen('home');
          }
        });
      }
    });

    s.on('game:state', (newState: ClientGameState) => {
      setSState(newState);
      if (newState.roomCode) {
        sessionStorage.setItem('lc_room_code', newState.roomCode);
        localStorage.setItem('lc_active_room_code', newState.roomCode);
        sessionStorage.setItem('lc_mode', 'multiplayer');
      }
      if (newState.status === 'IN_GAME' || newState.status === 'FINISHED') {
        setScreen('game');
      } else if (newState.status === 'LOBBY' || newState.status === 'WAITING_FOR_PLAYERS') {
        setScreen('lobby');
      }
    });

    s.on('connect_error', () => {
      if (isLocalhost) {
        setNotice('Unable to connect to game server. Make sure server is running on port 3001.');
      } else {
        setNotice('Unable to connect to game server. The backend may be spinning up or temporarily unreachable.');
      }
    });

    setSocket(s);
    return s;
  };

  // Friends Mode Actions
  const handleCreateRoom = (userName: string, players: number, rounds: number) => {
    const validation = playerProfileManager.saveProfile(userName);
    if (!validation.ok) return setNotice(validation.error || 'Please enter a valid display name.');

    const identity = playerProfileManager.getOrCreateIdentity();
    setName(validation.profile!.name);
    setNotice('');

    const s = connectSocket();
    s.emit('room:create', {
      name: validation.profile!.name,
      expectedPlayers: players,
      totalRounds: rounds,
      playerId: identity.id,
      playerToken: identity.token,
    }, (res: any) => {
      if (res?.error) {
        setNotice(res.error);
      } else {
        if (res?.roomCode) {
          sessionStorage.setItem('lc_room_code', res.roomCode);
          localStorage.setItem('lc_active_room_code', res.roomCode);
          sessionStorage.setItem('lc_mode', 'multiplayer');
        }
      }
    });
  };

  const handleJoinRoom = (userName: string, roomCode: string) => {
    const validation = playerProfileManager.saveProfile(userName);
    if (!validation.ok) return setNotice(validation.error || 'Please enter a valid display name.');

    const identity = playerProfileManager.getOrCreateIdentity();
    setName(validation.profile!.name);
    setNotice('');

    const s = connectSocket();
    s.emit('room:join', {
      name: validation.profile!.name,
      roomCode: roomCode.trim().toUpperCase(),
      playerId: identity.id,
      playerToken: identity.token,
    }, (res: any) => {
      if (res?.error) {
        setNotice(res.error);
      } else {
        if (res?.roomCode) {
          sessionStorage.setItem('lc_room_code', res.roomCode);
          localStorage.setItem('lc_active_room_code', res.roomCode);
          sessionStorage.setItem('lc_mode', 'multiplayer');
        }
      }
    });
  };

  const handleToggleReady = () => {
    if (!sState || !socket) return;
    const identity = playerProfileManager.getOrCreateIdentity();
    socket.emit('room:ready', {
      roomCode: sState.roomCode,
      playerId: identity.id,
      playerToken: identity.token,
    });
  };

  const handleStartGame = () => {
    if (!sState || !socket) return;
    const identity = playerProfileManager.getOrCreateIdentity();
    socket.emit('room:start', {
      roomCode: sState.roomCode,
      playerId: identity.id,
      playerToken: identity.token,
    }, (res: any) => {
      if (res?.error) setNotice(res.error);
    });
  };

  // Setup Actions
  const handleSetupShuffle = () => {
    if (!sState || !socket) return;
    const identity = playerProfileManager.getOrCreateIdentity();
    socket.emit('game:setup-shuffle', {
      roomCode: sState.roomCode,
      playerId: identity.id,
      playerToken: identity.token,
    }, (res: any) => {
      if (res?.error) {
        setNotice(res.error);
      } else {
        soundManager.playShuffle();
      }
    });
  };

  const handleSetupOpenCard = () => {
    if (!sState || !socket) return;
    const identity = playerProfileManager.getOrCreateIdentity();
    socket.emit('game:setup-open-card', {
      roomCode: sState.roomCode,
      playerId: identity.id,
      playerToken: identity.token,
    }, (res: any) => {
      if (res?.error) setNotice(res.error);
    });
  };

  const handleSetupJokerCard = () => {
    if (!sState || !socket) return;
    const identity = playerProfileManager.getOrCreateIdentity();
    socket.emit('game:setup-joker-card', {
      roomCode: sState.roomCode,
      playerId: identity.id,
      playerToken: identity.token,
    }, (res: any) => {
      if (res?.error) setNotice(res.error);
    });
  };

  const handleExitGame = () => {
    const identity = playerProfileManager.getOrCreateIdentity();
    if (sState?.roomCode && socket) {
      socket.emit('room:leave', {
        roomCode: sState.roomCode,
        playerId: identity.id,
        playerToken: identity.token,
      });
    }
    sessionStorage.removeItem('lc_room_code');
    sessionStorage.removeItem('lc_mode');
    sessionStorage.removeItem('lc_system_engine_state');
    localStorage.removeItem('lc_active_room_code');
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
            soundManager.playShuffle();
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
      soundManager.playShuffle();
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
      soundManager.playCardDrop(false);
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
      const willRecycle = kind === 'draw' && engine.drawPile.length === 0 && engine.discardPile.length > 1;
      engine.acquire('human-player', kind);
      if (willRecycle) {
        soundManager.playShuffle();
      }
      if (kind === 'draw') {
        soundManager.playCardDraw(false);
      } else {
        soundManager.playCardPick(false);
      }
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

  const identity = playerProfileManager.getOrCreateIdentity();
  const myPlayerId = profile?.id || identity.id;

  const handleSaveProfile = (newName: string) => {
    const res = playerProfileManager.saveProfile(newName);
    if (res.ok && res.profile) {
      setProfile(res.profile);
      setName(res.profile.name);
      setShowProfileModal(false);
      setIsFirstTimeProfile(false);

      if (socket && socket.connected) {
        socket.emit('profile:update', {
          playerId: res.profile.id,
          playerToken: res.profile.token,
          name: res.profile.name,
        });
      }

      if (initialRoomCode) {
        handleJoinRoom(res.profile.name, initialRoomCode);
      }
    }
  };

  // Construct active game state for engine sound tracking & Table rendering
  const systemEngine = systemEngineRef.current;
  const systemClientGameState = (screen === 'system' && systemEngine) ? {
    setupStage: systemEngine.setupStage,
    setupActorId: systemEngine.setupActorId,
    phase: systemEngine.phase,
    activePlayerId: systemEngine.activePlayerId,
    startingPlayerId: systemEngine.startingPlayerId,
    jokerRank: systemEngine.jokerRank,
    openCard: systemEngine.openCard,
    discardTop: systemEngine.discardPile.at(-1),
    discardPile: systemEngine.discardPile,
    drawPileCount: systemEngine.drawPile.length,
    myHand: systemEngine.hands.get('human-player') || [],
    opponents: [
      {
        id: 'system-bot',
        name: 'System Bot',
        cardCount: (systemEngine.hands.get('system-bot') || []).length,
      },
    ],
    completedRoundScores: systemEngine.completedRoundScores,
    roundNotice: systemEngine.roundNotice,
  } : undefined;

  const activeGameState = screen === 'game' ? sState?.game : systemClientGameState;
  const activeCurrentRound = screen === 'game' ? (sState?.currentRound || 1) : (systemEngine?.roundNumber || 1);
  const soundPlayerId = screen === 'system' ? 'human-player' : myPlayerId;

  useGameSounds({
    myPlayerId: soundPlayerId,
    gameState: activeGameState,
    currentRound: activeCurrentRound,
  });

  // Render Page Views
  if (screen === 'home') {
    return (
      <>
        <HomePage
          profileName={profile?.name}
          onOpenProfile={() => {
            setIsFirstTimeProfile(false);
            setShowProfileModal(true);
          }}
          onSelectSystem={startSystemMode}
          onSelectFriends={() => setScreen('friends')}
          onSelectRules={() => setScreen('rules')}
          onSelectSettings={() => setScreen('settings')}
          onSelectAbout={() => setScreen('about')}
        />

        {showProfileModal && (
          <ProfileModal
            currentName={profile?.name || ''}
            isFirstTime={isFirstTimeProfile}
            onSave={handleSaveProfile}
            onClose={() => setShowProfileModal(false)}
          />
        )}
      </>
    );
  }

  if (screen === 'about') {
    return <AboutUsPage onBack={() => setScreen('home')} />;
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
        soundEnabled={soundEnabled}
        onThemeChange={setTheme}
        onFontChange={setFont}
        onCardStyleChange={setCardStyle}
        onSoundChange={enabled => soundManager.setSoundEnabled(enabled)}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'friends') {
    return (
      <>
        <FriendsPage
          initialRoomCode={initialRoomCode}
          defaultName={profile?.name || name}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onBack={() => setScreen('home')}
          notice={notice}
        />

        {showProfileModal && (
          <ProfileModal
            currentName={profile?.name || ''}
            isFirstTime={isFirstTimeProfile}
            onSave={handleSaveProfile}
            onClose={() => setShowProfileModal(false)}
          />
        )}
      </>
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
          onDrop={ids => {
            socket?.emit('game:drop', {
              roomCode: sState.roomCode,
              cardIds: ids,
              playerId: identity.id,
              playerToken: identity.token,
            }, (res: any) => {
              if (res?.error) {
                setNotice(res.error);
              } else {
                soundManager.playCardDrop(false);
              }
            });
          }}
          onAcquire={kind => {
            socket?.emit('game:acquire', {
              roomCode: sState.roomCode,
              kind,
              playerId: identity.id,
              playerToken: identity.token,
            }, (res: any) => {
              if (res?.error) {
                setNotice(res.error);
              } else {
                if (kind === 'draw') {
                  soundManager.playCardDraw(false);
                } else {
                  soundManager.playCardPick(false);
                }
              }
            });
          }}
          onLeastCount={() => socket?.emit('game:least-count', {
            roomCode: sState.roomCode,
            playerId: identity.id,
            playerToken: identity.token,
          })}
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
