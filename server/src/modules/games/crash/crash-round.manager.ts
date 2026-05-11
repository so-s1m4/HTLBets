import { GameSessionStatus, GameType } from '../../../../generated/prisma';

import { prisma } from '../../../prisma/client';
import type { GameResolution } from '../core/game-engine.interface';
import { HttpError } from '../../../utils/http-error';
import { fromDbAmount, toDbAmount } from '../../../utils/money';

type CrashPhase = 'betting' | 'live' | 'resolved';
type CrashPlayerStatus = 'queued' | 'live' | 'cashed-out' | 'busted';

interface CrashPlayerEntry {
  userId: string;
  playerLabel: string;
  avatarUrl: string | null;
  stake: number;
  status: CrashPlayerStatus;
  cashOutMultiplier: number | null;
  joinedAt: string;
}

export interface CrashPlayerView {
  userId: string;
  playerLabel: string;
  avatarUrl: string | null;
  stake: number;
  status: CrashPlayerStatus;
  cashOutMultiplier: number | null;
  isSelf: boolean;
}

export interface CrashHistoryEntry {
  result: string;
  multiplier: number;
  winners: number;
  players: number;
}

export interface CrashSharedState {
  phase: CrashPhase;
  roundId: number;
  bettingClosesAt: string | null;
  startTime: string | null;
  lastSettledMultiplier: number;
  lastCrashMultiplier: number;
  message: string;
  history: CrashHistoryEntry[];
  players: CrashPlayerView[];
  totalPot: number;
  queuedCount: number;
  liveCount: number;
  cashedOutCount: number;
  bustedCount: number;
}

export interface CrashPlayerEnvelope {
  sessionId: string;
  gameType: 'CRASH';
  status: GameSessionStatus;
  balance: number;
  currentBet: number;
  state: CrashSharedState;
  outcome: GameResolution | null;
}

const TABLE_SESSION_ID = 'crash-main';
const BETTING_WINDOW_MS = 8_000;
const RESOLVED_WINDOW_MS = 3_500;
const HISTORY_LIMIT = 12;
const ROUND_GROWTH_RATE = 0.00008;
const MIN_CRASH_POINT = Number(Math.exp(ROUND_GROWTH_RATE * 1800).toFixed(2));
const MAX_CRASH_POINT = 25;
const HOUSE_EDGE = 0.97;

const formatPlayerLabel = (email: string, username?: string | null): string => {
  const normalizedUsername = String(username || '').trim();

  if (normalizedUsername) {
    return normalizedUsername;
  }

  const [localPart] = email.split('@');
  if (!localPart) {
    return 'player';
  }

  const normalized = localPart.replace(/[^a-z0-9]/gi, '');

  if (normalized.length <= 3) {
    return normalized.toLowerCase();
  }

  return `${normalized.slice(0, 3).toLowerCase()}***`;
};

const generateCrashPoint = (): number => {
  const roll = Math.max(Number.EPSILON, Math.random());
  return Number(Math.min(MAX_CRASH_POINT, Math.max(MIN_CRASH_POINT, HOUSE_EDGE / (1 - roll))).toFixed(2));
};

const computeCrashDurationMs = (crashPoint: number): number =>
  Math.ceil(Math.log(crashPoint) / ROUND_GROWTH_RATE);

const computeLiveMultiplier = (elapsedMs: number): number =>
  Number(Math.max(1, Math.exp(ROUND_GROWTH_RATE * Math.max(0, elapsedMs))).toFixed(2));

class CrashRoundManager {
  private readonly listeners = new Set<() => void>();
  private readonly players = new Map<string, CrashPlayerEntry>();
  private readonly lastOutcomeByUser = new Map<string, GameResolution>();
  private readonly lastSettledMultiplierByUser = new Map<string, number>();

  private roundId = 1;
  private phase: CrashPhase = 'betting';
  private bettingClosesAt = Date.now() + BETTING_WINDOW_MS;
  private startTime: string | null = null;
  private crashPoint = 1;
  private crashDurationMs = 0;
  private lastCrashMultiplier = 1;
  private history: CrashHistoryEntry[] = [];

