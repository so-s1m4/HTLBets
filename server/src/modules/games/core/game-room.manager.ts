import { GameSessionStatus, GameType, Prisma, type GameSession, type User } from '../../../../generated/prisma';

import { prisma } from '../../../prisma/client';
import { HttpError } from '../../../utils/http-error';
import type {
  ActionRequest,
  BetRequest,
  GameEngine,
  GameEngineResult,
  GameResolution
} from './game-engine.interface';
import { BlackjackEngine } from '../blackjack/blackjack.engine';
import { CrashEngine } from '../crash/crash.engine';
import { MinerEngine } from '../miner/miner.engine';
import { PokerEngine } from '../poker/poker.engine';
import { RouletteEngine } from '../roulette/roulette.engine';
import { SlotsEngine } from '../slots/slots.engine';

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

type RealtimeGameType = 'ROULETTE' | 'BLACKJACK' | 'POKER' | 'MINER' | 'CRASH' | 'SLOTS';

export interface JoinGameInput {
  userId: string;
  gameType: RealtimeGameType;
  sessionId?: string;
}

export interface GameOperationInput {
  userId: string;
  gameType: RealtimeGameType;
  sessionId?: string;
  payload?: Record<string, unknown>;
}

export interface BetOperationInput extends GameOperationInput {
  amount: number;
}

export interface ActionOperationInput extends GameOperationInput {
  action: string;
}

export interface GameStateEnvelope {
  sessionId: string;
  gameType: RealtimeGameType;
  status: GameSessionStatus;
  balance: number;
  currentBet: number;
  state: Record<string, unknown>;
  outcome: GameResolution | null;
}

export const parseGameType = (value: string): RealtimeGameType => {
  const normalized = value.trim().toUpperCase();

  if (
    normalized === GameType.ROULETTE ||
    normalized === GameType.BLACKJACK ||
    normalized === GameType.POKER ||
    normalized === GameType.MINER ||
    normalized === GameType.CRASH ||
    normalized === GameType.SLOTS
  ) {
    return normalized as RealtimeGameType;
  }

  throw new HttpError(400, `Unsupported game type: ${value}`);
};

class GameRoomManager {
  private readonly engines: Record<RealtimeGameType, GameEngine<any>> = {
    [GameType.ROULETTE]: new RouletteEngine(),
    [GameType.BLACKJACK]: new BlackjackEngine(),
    [GameType.POKER]: new PokerEngine(),
    [GameType.MINER]: new MinerEngine(),
    [GameType.CRASH]: new CrashEngine(),
    [GameType.SLOTS]: new SlotsEngine()
  };

  async joinGame(input: JoinGameInput): Promise<GameStateEnvelope> {
    let user = await this.getUser(input.userId);
    let session = await this.getOrCreateSession(input);
    const engine = this.engines[input.gameType];
    const synchronized = await this.synchronizeSessionIfNeeded(user, session, engine);

    user = synchronized.user;
    session = synchronized.session;

    if (synchronized.envelope) {
      return synchronized.envelope;
    }

    return this.buildEnvelope(user.balance, session, engine);
  }

  async placeBet(input: BetOperationInput): Promise<GameStateEnvelope> {
    if (input.amount <= 0) {
      throw new HttpError(400, 'Bet amount must be greater than zero.');
    }

    let user = await this.getUser(input.userId);
    let session = await this.getOrCreateSession(input);
    const engine = this.engines[input.gameType];
    const synchronized = await this.synchronizeSessionIfNeeded(user, session, engine);

    user = synchronized.user;
    session = synchronized.session;

    if (input.amount > user.balance) {
      throw new HttpError(400, 'Insufficient demo balance for this bet.');
    }
    const result = engine.handleBet(
      {
        sessionId: session.id,
        user,
        state: session.state as Record<string, unknown>,
        currentBet: session.currentBet
      },
      {
        amount: input.amount,
        payload: input.payload
      } satisfies BetRequest
    );

    return this.persistResult(user, session, engine, result);
  }

  async performAction(input: ActionOperationInput): Promise<GameStateEnvelope> {
    let user = await this.getUser(input.userId);
    let session = await this.requireSession(input.userId, input.gameType, input.sessionId);
    const engine = this.engines[input.gameType];
    const synchronized = await this.synchronizeSessionIfNeeded(user, session, engine);

    user = synchronized.user;
    session = synchronized.session;

    if (synchronized.envelope) {
      return synchronized.envelope;
    }

    const result = engine.handleAction(
      {
        sessionId: session.id,
        user,
        state: session.state as Record<string, unknown>,
        currentBet: session.currentBet
      },
      {
        action: input.action,
        payload: input.payload
      } satisfies ActionRequest
    );

    return this.persistResult(user, session, engine, result);
  }

