import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { GameEngine } from './src/game/engine.js';
import { PlayerInfo, ClientGameState } from './src/types/game.js';

export interface Room {
  code: string;
  hostId: string;
  expectedPlayers: number;
  totalRounds: number;
  players: Map<string, PlayerInfo>;
  game?: GameEngine;
}

export const rooms = new Map<string, Room>();

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LC-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  'https://leastcountin.netlify.app',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, server-to-server, health probes)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow localhost and 127.0.0.1 on any port for local development
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

export interface StoredProfile {
  id: string;
  token: string;
  name: string;
  updatedAt: number;
}

export const playerProfiles = new Map<string, StoredProfile>();

// Produce sanitized, server-authoritative state for a given viewing player
export function getSanitizedGameState(room: Room, viewerId: string): ClientGameState {
  const playersList: PlayerInfo[] = Array.from(room.players.values()).map(p => ({
    id: p.id,
    socketId: p.socketId,
    name: p.name,
    ready: p.ready,
    connected: p.connected !== false,
  }));
  const g = room.game;

  let status: ClientGameState['status'] = 'WAITING_FOR_PLAYERS';
  if (g) {
    status = g.phase === 'GAME_COMPLETE' ? 'FINISHED' : 'IN_GAME';
  } else if (room.players.size === room.expectedPlayers) {
    status = 'LOBBY';
  }

  let gameData: ClientGameState['game'] = undefined;

  if (g) {
    const myHand = g.hands.get(viewerId) || [];
    const opponents = playersList
      .filter(p => p.id !== viewerId)
      .map(p => ({
        id: p.id,
        name: p.name,
        cardCount: (g.hands.get(p.id) || []).length,
        connected: p.connected !== false,
      }));

    let formattedNotice = g.roundNotice;
    if (formattedNotice) {
      for (const p of room.players.values()) {
        if (p.id && p.name && formattedNotice.includes(p.id)) {
          formattedNotice = formattedNotice.split(p.id).join(p.name);
        }
      }
    }

    gameData = {
      setupStage: g.setupStage,
      setupActorId: g.setupActorId,
      phase: g.phase,
      activePlayerId: g.activePlayerId,
      startingPlayerId: g.startingPlayerId,
      jokerRank: g.jokerRank,
      openCard: g.openCard,
      discardTop: g.discardPile.at(-1),
      discardPile: g.discardPile,
      drawPileCount: g.drawPile.length,
      myHand,
      opponents,
      completedRoundScores: g.completedRoundScores,
      roundNotice: formattedNotice,
    };
  }

  return {
    roomCode: room.code,
    hostId: room.hostId,
    expectedPlayers: room.expectedPlayers,
    totalRounds: room.totalRounds,
    currentRound: g ? g.roundNumber : 1,
    status,
    players: playersList,
    game: gameData,
  };
}

export function broadcastRoomState(room: Room) {
  for (const player of room.players.values()) {
    if (player.socketId && player.connected !== false) {
      const sanitizedState = getSanitizedGameState(room, player.id);
      io.to(player.socketId).emit('game:state', sanitizedState);
    }
  }
}

function ack(cb: any, error?: string, extra?: any) {
  if (typeof cb === 'function') {
    cb(error ? { error } : { ok: true, ...extra });
  }
}

export function getPlayerAndRoomBySocketId(socketId: string): { room?: Room; player?: PlayerInfo } {
  for (const room of rooms.values()) {
    for (const player of room.players.values()) {
      if (player.socketId === socketId) {
        return { room, player };
      }
    }
  }
  return {};
}

export function getPlayerAndRoom(
  socket: any,
  roomCode?: string,
  playerId?: string,
  playerToken?: string
): { room?: Room; player?: PlayerInfo } {
  // First attempt: match by active socket ID
  const found = getPlayerAndRoomBySocketId(socket.id);
  if (found.room && found.player) {
    return found;
  }

  // Fallback: match by room code and validated player ID
  if (roomCode && playerId) {
    const code = String(roomCode).toUpperCase().trim();
    const room = rooms.get(code);
    if (room && room.players.has(playerId)) {
      const player = room.players.get(playerId)!;
      if (!player.token || !playerToken || player.token === playerToken) {
        player.socketId = socket.id;
        player.connected = true;
        if ((player as any).disconnectTimeout) {
          clearTimeout((player as any).disconnectTimeout);
          delete (player as any).disconnectTimeout;
        }
        return { room, player };
      }
    }
  }
  return {};
}

