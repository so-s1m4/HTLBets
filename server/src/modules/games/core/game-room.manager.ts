import { GameSessionStatus, GameType, Prisma, type GameSession, type User } from '@prisma/client';

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
import { PokerEngine } from '../poker/poker.engine';
import { RouletteEngine } from '../roulette/roulette.engine';

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export interface JoinGameInput {
  userId: string;
  gameType: GameType;
  sessionId?: string;
}

export interface GameOperationInput {
  userId: string;
  gameType: GameType;
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
  gameType: GameType;
  status: GameSessionStatus;
  balance: number;
  currentBet: number;
  state: Record<string, unknown>;
  outcome: GameResolution | null;
}

export const parseGameType = (value: string): GameType => {
  const normalized = value.trim().toUpperCase();

  if (normalized === GameType.ROULETTE || normalized === GameType.BLACKJACK || normalized === GameType.POKER) {
    return normalized as GameType;
  }

  throw new HttpError(400, `Unsupported game type: ${value}`);
};

class GameRoomManager {
  private readonly engines: Record<GameType, GameEngine<any>> = {
    [GameType.ROULETTE]: new RouletteEngine(),
    [GameType.BLACKJACK]: new BlackjackEngine(),
    [GameType.POKER]: new PokerEngine()
  };

  async joinGame(input: JoinGameInput): Promise<GameStateEnvelope> {
    const user = await this.getUser(input.userId);
    const session = await this.getOrCreateSession(input);
    const engine = this.engines[input.gameType];

    return this.buildEnvelope(user.balance, session, engine);
  }

  async placeBet(input: BetOperationInput): Promise<GameStateEnvelope> {
    const user = await this.getUser(input.userId);

    if (input.amount <= 0) {
      throw new HttpError(400, 'Bet amount must be greater than zero.');
    }

    if (input.amount > user.balance) {
      throw new HttpError(400, 'Insufficient demo balance for this bet.');
    }

    const session = await this.getOrCreateSession(input);
    const engine = this.engines[input.gameType];
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
    const user = await this.getUser(input.userId);
    const session = await this.requireSession(input.userId, input.gameType, input.sessionId);
    const engine = this.engines[input.gameType];
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

  private async requireSession(userId: string, gameType: GameType, sessionId?: string): Promise<GameSession> {
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

  private buildEnvelope(balance: number, session: GameSession, engine: GameEngine<any>): GameStateEnvelope {
    const typedState = session.state as Record<string, unknown>;

    return {
      sessionId: session.id,
      gameType: session.gameType,
      status: session.status,
      balance,
      currentBet: session.currentBet,
      state: engine.serializeState(typedState),
      outcome: engine.calculateResult(typedState)
    };
  }
}

export const gameRoomManager = new GameRoomManager();
