import { useEffect, useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { io, Socket } from 'socket.io-client';
import { ClientGameState, PlayerInfo, CardsPerPlayer } from './types/game';
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
import { playerProfileManager, PlayerProfile } from './services/playerProfile';

import './styles/styles.css';

// ─── URL Navigation helpers ───────────────────────────────────────────────────

type ScreenKey = 'home' | 'friends' | 'lobby' | 'game' | 'system' | 'settings' | 'rules' | 'about';

const ROUTE_TO_SCREEN: Record<string, ScreenKey> = {
  '/': 'home',
  '/home': 'home',
  '/bot': 'system',
  '/rooms': 'friends',
  '/rules': 'rules',
  '/settings': 'settings',
  '/about': 'about',
};

const SCREEN_TO_ROUTE: Partial<Record<ScreenKey, string>> = {
  home: '/home',
  system: '/bot',
  friends: '/rooms',
  rules: '/rules',
  settings: '/settings',
  about: '/about',
};

function getScreenForPath(path: string): ScreenKey | null {
  const pathNoQuery = path.split('?')[0].replace(/\/+$/, '') || '/';
  // Handle /room/:code and /game/:code
  if (pathNoQuery.startsWith('/room/') || pathNoQuery.startsWith('/game/')) return null; // handled separately
  return ROUTE_TO_SCREEN[pathNoQuery] ?? null;
}

function pushRoute(screen: ScreenKey, roomCode?: string) {
  if (screen === 'lobby' || screen === 'game') {
    if (roomCode) {
      const targetPath = `/${screen === 'lobby' ? 'room' : 'game'}/${roomCode}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ screen, roomCode }, '', targetPath);
      }
    }
    return;
  }
  const route = SCREEN_TO_ROUTE[screen];
  if (route && window.location.pathname !== route) {
    window.history.pushState({ screen }, '', route);
  }
}

function replaceRoute(screen: ScreenKey, roomCode?: string) {
  if (screen === 'lobby' || screen === 'game') {
    if (roomCode) {
      window.history.replaceState({ screen, roomCode }, '', `/${screen === 'lobby' ? 'room' : 'game'}/${roomCode}`);
    }
    return;
  }
  const route = SCREEN_TO_ROUTE[screen];
  if (route) {
    window.history.replaceState({ screen }, '', route);
  }
}

// ─── App Component ────────────────────────────────────────────────────────────

export function App() {
  const [screen, setScreenState] = useState<ScreenKey>('home');
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
  const [soundEnabled, setSoundEnabled] = useState(() => soundManager.isEnabled());

  useEffect(() => {
    return soundManager.subscribe(enabled => setSoundEnabled(enabled));
  }, []);

  // Socket & Room State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sState, setSState] = useState<ClientGameState | null>(null);

  // System Mode Local Engine State
  const systemEngineRef = useRef<GameEngine | null>(null);
  const [systemStateTick, setSystemStateTick] = useState(0);

  // ── Navigation with URL sync ──────────────────────────────────────────────

  const setScreen = useCallback((newScreen: ScreenKey, roomCode?: string, replace = false) => {
    setScreenState(newScreen);
    if (replace) {
      replaceRoute(newScreen, roomCode);
    } else {
      pushRoute(newScreen, roomCode);
    }
  }, []);

  // Listen for browser Back/Forward
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const path = window.location.pathname;
      const pathNoQuery = path.split('?')[0].replace(/\/+$/, '') || '/';

      if (pathNoQuery.startsWith('/room/') || pathNoQuery.startsWith('/game/')) {
        // Stay on current screen (lobby/game) — the room code in the URL is cosmetic
        return;
      }

      const targetScreen = getScreenForPath(path);
      if (targetScreen) {
        setScreenState(targetScreen);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ── Initialization & Session Restore ─────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room')?.toUpperCase().trim();

    const currentProfile = playerProfileManager.getProfile();
    if (currentProfile?.name) {
      setName(currentProfile.name);
    }

    // Set initial URL if on root
    const currentPath = window.location.pathname;
    if (currentPath === '/' || currentPath === '') {
      window.history.replaceState({ screen: 'home' }, '', '/home');
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
        setScreenState('system');
        replaceRoute('system');
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
          setScreenState('home');
          replaceRoute('home');
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
            setScreenState('friends');
            replaceRoute('friends');
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
        setScreenState('friends');
        replaceRoute('friends');
      }
      return;
    }

    // 4. First-time visitor without profile
    if (!currentProfile) {
      setIsFirstTimeProfile(true);
      setShowProfileModal(true);
    }

    // Set URL to match the initial screen
    const screenFromPath = getScreenForPath(currentPath);
    if (screenFromPath) {
      setScreenState(screenFromPath);
    } else {
      replaceRoute('home');
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
            setScreenState('home');
            replaceRoute('home');
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
        setScreenState('game');
        replaceRoute('game', newState.roomCode);
      } else if (newState.status === 'LOBBY' || newState.status === 'WAITING_FOR_PLAYERS') {
        setScreenState('lobby');
        replaceRoute('lobby', newState.roomCode);
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

  // ── Friends Mode Actions ──────────────────────────────────────────────────

  const handleCreateRoom = (userName: string, players: number, rounds: number, cardsPerPlayer: CardsPerPlayer, scoreVisible: boolean) => {
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
      cardsPerPlayer,
      scoreVisible,
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

  const handleSetScoreVisibility = (visible: boolean) => {
    if (!sState || !socket) return;
    const identity = playerProfileManager.getOrCreateIdentity();
    socket.emit('room:set-score-visibility', {
      roomCode: sState.roomCode,
      playerId: identity.id,
      playerToken: identity.token,
      visible,
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
    setScreen('home', undefined, true);
  };

  // ── System Bot Mode Actions ───────────────────────────────────────────────

  const startSystemMode = () => {
    const humanId = 'human-player';
    const botId = 'system-bot';
    const engine = new GameEngine([humanId, botId], 5);
    systemEngineRef.current = engine;
    setNotice('Game setup ready. Perform setup actions to start!');
    setScreen('system', undefined, false);
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

  // ── Render ────────────────────────────────────────────────────────────────

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
    const isHost = myPlayerId === sState.hostId;

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
          isHost={isHost}
          scoreVisible={sState.scoreVisible}
          soundEnabled={soundEnabled}
          onSetScoreVisibility={handleSetScoreVisibility}
          onSoundChange={enabled => soundManager.setSoundEnabled(enabled)}
          onDrop={ids => {
            socket?.emit('game:drop', {
              roomCode: sState.roomCode,
              cardIds: ids,
              playerId: identity.id,
              playerToken: identity.token,
            }, (res: any) => {
              if (res?.error) {
                setNotice(res.error);
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
            isHost={isHost}
            scoreVisible={sState.scoreVisible}
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
          isHost={true}
          scoreVisible={true}
          soundEnabled={soundEnabled}
          onSetScoreVisibility={() => {}}
          onSoundChange={enabled => soundManager.setSoundEnabled(enabled)}
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
            isHost={true}
            scoreVisible={true}
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
