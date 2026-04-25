import type { Server as HttpServer } from 'node:http';

import { Server, type Socket } from 'socket.io';

import { env } from '../../config/env';
import {
  gameRoomManager,
  parseGameType,
  type ActionOperationInput,
  type BetOperationInput
} from '../games/core/game-room.manager';
import { HttpError } from '../../utils/http-error';
import { socketAuth } from './socket.auth';
import { socketEvents } from './socket.events';

const getRoomName = (gameType: string, sessionId: string): string => `game:${gameType}:${sessionId}`;

export const createSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      credentials: false
    }
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    socket.on(socketEvents.join, async (payload: { gameType: string; sessionId?: string }) => {
      try {
        const gameType = parseGameType(payload.gameType);
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

    socket.on(socketEvents.leave, (payload: { gameType: string; sessionId: string }) => {
      try {
        const gameType = parseGameType(payload.gameType);
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
