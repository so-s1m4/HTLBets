import { GameSessionStatus, GameType } from '../../../../generated/prisma';

import { prisma } from '../../../prisma/client';
import { HttpError } from '../../../utils/http-error';
import type { GameResolution } from '../core/game-engine.interface';

type RouletteColor = 'red' | 'black' | 'green';
type RouletteSelectionType = 'color' | 'number';
type RoulettePhase = 'betting' | 'spinning';

interface RouletteSelection {
  type: RouletteSelectionType;
  value: RouletteColor | number;
}

interface RouletteSpinResult {
  number: number;
  color: RouletteColor;
}

interface RouletteBetEntry {
  userId: string;
  playerLabel: string;
  amount: number;
  selection: RouletteSelection;
  placedAt: string;
}

interface AggregateBetEntry {
  selectionType: RouletteSelectionType;
  value: RouletteColor | number;
  totalAmount: number;
  playerCount: number;
}

interface RouletteRoundResult {
  selection: RouletteSelection;
  spin: RouletteSpinResult;
  payoutMultiplier: number;
  won: boolean;
}

export interface RouletteTableState {
  phase: RoulettePhase;
  roundId: number;
  bettingClosesAt: string;
  history: RouletteSpinResult[];
  lastSpin?: RouletteSpinResult;
  lastRound?: RouletteRoundResult;
  bets: RouletteBetEntry[];
  aggregates: AggregateBetEntry[];
}

export interface RoulettePlayerEnvelope {
  sessionId: string;
  gameType: 'ROULETTE';
  status: GameSessionStatus;
  balance: number;
  currentBet: number;
  state: RouletteTableState;
  outcome: GameResolution | null;
}

const TABLE_SESSION_ID = 'roulette-main';
const BETTING_WINDOW_MS = 40_000;
const HISTORY_LIMIT = 12;
const RECENT_BETS_LIMIT = 80;

const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const getColorForNumber = (number: number): RouletteColor => {
  if (number === 0) {
    return 'green';
  }

  return redNumbers.has(number) ? 'red' : 'black';
};

const normalizeSelection = (payload?: Record<string, unknown>): RouletteSelection => {
  const type = payload?.selectionType;
  const value = payload?.value;

  if (type === 'color' && (value === 'red' || value === 'black')) {
    return { type, value };
  }

  if (type === 'number' && Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 36) {
    return {
      type,
      value: Number(value)
    };
  }

  throw new HttpError(400, 'Roulette bet must target red, black, or a number between 0 and 36.');
};

const selectionKey = (selection: RouletteSelection): string => `${selection.type}:${selection.value}`;

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

export class RouletteTableManager {
  private readonly listeners = new Set<() => void>();
  private roundId = 1;
  private bettingClosesAt = Date.now() + BETTING_WINDOW_MS;
  private phase: RoulettePhase = 'betting';
  private bets: RouletteBetEntry[] = [];
  private history: RouletteSpinResult[] = [];
  private lastSpin?: RouletteSpinResult;
  private lastRoundByUser = new Map<string, RouletteRoundResult>();
  private lastOutcomeByUser = new Map<string, GameResolution>();
  private roundTimer: NodeJS.Timeout;

  constructor() {
    this.roundTimer = setTimeout(() => {
      void this.closeRound();
    }, BETTING_WINDOW_MS);
  }