io.on('connection', socket => {
  // Profile update event
  socket.on('profile:update', (data: { playerId: string; playerToken: string; name: string }, cb: any) => {
    const name = (data?.name || '').trim();
    if (!name || name.length < 2 || name.length > 20) {
      return ack(cb, 'Display name must be between 2 and 20 characters.');
    }
    const pid = (data?.playerId || '').trim();
    const token = (data?.playerToken || '').trim();
    if (!pid || !token) {
      return ack(cb, 'Invalid player identity.');
    }

    const existing = playerProfiles.get(pid);
    if (existing && existing.token !== token) {
      return ack(cb, 'Unauthorized: Player token mismatch.');
    }

    playerProfiles.set(pid, {
      id: pid,
      token,
      name,
      updatedAt: Date.now(),
    });

    // Sync updated name across all active rooms where this player is seated
    for (const room of rooms.values()) {
      if (room.players.has(pid)) {
        const p = room.players.get(pid)!;
        p.name = name;
        if (room.game) {
          room.game.playerNames.set(pid, name);
        }
        broadcastRoomState(room);
      }
    }

    ack(cb, undefined, { name });
  });

  socket.on('room:create', (data: { name: string; expectedPlayers: number; totalRounds: number; playerId?: string; playerToken?: string }, cb: any) => {
    const name = (data.name || '').trim();
    if (!name || name.length < 2 || name.length > 20) {
      return ack(cb, 'Please enter a valid display name (2-20 characters).');
    }

    const rawPlayers = Number(data.expectedPlayers);
    if (isNaN(rawPlayers) || rawPlayers < 2) {
      return ack(cb, 'At least 2 players are required.');
    }
    const rawRounds = Number(data.totalRounds);
    if (isNaN(rawRounds) || rawRounds < 1) {
      return ack(cb, 'At least 1 round is required.');
    }

    const expectedPlayers = Math.max(2, rawPlayers);
    const totalRounds = Math.max(1, rawRounds);
    const code = generateRoomCode();
    const playerId = (data.playerId || '').trim() || (`p_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`);
    const playerToken = (data.playerToken || '').trim() || (`tok_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`);

    playerProfiles.set(playerId, { id: playerId, token: playerToken, name, updatedAt: Date.now() });

    const player: PlayerInfo = {
      id: playerId,
      socketId: socket.id,
      name,
      ready: true,
      connected: true,
      token: playerToken,
    };

    const room: Room = {
      code,
      hostId: playerId,
      expectedPlayers,
      totalRounds,
      players: new Map([[playerId, player]]),
    };

    rooms.set(code, room);
    socket.join(code);
    ack(cb, undefined, { roomCode: code, playerId, playerToken });
    broadcastRoomState(room);
  });

  socket.on('room:join', (data: { roomCode: string; name: string; playerId?: string; playerToken?: string }, cb: any) => {
    const name = (data.name || '').trim();
    if (!name || name.length < 2 || name.length > 20) {
      return ack(cb, 'Please enter a valid display name (2-20 characters).');
    }

    const code = String(data.roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) return ack(cb, 'Room not found. Check the room code.');

    const playerId = (data.playerId || '').trim();
    const playerToken = (data.playerToken || '').trim();

    // 1. Try matching by stable playerId (reconnection or returning player)
    if (playerId && room.players.has(playerId)) {
      const existing = room.players.get(playerId)!;
      // Security check: validate player token if set
      if (existing.token && playerToken && existing.token !== playerToken) {
        return ack(cb, 'Unauthorized: Invalid player token for this seat.');
      }
      if (!existing.token && playerToken) {
        existing.token = playerToken;
      }
      existing.socketId = socket.id;
      existing.connected = true;
      if (name) existing.name = name;
      if (room.game) room.game.playerNames.set(playerId, name);
      if ((existing as any).disconnectTimeout) {
        clearTimeout((existing as any).disconnectTimeout);
        delete (existing as any).disconnectTimeout;
      }
      socket.join(code);
      ack(cb, undefined, { roomCode: code, playerId: existing.id, playerToken: existing.token });
      broadcastRoomState(room);
      return;
    }

    // 2. Reject new players if game has already started and they are not seated
    if (room.game && room.game.phase !== 'LOBBY' && room.game.phase !== 'GAME_COMPLETE') {
      return ack(cb, 'Game has already started in this room.');
    }

    if (room.players.size >= room.expectedPlayers) {
      return ack(cb, 'Room is full.');
    }

    const finalPlayerId = playerId || `p_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const finalToken = playerToken || `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`;

    playerProfiles.set(finalPlayerId, { id: finalPlayerId, token: finalToken, name, updatedAt: Date.now() });

    const player: PlayerInfo = {
      id: finalPlayerId,
      socketId: socket.id,
      name,
      ready: false,
      connected: true,
      token: finalToken,
    };

    room.players.set(finalPlayerId, player);
    socket.join(code);
    ack(cb, undefined, { roomCode: code, playerId: finalPlayerId, playerToken: finalToken });
    broadcastRoomState(room);
  });

  socket.on('room:reconnect', (data: { roomCode: string; name?: string; playerId?: string; playerToken?: string }, cb: any) => {
    const code = String(data?.roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ack(cb, 'Room no longer exists.');

    const playerId = (data?.playerId || '').trim();
    const playerToken = (data?.playerToken || '').trim();

    if (!playerId || !room.players.has(playerId)) {
      return ack(cb, 'Player session expired or not found in room.');
    }

    const player = room.players.get(playerId)!;

    // Security check: validate token
    if (player.token && playerToken && player.token !== playerToken) {
      return ack(cb, 'Unauthorized: Invalid player token.');
    }
    if (!player.token && playerToken) {
      player.token = playerToken;
    }

    // Cancel pending disconnect grace period removal
    if ((player as any).disconnectTimeout) {
      clearTimeout((player as any).disconnectTimeout);
      delete (player as any).disconnectTimeout;
    }

    player.socketId = socket.id;
    player.connected = true;
    if (data.name && data.name.trim()) {
      player.name = data.name.trim();
      if (room.game) {
        room.game.playerNames.set(player.id, player.name);
      }
    }

    socket.join(code);
    ack(cb, undefined, { roomCode: code, playerId: player.id });
    broadcastRoomState(room);
  });

  socket.on('room:leave', (data: { roomCode?: string; playerId?: string; playerToken?: string }, cb: any) => {
    const { room, player } = getPlayerAndRoom(socket, data?.roomCode, data?.playerId, data?.playerToken);
    if (room && player) {
      if ((player as any).disconnectTimeout) {
        clearTimeout((player as any).disconnectTimeout);
        delete (player as any).disconnectTimeout;
      }
      room.players.delete(player.id);
      if (room.players.size === 0) {
        rooms.delete(room.code);
      } else {
        if (room.hostId === player.id) {
          const nextHost = Array.from(room.players.values()).find(p => p.connected !== false) || Array.from(room.players.values())[0];
          if (nextHost) room.hostId = nextHost.id;
        }
        broadcastRoomState(room);
      }
    }
    ack(cb);
  });

  socket.on('room:ready', (data: { roomCode: string; playerId?: string; playerToken?: string }, cb: any) => {
    const { room, player } = getPlayerAndRoom(socket, data?.roomCode, data?.playerId, data?.playerToken);
    if (room && player) {
      player.ready = !player.ready;
      ack(cb);
      broadcastRoomState(room);
    }
  });

  socket.on('room:start', (data: { roomCode: string; playerId?: string; playerToken?: string }, cb: any) => {
    const { room, player } = getPlayerAndRoom(socket, data?.roomCode, data?.playerId, data?.playerToken);
    if (!room) return ack(cb, 'Room not found.');
    const isHostPlayer = player && (room.hostId === player.id || Array.from(room.players.values())[0]?.id === player.id);
    if (!player || !isHostPlayer) return ack(cb, 'Only the room host can start the game.');
    if (room.players.size !== room.expectedPlayers) return ack(cb, 'Waiting for all players to join.');

    const hostPlayer = room.players.get(room.hostId) || Array.from(room.players.values())[0];
    if (hostPlayer) hostPlayer.ready = true;

    const nonHostReady = Array.from(room.players.values())
      .filter((p, idx) => idx !== 0 && p.id !== room.hostId)
      .every(p => p.ready);

    if (!nonHostReady) return ack(cb, 'All players must click READY before starting.');

    const playerIds = Array.from(room.players.keys());
    const playerNamesMap = new Map<string, string>();
    for (const p of room.players.values()) {
      playerNamesMap.set(p.id, p.name);
    }
    room.game = new GameEngine(playerIds, room.totalRounds, undefined, playerNamesMap);

    ack(cb);
    broadcastRoomState(room);
  });

  socket.on('game:setup-shuffle', (data: { roomCode: string; playerId?: string; playerToken?: string }, cb: any) => {
    const { room, player } = getPlayerAndRoom(socket, data?.roomCode, data?.playerId, data?.playerToken);
    if (!room || !room.game || !player) return ack(cb, 'Game has not started.');

    try {
      room.game.shuffleAndDistribute(player.id);
      ack(cb);
      broadcastRoomState(room);
    } catch (err) {
      ack(cb, (err as Error).message);
    }
  });

  socket.on('game:setup-open-card', (data: { roomCode: string; playerId?: string; playerToken?: string }, cb: any) => {
    const { room, player } = getPlayerAndRoom(socket, data?.roomCode, data?.playerId, data?.playerToken);
    if (!room || !room.game || !player) return ack(cb, 'Game has not started.');

    try {
      room.game.pickOpenCard(player.id);
      ack(cb);
      broadcastRoomState(room);
    } catch (err) {
      ack(cb, (err as Error).message);
    }
  });

  socket.on('game:setup-joker-card', (data: { roomCode: string; playerId?: string; playerToken?: string }, cb: any) => {
    const { room, player } = getPlayerAndRoom(socket, data?.roomCode, data?.playerId, data?.playerToken);
    if (!room || !room.game || !player) return ack(cb, 'Game has not started.');

    try {
      room.game.pickJokerCard(player.id);
      ack(cb);
      broadcastRoomState(room);
    } catch (err) {
      ack(cb, (err as Error).message);
    }
  });

  socket.on('game:drop', (data: { roomCode: string; cardIds: string[]; playerId?: string; playerToken?: string }, cb: any) => {
    const { room, player } = getPlayerAndRoom(socket, data?.roomCode, data?.playerId, data?.playerToken);
    if (!room || !room.game || !player) return ack(cb, 'Game has not started.');

    try {
      room.game.drop(player.id, data.cardIds);
      ack(cb);
      broadcastRoomState(room);
    } catch (err) {
      ack(cb, (err as Error).message);
    }
  });

  socket.on('game:acquire', (data: { roomCode: string; kind: 'draw' | 'pick'; playerId?: string; playerToken?: string }, cb: any) => {
    const { room, player } = getPlayerAndRoom(socket, data?.roomCode, data?.playerId, data?.playerToken);
    if (!room || !room.game || !player) return ack(cb, 'Game has not started.');

    try {
      room.game.acquire(player.id, data.kind);
      ack(cb);
      broadcastRoomState(room);
    } catch (err) {
      ack(cb, (err as Error).message);
    }
  });

  socket.on('game:least-count', (data: { roomCode: string; playerId?: string; playerToken?: string }, cb: any) => {
    const { room, player } = getPlayerAndRoom(socket, data?.roomCode, data?.playerId, data?.playerToken);
    if (!room || !room.game || !player) return ack(cb, 'Game has not started.');

    try {
      room.game.leastCount(player.id);
      ack(cb);
      broadcastRoomState(room);
    } catch (err) {
      ack(cb, (err as Error).message);
    }
  });

  socket.on('game:next-round', (data: { roomCode: string; playerId?: string; playerToken?: string }, cb: any) => {
    const { room } = getPlayerAndRoom(socket, data?.roomCode, data?.playerId, data?.playerToken);
    if (!room || !room.game) return ack(cb, 'Game has not started.');

    try {
      if (room.game.phase === 'ROUND_COMPLETE') {
        room.game.startRound(room.game.roundNumber + 1);
        ack(cb);
        broadcastRoomState(room);
      }
    } catch (err) {
      ack(cb, (err as Error).message);
    }
  });

  socket.on('disconnect', () => {
    const { room, player } = getPlayerAndRoomBySocketId(socket.id);
    if (room && player) {
      player.connected = false;
      broadcastRoomState(room);

      if ((player as any).disconnectTimeout) {
        clearTimeout((player as any).disconnectTimeout);
      }

      // Configurable disconnect grace period: 60 seconds
      (player as any).disconnectTimeout = setTimeout(() => {
        if (player.connected === false) {
          room.players.delete(player.id);
          delete (player as any).disconnectTimeout;

          const remainingPlayers = Array.from(room.players.values());
          if (remainingPlayers.length === 0) {
            rooms.delete(room.code);
          } else {
            if (room.hostId === player.id) {
              const nextHost = remainingPlayers.find(p => p.connected !== false) || remainingPlayers[0];
              if (nextHost) room.hostId = nextHost.id;
            }
            broadcastRoomState(room);
          }
        }
      }, 60000);
    }
  });
});

const PORT = Number(process.env.PORT) || 3001;
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Least Count server listening on 0.0.0.0:${PORT}`);
  });
}

export { app, httpServer, io };
