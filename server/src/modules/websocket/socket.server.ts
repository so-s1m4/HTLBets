import type { Server as HttpServer } from 'node:http';

import { Server, type Socket } from 'socket.io';

import { env } from '../../config/env';
import { prisma } from '../../prisma/client';
import {
  gameRoomManager,
  parseGameType,
  type ActionOperationInput,
  type BetOperationInput
} from '../games/core/game-room.manager';
import { pokerTableManager } from '../games/poker/poker-table.manager';
import { rouletteTableManager } from '../games/roulette/roulette-table.manager';
import { HttpError } from '../../utils/http-error';
import { socketAuth } from './socket.auth';
import { socketEvents } from './socket.events';

const getRoomName = (gameType: string, sessionId: string): string => `game:${gameType}:${sessionId}`;
const pokerRoomPrefix = 'game:POKER:';
const crashTimers = new Map<string, NodeJS.Timeout>();

export const createSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      credentials: false
    }
  });

  io.use(socketAuth);

  rouletteTableManager.onStateChange(() => {
    void emitRouletteTableState(io);
  });

  pokerTableManager.onStateChange(() => {
    void emitPokerTableState(io);
  });

  io.on('connection', (socket) => {
    socket.on(socketEvents.join, async (payload: { gameType: string; sessionId?: string }) => {
      try {
        await assertSocketUserActive(socket);
        const gameType = parseGameType(payload.gameType);

        if (gameType === 'ROULETTE') {
          const state = await rouletteTableManager.getStateForUser(socket.data.user.userId);
          const room = getRoomName(state.gameType, rouletteTableManager.getTableSessionId());
          socket.join(room);
          socket.emit(socketEvents.state, state);
          return;
        }

        if (gameType === 'POKER') {
          const requestedSessionId = payload.sessionId || pokerTableManager.getLobbySessionId();
          const state = await pokerTableManager.getStateForUser(socket.data.user.userId, requestedSessionId);
          syncPokerSocketSession(socket, state.sessionId);
          socket.emit(socketEvents.state, state);
          return;
        }

        const state = await gameRoomManager.joinGame({
          userId: socket.data.user.userId,
          gameType,
          sessionId: payload.sessionId
        });

        socket.join(getRoomName(state.gameType, state.sessionId));
        socket.emit(socketEvents.state, state);

        if (state.gameType === 'CRASH') {
          await syncCrashSchedule(io, socket.data.user.userId, state.sessionId, state.status === 'WAITING_ACTION');
        }
      } catch (error) {
        emitGameError(socket, error);
      }
    });

    socket.on(socketEvents.leave, async (payload: { gameType: string; sessionId: string }) => {
      try {
        await assertSocketUserActive(socket);
        const gameType = parseGameType(payload.gameType);

        if (gameType === 'ROULETTE') {
          socket.leave(getRoomName(gameType, rouletteTableManager.getTableSessionId()));
          return;
        }

        if (gameType === 'POKER') {
          const state = await pokerTableManager.getStateForUser(socket.data.user.userId, pokerTableManager.getLobbySessionId());
          syncPokerSocketSession(socket, state.sessionId);
          return;
        }

        socket.leave(getRoomName(gameType, payload.sessionId));
      } catch (error) {
        emitGameError(socket, error);
      }
    });

    socket.on(socketEvents.bet, async (payload: { gameType: string; sessionId?: string; amount: number; payload?: Record<string, unknown> }) => {
      try {
        await assertSocketUserActive(socket);
        const request: BetOperationInput = {
          userId: socket.data.user.userId,
          gameType: parseGameType(payload.gameType),
          sessionId: payload.sessionId,
          amount: payload.amount,
          payload: payload.payload
        };

        if (request.gameType === 'ROULETTE') {
          await rouletteTableManager.placeBet(request.userId, request.amount, request.payload);
          await emitRouletteTableState(io);
          return;
        }

        if (request.gameType === 'POKER') {
          throw new HttpError(400, 'Poker buy-ins and table joins are handled through table actions.');
          return;
        }

        const state = await gameRoomManager.placeBet(request);
        const room = getRoomName(state.gameType, state.sessionId);
        socket.join(room);
        io.to(room).emit(socketEvents.state, state);

        if (state.gameType === 'CRASH') {
          await syncCrashSchedule(io, request.userId, state.sessionId, state.status === 'WAITING_ACTION');
        }
      } catch (error) {
        emitGameError(socket, error);
      }
    });

    socket.on(
      socketEvents.action,
      async (payload: { gameType: string; sessionId: string; action: string; payload?: Record<string, unknown> }) => {
        try {
          await assertSocketUserActive(socket);
          const request: ActionOperationInput = {
            userId: socket.data.user.userId,
            gameType: parseGameType(payload.gameType),
            sessionId: payload.sessionId,
            action: payload.action,
            payload: payload.payload
          };

          if (request.gameType === 'POKER') {
            if (request.action === 'create-table') {
              const sessionId = await pokerTableManager.createTable(request.userId, request.payload);
              syncPokerSocketSession(socket, sessionId);
              await emitPokerTableState(io);
              return;
            }

            if (request.action === 'spectate-table') {
              const sessionId = await pokerTableManager.spectateTable(request.userId, request.payload);
              syncPokerSocketSession(socket, sessionId);
              await emitPokerTableState(io);
              return;
            }

            if (request.action === 'join-table') {
              const sessionId = await pokerTableManager.joinTable(request.userId, request.payload);
              syncPokerSocketSession(socket, sessionId);
              await emitPokerTableState(io);
              return;
            }

            if (request.action === 'emote') {
              await pokerTableManager.emitEmote(request.userId, request.sessionId, request.payload);
              await emitPokerTableState(io);
              return;
            }

            if (request.action === 'ready-table') {
              await pokerTableManager.readySeat(request.userId, request.sessionId);
              await emitPokerTableState(io);
              return;
            }

            if (request.action === 'leave-table' || request.action === 'return-lobby') {
              await pokerTableManager.leaveTable(request.userId);
              syncPokerSocketSession(socket, pokerTableManager.getLobbySessionId());
              await emitPokerTableState(io);
              return;
            }

            await pokerTableManager.performAction(request.userId, request.sessionId, request.action, request.payload);
            await emitPokerTableState(io);
            return;
          }

          const state = await gameRoomManager.performAction(request);
          const room = getRoomName(state.gameType, state.sessionId);
          socket.join(room);
          io.to(room).emit(socketEvents.state, state);

          if (state.gameType === 'CRASH') {
            await syncCrashSchedule(io, request.userId, state.sessionId, state.status === 'WAITING_ACTION');
          }
        } catch (error) {
          emitGameError(socket, error);
        }
      }
    );
  });

  return io;
};