  async getStateForUser(userId: string): Promise<RoulettePlayerEnvelope> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new HttpError(404, 'Authenticated user could not be found.');
    }

    return {
      sessionId: TABLE_SESSION_ID,
      gameType: GameType.ROULETTE,
      status: this.phase === 'betting' ? GameSessionStatus.WAITING_ACTION : GameSessionStatus.COMPLETED,
      balance: user.balance,
      currentBet: this.getUserCurrentBet(userId),
      state: this.buildSharedState(userId),
      outcome: this.lastOutcomeByUser.get(userId) || null
    };
  }

  async placeBet(userId: string, amount: number, payload?: Record<string, unknown>): Promise<void> {
    if (this.phase !== 'betting') {
      throw new HttpError(400, 'Betting is closed. Wait for the next roulette round.');
    }

    if (amount <= 0) {
      throw new HttpError(400, 'Bet amount must be greater than zero.');
    }

    const selection = normalizeSelection(payload);
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new HttpError(404, 'Authenticated user could not be found.');
    }

    const reserved = this.getUserCurrentBet(userId);

    if (reserved + amount > user.balance) {
      throw new HttpError(400, 'Insufficient demo balance for this roulette bet.');
    }

    this.bets.push({
      userId,
      playerLabel: formatPlayerLabel(user.email, user.username),
      amount,
      selection,
      placedAt: new Date().toISOString()
    });
    this.bets = this.bets.slice(-RECENT_BETS_LIMIT);
    this.emitStateChange();
  }

  getTableSessionId(): string {
    return TABLE_SESSION_ID;
  }

  onStateChange(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private buildSharedState(userId: string): RouletteTableState {
    return {
      phase: this.phase,
      roundId: this.roundId,
      bettingClosesAt: new Date(this.bettingClosesAt).toISOString(),
      history: [...this.history],
      lastSpin: this.lastSpin,
      lastRound: this.lastRoundByUser.get(userId),
      bets: [...this.bets].sort((left, right) => right.placedAt.localeCompare(left.placedAt)),
      aggregates: this.buildAggregates().sort((left, right) => right.totalAmount - left.totalAmount)
    };
  }

  private getUserCurrentBet(userId: string): number {
    return this.bets
      .filter((bet) => bet.userId === userId)
      .reduce((sum, bet) => sum + bet.amount, 0);
  }

  private buildAggregates(): AggregateBetEntry[] {
    const grouped = new Map<string, AggregateBetEntry>();

    for (const bet of this.bets) {
      const key = selectionKey(bet.selection);
      const existing = grouped.get(key);

      if (existing) {
        existing.totalAmount += bet.amount;
        existing.playerCount += 1;
        continue;
      }

      grouped.set(key, {
        selectionType: bet.selection.type,
        value: bet.selection.value,
        totalAmount: bet.amount,
        playerCount: 1
      });
    }

    return Array.from(grouped.values());
  }

  private async closeRound(): Promise<void> {
    this.phase = 'spinning';

    this.emitStateChange();

    if (this.bets.length === 0) {
      this.startNextRound();
      return;
    }

    const resultNumber = Math.floor(Math.random() * 37);
    const spin: RouletteSpinResult = {
      number: resultNumber,
      color: getColorForNumber(resultNumber)
    };

    this.lastSpin = spin;
    this.lastRoundByUser.clear();
    this.lastOutcomeByUser.clear();

    const groupedByUser = new Map<string, RouletteBetEntry[]>();

    for (const bet of this.bets) {
      const userBets = groupedByUser.get(bet.userId) || [];
      userBets.push(bet);
      groupedByUser.set(bet.userId, userBets);
    }

    await prisma.$transaction(async (tx) => {
      for (const [userId, userBets] of groupedByUser.entries()) {
        let netChange = 0;
        let totalBetAmount = 0;
        let primaryBet: RouletteBetEntry | null = null;

        for (const bet of userBets) {
          const won =
            bet.selection.type === 'color'
              ? bet.selection.value === spin.color
              : Number(bet.selection.value) === spin.number;

          const payoutMultiplier = bet.selection.type === 'color' ? 2 : 36;
          const balanceChange = won ? bet.amount * (payoutMultiplier - 1) : -bet.amount;

          netChange += balanceChange;
          totalBetAmount += bet.amount;

          if (!primaryBet || bet.amount > primaryBet.amount) {
            primaryBet = bet;
          }
        }

        await tx.gameHistory.create({
          data: {
            userId,
            gameType: GameType.ROULETTE,
            betAmount: totalBetAmount,
            result: netChange > 0 ? 'WIN' : netChange < 0 ? 'LOSS' : 'PUSH',
            balanceChange: netChange
          }
        });

        if (netChange !== 0) {
          await tx.user.update({
            where: { id: userId },
            data: {
              balance: {
                increment: netChange
              }
            }
          });
        }

        if (primaryBet) {
          const won =
            primaryBet.selection.type === 'color'
              ? primaryBet.selection.value === spin.color
              : Number(primaryBet.selection.value) === spin.number;

          this.lastRoundByUser.set(userId, {
            selection: primaryBet.selection,
            spin,
            payoutMultiplier: primaryBet.selection.type === 'color' ? 2 : 36,
            won
          });
        }

        this.lastOutcomeByUser.set(userId, {
          result: netChange > 0 ? 'WIN' : netChange < 0 ? 'LOSS' : 'PUSH',
          balanceChange: netChange,
          betAmount: totalBetAmount
        });
      }
    });

    this.history = [spin, ...this.history].slice(0, HISTORY_LIMIT);
    this.bets = [];
    this.startNextRound();
  }

  private startNextRound(): void {
    this.roundId += 1;
    this.phase = 'betting';
    this.bettingClosesAt = Date.now() + BETTING_WINDOW_MS;

    clearTimeout(this.roundTimer);
    this.roundTimer = setTimeout(() => {
      void this.closeRound();
    }, BETTING_WINDOW_MS);
    this.emitStateChange();
  }

  private emitStateChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const rouletteTableManager = new RouletteTableManager();
