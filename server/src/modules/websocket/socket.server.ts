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
import { crashRoundManager } from '../games/crash/crash-round.manager';
import { ochkoTableManager } from '../games/ochko/ochko-table.manager';
import { pokerTableManager } from '../games/poker/poker-table.manager';
import { rouletteTableManager } from '../games/roulette/roulette-table.manager';
import { HttpError } from '../../utils/http-error';
import { socketAuth } from './socket.auth';
import { socketEvents } from './socket.events';

const getRoomName = (gameType: string, sessionId: string): string => `game:${gameType}:${sessionId}`;
const pokerRoomPrefix = 'game:POKER:';
const ochkoRoomPrefix = 'game:OCHKO:';
const pokerMediaBySession = new Map<string, Map<string, { cameraEnabled: boolean; audioEnabled: boolean }>>();

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

  crashRoundManager.onStateChange(() => {
    void emitCrashTableState(io);
  });

  ochkoTableManager.onStateChange(() => {
    void emitOchkoTableState(io);
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
          syncPokerSocketSession(io, socket, state.sessionId);
          socket.emit(socketEvents.state, state);
          return;
        }

        if (gameType === 'CRASH') {
          const state = await crashRoundManager.getStateForUser(socket.data.user.userId);
          socket.join(getRoomName(state.gameType, crashRoundManager.getSessionId()));
          socket.emit(socketEvents.state, state);
          return;
        }

        if (gameType === 'OCHKO') {
          const requestedSessionId = payload.sessionId || ochkoTableManager.getLobbySessionId();
          const state = await ochkoTableManager.getStateForUser(socket.data.user.userId, requestedSessionId);
          syncOchkoSocketSession(socket, state.sessionId);
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
        await assertSocketUserActive(socket);
        const gameType = parseGameType(payload.gameType);

        if (gameType === 'ROULETTE') {
          socket.leave(getRoomName(gameType, rouletteTableManager.getTableSessionId()));
          return;
        }

        if (gameType === 'POKER') {
          const state = await pokerTableManager.getStateForUser(socket.data.user.userId, pokerTableManager.getLobbySessionId());
          syncPokerSocketSession(io, socket, state.sessionId);
          return;
        }

        if (gameType === 'CRASH') {
          socket.leave(getRoomName(gameType, crashRoundManager.getSessionId()));
          return;
        }

        if (gameType === 'OCHKO') {
          const state = await ochkoTableManager.getStateForUser(socket.data.user.userId, ochkoTableManager.getLobbySessionId());
          syncOchkoSocketSession(socket, state.sessionId);
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

        if (request.gameType === 'CRASH') {
          socket.join(getRoomName('CRASH', crashRoundManager.getSessionId()));
          await crashRoundManager.placeBet(request.userId, request.amount);
          return;
        }

        if (request.gameType === 'OCHKO') {
          throw new HttpError(400, 'Ochko room buy-ins are handled through room actions.');
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
          await assertSocketUserActive(socket);
          const request: ActionOperationInput = {
            userId: socket.data.user.userId,
            gameType: parseGameType(payload.gameType),
            sessionId: payload.sessionId,
            action: payload.action,
            payload: payload.payload
          };

          if (request.gameType === 'CRASH') {
            socket.join(getRoomName('CRASH', crashRoundManager.getSessionId()));
            await crashRoundManager.cashOut(request.userId);
            return;
          }

          if (request.gameType === 'OCHKO') {
            if (request.action === 'create-room') {
              const sessionId = await ochkoTableManager.createRoom(request.userId, request.payload);
              syncOchkoSocketSession(socket, sessionId);
              await emitOchkoTableState(io);
              return;
            }

            if (request.action === 'join-room') {
              const sessionId = await ochkoTableManager.joinRoom(request.userId, request.payload);
              syncOchkoSocketSession(socket, sessionId);
              await emitOchkoTableState(io);
              return;
            }

            if (request.action === 'ready-room') {
              await ochkoTableManager.readyRoom(request.userId, request.sessionId);
              await emitOchkoTableState(io);
              return;
            }

            if (request.action === 'leave-room' || request.action === 'return-lobby') {
              await ochkoTableManager.leaveRoom(request.userId);
              syncOchkoSocketSession(socket, ochkoTableManager.getLobbySessionId());
              await emitOchkoTableState(io);
              return;
            }

            await ochkoTableManager.performAction(request.userId, request.sessionId, request.action, request.payload);
            await emitOchkoTableState(io);
            return;
          }

          if (request.gameType === 'POKER') {
            if (request.action === 'create-table') {
              const sessionId = await pokerTableManager.createTable(request.userId, request.payload);
              syncPokerSocketSession(io, socket, sessionId);
              await emitPokerTableState(io);
              return;
            }

            if (request.action === 'spectate-table') {
              const sessionId = await pokerTableManager.spectateTable(request.userId, request.payload);
              syncPokerSocketSession(io, socket, sessionId);
              await emitPokerTableState(io);
              return;
            }

            if (request.action === 'join-table') {
              const sessionId = await pokerTableManager.joinTable(request.userId, request.payload);
              syncPokerSocketSession(io, socket, sessionId);
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
              syncPokerSocketSession(io, socket, pokerTableManager.getLobbySessionId());
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

    socket.on(
      socketEvents.pokerMediaStatus,
      async (payload: { sessionId: string; cameraEnabled: boolean; audioEnabled: boolean }) => {
        try {
          await assertSocketUserActive(socket);
          await assertPokerMediaPublisher(socket, payload.sessionId);
          setPokerMediaStatus(io, payload.sessionId, socket.data.user.userId, payload.cameraEnabled, payload.audioEnabled);
        } catch (error) {
          emitGameError(socket, error);
        }
      }
    );

    socket.on(
      socketEvents.pokerMediaSignal,
      async (payload: {
        sessionId: string;
        targetUserId: string;
        description?: Record<string, unknown>;
        candidate?: Record<string, unknown>;
      }) => {
        try {
          await assertSocketUserActive(socket);
          await assertPokerMediaTableParticipant(socket, payload.sessionId);

          if (!payload.targetUserId) {
            throw new HttpError(400, 'Missing poker media target.');
          }

          const room = getRoomName('POKER', payload.sessionId);
          const sockets = await io.in(room).fetchSockets();
          const targetSockets = sockets.filter((targetSocket) => targetSocket.data.user.userId === payload.targetUserId);

          await Promise.all(
            targetSockets.map(async (targetSocket) => {
              targetSocket.emit(socketEvents.pokerMediaSignal, {
                sessionId: payload.sessionId,
                sourceUserId: socket.data.user.userId,
                description: payload.description,
                candidate: payload.candidate
              });
            })
          );
        } catch (error) {
          emitGameError(socket, error);
        }
      }
    );

    socket.on('disconnect', () => {
      const sessionId = typeof socket.data.pokerSessionId === 'string' ? socket.data.pokerSessionId : null;
      if (sessionId) {
        clearPokerMediaStatus(io, sessionId, socket.data.user.userId);
      }
    });
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
      if (state.state.kind === 'table' && !state.state.isSeated) {
        clearPokerMediaStatus(io, state.state.tableId, socket.data.user.userId);
      }
      syncPokerSocketSession(io, socket, state.sessionId);
      socket.emit(socketEvents.state, state);
    })
  );
};

const syncPokerSocketSession = (io: Server, socket: Socket, sessionId: string) => {
  const previousSessionId = typeof socket.data.pokerSessionId === 'string' ? socket.data.pokerSessionId : null;

  if (previousSessionId && previousSessionId !== sessionId) {
    clearPokerMediaStatus(io, previousSessionId, socket.data.user.userId);
  }

  for (const room of socket.rooms) {
    if (room.startsWith(pokerRoomPrefix)) {
      socket.leave(room);
    }
  }

  socket.data.pokerSessionId = sessionId;
  socket.join(getRoomName('POKER', sessionId));
  emitPokerMediaSnapshot(socket, sessionId);
};

const syncOchkoSocketSession = (socket: Socket, sessionId: string) => {
  for (const room of socket.rooms) {
    if (room.startsWith(ochkoRoomPrefix)) {
      socket.leave(room);
    }
  }

  socket.data.ochkoSessionId = sessionId;
  socket.join(getRoomName('OCHKO', sessionId));
};

const emitCrashTableState = async (io: Server) => {
  const room = getRoomName('CRASH', crashRoundManager.getSessionId());
  const sockets = await io.in(room).fetchSockets();

  await Promise.all(
    sockets.map(async (socket) => {
      const state = await crashRoundManager.getStateForUser(socket.data.user.userId);
      socket.emit(socketEvents.state, state);
    })
  );
};

const emitOchkoTableState = async (io: Server) => {
  const sockets = Array.from(io.sockets.sockets.values()).filter((socket) => typeof socket.data.ochkoSessionId === 'string');

  await Promise.all(
    sockets.map(async (socket) => {
      const requestedSessionId = socket.data.ochkoSessionId || ochkoTableManager.getLobbySessionId();
      const state = await ochkoTableManager.getStateForUser(socket.data.user.userId, requestedSessionId);
      syncOchkoSocketSession(socket, state.sessionId);
      socket.emit(socketEvents.state, state);
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

const assertPokerMediaPublisher = async (socket: Socket, sessionId: string) => {
  const tableState = await assertPokerMediaTableParticipant(socket, sessionId);
  if (!tableState.isSeated) {
    throw new HttpError(403, 'Take a seat to turn on camera or microphone.');
  }
};

const assertPokerMediaTableParticipant = async (socket: Socket, sessionId: string) => {
  if (!sessionId || socket.data.pokerSessionId !== sessionId) {
    throw new HttpError(400, 'Reconnect to the active poker table and try again.');
  }

  const state = await pokerTableManager.getStateForUser(socket.data.user.userId, sessionId);
  if (state.state.kind !== 'table') {
    throw new HttpError(403, 'Join the active poker table to watch live players.');
  }

  return state.state;
};

const setPokerMediaStatus = (
  io: Server,
  sessionId: string,
  userId: string,
  cameraEnabled: boolean,
  audioEnabled: boolean
) => {
  const sessionState = pokerMediaBySession.get(sessionId) || new Map<string, { cameraEnabled: boolean; audioEnabled: boolean }>();

  if (cameraEnabled || audioEnabled) {
    sessionState.set(userId, { cameraEnabled, audioEnabled });
    pokerMediaBySession.set(sessionId, sessionState);
  } else {
    sessionState.delete(userId);
    if (sessionState.size === 0) {
      pokerMediaBySession.delete(sessionId);
    }
  }

  io.to(getRoomName('POKER', sessionId)).emit(socketEvents.pokerMediaStatus, {
    sessionId,
    sourceUserId: userId,
    cameraEnabled,
    audioEnabled
  });
};

const clearPokerMediaStatus = (io: Server, sessionId: string, userId: string) => {
  const sessionState = pokerMediaBySession.get(sessionId);
  if (!sessionState?.has(userId)) {
    return;
  }

  sessionState.delete(userId);
  if (sessionState.size === 0) {
    pokerMediaBySession.delete(sessionId);
  }

  io.to(getRoomName('POKER', sessionId)).emit(socketEvents.pokerMediaStatus, {
    sessionId,
    sourceUserId: userId,
    cameraEnabled: false,
    audioEnabled: false
  });
};

const emitPokerMediaSnapshot = (socket: Socket, sessionId: string) => {
  const sessionState = pokerMediaBySession.get(sessionId);
  if (!sessionState?.size) {
    return;
  }

  socket.emit(socketEvents.pokerMediaSnapshot, {
    sessionId,
    participants: Array.from(sessionState.entries()).map(([sourceUserId, status]) => ({
      sessionId,
      sourceUserId,
      cameraEnabled: status.cameraEnabled,
      audioEnabled: status.audioEnabled
    }))
  });
};