const assertSocketUserActive = async (socket: Socket): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: socket.data.user.userId },
    select: { id: true, bannedAt: true }
  });

  if (!user) {
    throw new HttpError(401, 'Authentication token is invalid or expired.');
  }

  if (user.bannedAt) {
    throw new HttpError(403, 'This account has been suspended by an administrator.');
  }
};

const emitRouletteTableState = async (io: Server): Promise<void> => {
  const room = getRoomName('ROULETTE', rouletteTableManager.getTableSessionId());
  const sockets = await io.in(room).fetchSockets();

  await Promise.all(
    sockets.map(async (socket) => {
      const state = await rouletteTableManager.getStateForUser(socket.data.user.userId);
      socket.emit(socketEvents.state, state);
    })
  );
};

const emitPokerTableState = async (io: Server): Promise<void> => {
  const sockets = Array.from(io.sockets.sockets.values()).filter((socket) => typeof socket.data.pokerSessionId === 'string');

  await Promise.all(
    sockets.map(async (socket) => {
      const requestedSessionId = socket.data.pokerSessionId || pokerTableManager.getLobbySessionId();
      const state = await pokerTableManager.getStateForUser(socket.data.user.userId, requestedSessionId);
      syncPokerSocketSession(socket, state.sessionId);
      socket.emit(socketEvents.state, state);
    })
  );
};

const syncPokerSocketSession = (socket: Socket, sessionId: string) => {
  for (const room of socket.rooms) {
    if (room.startsWith(pokerRoomPrefix)) {
      socket.leave(room);
    }
  }

  socket.data.pokerSessionId = sessionId;
  socket.join(getRoomName('POKER', sessionId));
};

const clearCrashSchedule = (sessionId: string) => {
  const timer = crashTimers.get(sessionId);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  crashTimers.delete(sessionId);
};

const syncCrashSchedule = async (io: Server, userId: string, sessionId: string, isLive: boolean) => {
  clearCrashSchedule(sessionId);

  if (!isLive) {
    return;
  }

  const autoResolveAt = await gameRoomManager.getAutoResolveAt({
    userId,
    gameType: 'CRASH',
    sessionId
  });

  if (!autoResolveAt) {
    return;
  }

  const delayMs = Math.max(0, autoResolveAt - Date.now()) + 25;
  const timer = setTimeout(() => {
    crashTimers.delete(sessionId);
    void emitCrashRoomState(io, sessionId);
  }, delayMs);

  crashTimers.set(sessionId, timer);
};

const emitCrashRoomState = async (io: Server, sessionId: string) => {
  const room = getRoomName('CRASH', sessionId);
  const sockets = await io.in(room).fetchSockets();

  await Promise.all(
    sockets.map(async (socket) => {
      const state = await gameRoomManager.joinGame({
        userId: socket.data.user.userId,
        gameType: 'CRASH',
        sessionId
      });

      socket.emit(socketEvents.state, state);
      await syncCrashSchedule(io, socket.data.user.userId, sessionId, state.status === 'WAITING_ACTION');
    })
  );
};

const emitGameError = (socket: Socket, error: unknown) => {
  if (error instanceof HttpError) {
    socket.emit(socketEvents.error, { message: error.message });
    return;
  }

  if (error instanceof Error) {
    socket.emit(socketEvents.error, { message: error.message });
    return;
  }

  socket.emit(socketEvents.error, { message: 'Unexpected game error.' });
};