  private bettingTimer: NodeJS.Timeout | null = null;
  private crashTimer: NodeJS.Timeout | null = null;
  private resetTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.scheduleBettingWindow(BETTING_WINDOW_MS);
  }

  getSessionId(): string {
    return TABLE_SESSION_ID;
  }

  onStateChange(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async getStateForUser(userId: string): Promise<CrashPlayerEnvelope> {
    const user = await this.getUser(userId);

    return {
      sessionId: TABLE_SESSION_ID,
      gameType: GameType.CRASH,
      status: this.phase === 'resolved' ? GameSessionStatus.COMPLETED : GameSessionStatus.WAITING_ACTION,
      balance: user.balance,
      currentBet: this.getUserCurrentBet(userId),
      state: this.buildStateForUser(userId),
      outcome: this.lastOutcomeByUser.get(userId) || null
    };
  }

  async placeBet(userId: string, amount: number): Promise<CrashPlayerEnvelope> {
    if (this.phase !== 'betting') {
      throw new HttpError(400, 'Crash betting is closed. Wait for the next shared round.');
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new HttpError(400, 'Bet amount must be greater than zero.');
    }

    const user = await this.getUser(userId);

    if (amount > user.balance) {
      throw new HttpError(400, 'Insufficient demo balance for this crash bet.');
    }

    const existing = this.players.get(userId);

    if (existing?.status === 'queued') {
      throw new HttpError(400, 'You are already locked into this crash round.');
    }

    if (existing?.status === 'live') {
      throw new HttpError(400, 'Your crash round is already live. Cash out or wait for the reset.');
    }

    if (existing?.status === 'cashed-out' || existing?.status === 'busted') {
      throw new HttpError(400, 'Wait for the next crash round before placing another bet.');
    }

    this.lastOutcomeByUser.delete(userId);

    this.players.set(userId, {
      userId,
      playerLabel: formatPlayerLabel(user.email, user.username),
      avatarUrl: user.avatarUrl,
      stake: amount,
      status: 'queued',
      cashOutMultiplier: null,
      joinedAt: new Date().toISOString()
    });

    this.emitStateChange();
    return this.getStateForUser(userId);
  }

  async cashOut(userId: string): Promise<CrashPlayerEnvelope> {
    if (this.phase !== 'live') {
      throw new HttpError(400, 'There is no live crash round to cash out from.');
    }

    const player = this.players.get(userId);

    if (!player || player.status !== 'live') {
      throw new HttpError(400, 'Join the live crash round before attempting to cash out.');
    }

    if (this.hasCrashed()) {
      await this.resolveLiveRound();
      return this.getStateForUser(userId);
    }

    const multiplier = Math.min(this.crashPoint, computeLiveMultiplier(Date.now() - this.readStartTimeMs()));
    const balanceChange = Math.max(1, Math.floor(player.stake * (multiplier - 1)));
    const result = multiplier >= 10 ? 'MEGA_CASH_OUT' : multiplier >= 5 ? 'BIG_CASH_OUT' : 'CASH_OUT';

    await prisma.$transaction(async (tx) => {
      await tx.gameHistory.create({
        data: {
          userId,
          gameType: GameType.CRASH,
          betAmount: toDbAmount(player.stake),
          result,
          balanceChange: toDbAmount(balanceChange)
        }
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            increment: toDbAmount(balanceChange)
          }
        }
      });
    });

    player.status = 'cashed-out';
    player.cashOutMultiplier = multiplier;

    this.lastOutcomeByUser.set(userId, {
      result,
      balanceChange,
      betAmount: player.stake
    });
    this.lastSettledMultiplierByUser.set(userId, multiplier);

    this.emitStateChange();
    return this.getStateForUser(userId);
  }

  private async getUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        balance: true
      }
    });

    if (!user) {
      throw new HttpError(404, 'Authenticated user could not be found.');
    }

    return {
      ...user,
      balance: fromDbAmount(user.balance)
    };
  }

  private buildStateForUser(userId: string): CrashSharedState {
    const players = Array.from(this.players.values())
      .sort((left, right) => {
        if (left.userId === userId) return -1;
        if (right.userId === userId) return 1;
        return right.stake - left.stake || left.joinedAt.localeCompare(right.joinedAt);
      })
      .map((player) => ({
        userId: player.userId,
        playerLabel: player.playerLabel,
        avatarUrl: player.avatarUrl,
        stake: player.stake,
        status: player.status,
        cashOutMultiplier: player.cashOutMultiplier,
        isSelf: player.userId === userId
      }));

    const queuedCount = players.filter((player) => player.status === 'queued').length;
    const liveCount = players.filter((player) => player.status === 'live').length;
    const cashedOutCount = players.filter((player) => player.status === 'cashed-out').length;
    const bustedCount = players.filter((player) => player.status === 'busted').length;

    return {
      phase: this.phase,
      roundId: this.roundId,
      bettingClosesAt: this.phase === 'betting' ? new Date(this.bettingClosesAt).toISOString() : null,
      startTime: this.startTime,
      lastSettledMultiplier: this.lastSettledMultiplierByUser.get(userId) || this.lastCrashMultiplier || 1,
      lastCrashMultiplier: this.lastCrashMultiplier || 1,
      message: this.buildMessage(),
      history: [...this.history],
      players,
      totalPot: players.reduce((sum, player) => sum + player.stake, 0),
      queuedCount,
      liveCount,
      cashedOutCount,
      bustedCount
    };
  }

  private buildMessage(): string {
    if (this.phase === 'betting') {
      const queuedCount = Array.from(this.players.values()).filter((player) => player.status === 'queued').length;

      if (queuedCount === 0) {
        return 'Betting is open. Be the first player to lock into the next crash round.';
      }

      if (queuedCount === 1) {
        return 'One player is locked in. More players can still join before launch.';
      }

      return `${queuedCount} players are locked in for the next crash round.`;
    }

    if (this.phase === 'live') {
      return 'Round live. Cash out before the shared multiplier explodes.';
    }

    return `Round crashed at x${this.lastCrashMultiplier.toFixed(2)}. Betting will reopen shortly.`;
  }

  private getUserCurrentBet(userId: string): number {
    const player = this.players.get(userId);

    if (!player) {
      return 0;
    }

    return player.status === 'queued' || player.status === 'live' ? player.stake : 0;
  }

  private scheduleBettingWindow(delayMs: number): void {
    this.clearBettingTimer();
    this.bettingClosesAt = Date.now() + delayMs;
    this.bettingTimer = setTimeout(() => {
      void this.closeBettingWindow();
    }, delayMs);
  }

  private async closeBettingWindow(): Promise<void> {
    this.clearBettingTimer();

    const queuedPlayers = Array.from(this.players.values()).filter((player) => player.status === 'queued');

    if (queuedPlayers.length === 0) {
      this.scheduleBettingWindow(BETTING_WINDOW_MS);
      this.emitStateChange();
      return;
    }

    this.phase = 'live';
    this.startTime = new Date().toISOString();
    this.crashPoint = generateCrashPoint();
    this.crashDurationMs = computeCrashDurationMs(this.crashPoint);

    for (const player of queuedPlayers) {
      player.status = 'live';
      player.cashOutMultiplier = null;
    }

    this.clearCrashTimer();
    this.crashTimer = setTimeout(() => {
      void this.resolveLiveRound();
    }, this.crashDurationMs + 25);

    this.emitStateChange();
  }

  private async resolveLiveRound(): Promise<void> {
    if (this.phase !== 'live') {
      return;
    }

    this.clearCrashTimer();

    const livePlayers = Array.from(this.players.values()).filter((player) => player.status === 'live');
    const cashedOutCount = Array.from(this.players.values()).filter((player) => player.status === 'cashed-out').length;
    const totalPlayers = this.players.size;

    if (livePlayers.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const player of livePlayers) {
          await tx.gameHistory.create({
            data: {
              userId: player.userId,
              gameType: GameType.CRASH,
              betAmount: toDbAmount(player.stake),
              result: 'BUST',
              balanceChange: toDbAmount(-player.stake)
            }
          });

          await tx.user.update({
            where: { id: player.userId },
            data: {
              balance: {
                decrement: toDbAmount(player.stake)
              }
            }
          });
        }
      });

      for (const player of livePlayers) {
        player.status = 'busted';
        player.cashOutMultiplier = this.crashPoint;

        this.lastOutcomeByUser.set(player.userId, {
          result: 'BUST',
          balanceChange: -player.stake,
          betAmount: player.stake
        });
        this.lastSettledMultiplierByUser.set(player.userId, this.crashPoint);
      }
    }

    this.phase = 'resolved';
    this.lastCrashMultiplier = this.crashPoint;
    this.history = [
      {
        result: 'CRASH',
        multiplier: this.crashPoint,
        winners: cashedOutCount,
        players: totalPlayers
      },
      ...this.history
    ].slice(0, HISTORY_LIMIT);

    this.clearResetTimer();
    this.resetTimer = setTimeout(() => {
      this.resetForNextRound();
    }, RESOLVED_WINDOW_MS);

    this.emitStateChange();
  }

  private resetForNextRound(): void {
    this.clearResetTimer();
    this.phase = 'betting';
    this.roundId += 1;
    this.startTime = null;
    this.crashPoint = 1;
    this.crashDurationMs = 0;
    this.players.clear();
    this.scheduleBettingWindow(BETTING_WINDOW_MS);
    this.emitStateChange();
  }

  private hasCrashed(now = Date.now()): boolean {
    return this.phase === 'live' && now >= this.readStartTimeMs() + this.crashDurationMs;
  }

  private readStartTimeMs(): number {
    const startTimeMs = Date.parse(this.startTime || '');

    if (!Number.isFinite(startTimeMs)) {
      throw new HttpError(500, 'Crash round is missing a valid start time.');
    }

    return startTimeMs;
  }

  private clearBettingTimer(): void {
    if (!this.bettingTimer) {
      return;
    }

    clearTimeout(this.bettingTimer);
    this.bettingTimer = null;
  }

  private clearCrashTimer(): void {
    if (!this.crashTimer) {
      return;
    }

    clearTimeout(this.crashTimer);
    this.crashTimer = null;
  }

  private clearResetTimer(): void {
    if (!this.resetTimer) {
      return;
    }

    clearTimeout(this.resetTimer);
    this.resetTimer = null;
  }

  private emitStateChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const crashRoundManager = new CrashRoundManager();