  async getAutoResolveAt(input: JoinGameInput): Promise<number | null> {
    const session = input.sessionId
      ? await this.requireSession(input.userId, input.gameType, input.sessionId)
      : await this.getOrCreateSession(input);
    const engine = this.engines[input.gameType];

    if (!engine.getAutoResolveAt) {
      return null;
    }

    return engine.getAutoResolveAt(session.state as Record<string, unknown>);
  }

  private async getUser(userId: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new HttpError(404, 'Authenticated user could not be found.');
    }

    return user;
  }

  private async getOrCreateSession(input: JoinGameInput): Promise<GameSession> {
    if (input.sessionId) {
      return this.requireSession(input.userId, input.gameType, input.sessionId);
    }

    const existing = await prisma.gameSession.findFirst({
      where: {
        userId: input.userId,
        gameType: input.gameType,
        status: {
          in: [GameSessionStatus.IDLE, GameSessionStatus.WAITING_ACTION]
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    if (existing) {
      return existing;
    }

    const engine = this.engines[input.gameType];

    return prisma.gameSession.create({
      data: {
        userId: input.userId,
        gameType: input.gameType,
        status: GameSessionStatus.IDLE,
        currentBet: 0,
        state: toJsonValue(engine.createInitialState())
      }
    });
  }

  private async requireSession(userId: string, gameType: RealtimeGameType, sessionId?: string): Promise<GameSession> {
    if (!sessionId) {
      throw new HttpError(400, 'Session id is required for this action.');
    }

    const session = await prisma.gameSession.findFirst({
      where: {
        id: sessionId,
        userId,
        gameType
      }
    });

    if (!session) {
      throw new HttpError(404, 'Game session was not found.');
    }

    return session;
  }

  private async persistResult(
    user: User,
    session: GameSession,
    engine: GameEngine<any>,
    result: GameEngineResult<Record<string, unknown>>
  ): Promise<GameStateEnvelope> {
    const state = toJsonValue(result.state);

    if (result.resolution) {
      const resolution = result.resolution;

      const { updatedSession, updatedUser } = await prisma.$transaction(async (tx) => {
        const updatedSession = await tx.gameSession.update({
          where: { id: session.id },
          data: {
            state,
            currentBet: result.currentBet,
            status: result.status
          }
        });

        await tx.gameHistory.create({
          data: {
            userId: user.id,
            gameType: session.gameType,
            betAmount: resolution.betAmount,
            result: resolution.result,
            balanceChange: resolution.balanceChange
          }
        });

        const updatedUser =
          resolution.balanceChange === 0
            ? await tx.user.findUniqueOrThrow({
                where: { id: user.id }
              })
            : await tx.user.update({
                where: { id: user.id },
                data: {
                  balance: {
                    increment: resolution.balanceChange
                  }
                }
              });

        return {
          updatedSession,
          updatedUser
        };
      });

      return this.buildEnvelope(updatedUser.balance, updatedSession, engine);
    }

    const updatedSession = await prisma.gameSession.update({
      where: { id: session.id },
      data: {
        state,
        currentBet: result.currentBet,
        status: result.status
      }
    });

    return this.buildEnvelope(user.balance, updatedSession, engine);
  }

  private async synchronizeSessionIfNeeded(
    user: User,
    session: GameSession,
    engine: GameEngine<any>
  ): Promise<{ user: User; session: GameSession; envelope: GameStateEnvelope | null }> {
    if (!engine.synchronize) {
      return { user, session, envelope: null };
    }

    const result = engine.synchronize({
      sessionId: session.id,
      user,
      state: session.state as Record<string, unknown>,
      currentBet: session.currentBet
    });

    if (!result) {
      return { user, session, envelope: null };
    }

    const envelope = await this.persistResult(user, session, engine, result);
    const [updatedUser, updatedSession] = await Promise.all([
      this.getUser(user.id),
      prisma.gameSession.findUniqueOrThrow({
        where: { id: session.id }
      })
    ]);

    return {
      user: updatedUser,
      session: updatedSession,
      envelope
    };
  }

  private buildEnvelope(balance: number, session: GameSession, engine: GameEngine<any>): GameStateEnvelope {
    const typedState = session.state as Record<string, unknown>;

    return {
      sessionId: session.id,
      gameType: session.gameType as RealtimeGameType,
      status: session.status,
      balance,
      currentBet: session.currentBet,
      state: engine.serializeState(typedState),
      outcome: engine.calculateResult(typedState)
    };
  }
}

export const gameRoomManager = new GameRoomManager();
