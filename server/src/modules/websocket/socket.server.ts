import type { Server as HttpServer } from 'node:http';

import { Server, type Socket } from 'socket.io';

import { env } from '../../config/env';
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
      } catch (error) {
        emitGameError(socket, error);
      }
    });

    socket.on(socketEvents.leave, async (payload: { gameType: string; sessionId: string }) => {
      try {
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
      } catch (error) {
        emitGameError(socket, error);
      }
    });

    socket.on(
      socketEvents.action,
      async (payload: { gameType: string; sessionId: string; action: string; payload?: Record<string, unknown> }) => {
        try {
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
        } catch (error) {
          emitGameError(socket, error);
        }
      }
    );
  });

  return io;
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
