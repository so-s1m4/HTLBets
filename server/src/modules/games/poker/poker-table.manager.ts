import { GameSessionStatus, GameType } from '../../../../generated/prisma';

import { prisma } from '../../../prisma/client';
import { HttpError } from '../../../utils/http-error';
import { createDeck, drawCard, getPokerRankValue, shuffleDeck, type PlayingCard } from '../core/card.utils';
import type { GameResolution } from '../core/game-engine.interface';

type PokerPhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'resolved';
type PokerPlayerStatus = 'waiting' | 'active' | 'folded';

interface PokerHandEvaluation {
  label: string;
  category: number;
  ranks: number[];
}

interface PokerSeatState {
  userId: string;
  playerLabel: string;
  ante: number;
  totalContribution: number;
  status: PokerPlayerStatus;
  seatIndex: number;
  cards: PlayingCard[];
}

interface PublicPokerSeat {
  userId: string;
  playerLabel: string;
  ante: number;
  totalContribution: number;
  status: PokerPlayerStatus;
  seatIndex: number;
  isSelf: boolean;
  cards: Array<Record<string, string | boolean>>;
  evaluation?: { label: string } | null;
}

export interface PokerTableState {
  phase: PokerPhase;
  roundId: number;
  pot: number;
  players: PublicPokerSeat[];
  communityCards: Array<Record<string, string>>;
  playerHand: Array<Record<string, string>>;
  notes: string;
  dealStartsAt?: string;
  phaseEndsAt?: string;
  winners?: Array<{ userId: string; playerLabel: string; hand: string }>;
}

export interface PokerPlayerEnvelope {
  sessionId: string;
  gameType: 'POKER';
  status: GameSessionStatus;
  balance: number;
  currentBet: number;
  state: PokerTableState;
  outcome: GameResolution | null;
}

const TABLE_SESSION_ID = 'poker-main';
const MIN_PLAYERS = 2;
const JOIN_WINDOW_MS = 15_000;
const PREFLOP_MS = 9_000;
const FLOP_MS = 8_000;
const TURN_MS = 8_000;
const RIVER_MS = 8_000;
const SHOWDOWN_MS = 10_000;
const RESOLVED_MS = 12_000;
const MAX_SEATS = 6;

const formatPlayerLabel = (email: string): string => {
  const [localPart] = email.split('@');
  if (!localPart) {
    return 'player';
  }

  const normalized = localPart.replace(/[^a-z0-9]/gi, '');
  if (normalized.length <= 3) {
    return normalized.toLowerCase();
  }

  return `${normalized.slice(0, 4).toLowerCase()}*`;
};

const toCardView = (card: PlayingCard): Record<string, string> => ({
  rank: card.rank,
  suit: card.suit
});

const hiddenCardView = (): Record<string, boolean> => ({
  hidden: true
});

const evaluatePlaceholderHand = (cards: PlayingCard[]): PokerHandEvaluation => {
  const ranks = cards.map(getPokerRankValue).sort((left, right) => right - left);
  const counts = new Map<number, number>();

  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) || 0) + 1);
  }

  const groups = Array.from(counts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return right[0] - left[0];
  });

  const pairs = groups.filter((group) => group[1] === 2).map((group) => group[0]).sort((left, right) => right - left);
  const trips = groups.filter((group) => group[1] === 3).map((group) => group[0]).sort((left, right) => right - left);
  const quads = groups.find((group) => group[1] === 4)?.[0];
  const kickers = groups.filter((group) => group[1] === 1).map((group) => group[0]).sort((left, right) => right - left);

  if (quads) {
    return {
      label: 'Four of a Kind',
      category: 6,
      ranks: [quads, ...kickers.slice(0, 1)]
    };
  }

  if (trips.length > 0 && pairs.length > 0) {
    return {
      label: 'Full House',
      category: 5,
      ranks: [trips[0], pairs[0]]
    };
  }

  if (trips.length > 0) {
    return {
      label: 'Three of a Kind',
      category: 4,
      ranks: [trips[0], ...kickers.slice(0, 2)]
    };
  }

  if (pairs.length >= 2) {
    return {
      label: 'Two Pair',
      category: 3,
      ranks: [pairs[0], pairs[1], ...kickers.slice(0, 1)]
    };
  }

  if (pairs.length === 1) {
    return {
      label: 'Pair',
      category: 2,
      ranks: [pairs[0], ...kickers.slice(0, 3)]
    };
  }

  return {
    label: 'High Card',
    category: 1,
    ranks: ranks.slice(0, 5)
  };
};

const compareEvaluations = (left: PokerHandEvaluation, right: PokerHandEvaluation): number => {
  if (left.category !== right.category) {
    return left.category - right.category;
  }

  const maxLength = Math.max(left.ranks.length, right.ranks.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftRank = left.ranks[index] || 0;
    const rightRank = right.ranks[index] || 0;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
  }

  return 0;
};

export class PokerTableManager {
  private readonly listeners = new Set<() => void>();
  private phase: PokerPhase = 'waiting';
  private roundId = 1;
  private participants = new Map<string, PokerSeatState>();
  private communityCards: PlayingCard[] = [];
  private deck: PlayingCard[] = [];
  private notes = 'Wait for at least two players, then join the next hand with a demo ante.';
  private pot = 0;
  private dealStartsAt: number | null = null;
  private phaseEndsAt: number | null = null;
  private winners: Array<{ userId: string; playerLabel: string; hand: string }> = [];
  private evaluations = new Map<string, PokerHandEvaluation>();
  private lastOutcomeByUser = new Map<string, GameResolution>();
  private roundTimer: NodeJS.Timeout | null = null;
  private seatCursor = 0;

  async getStateForUser(userId: string): Promise<PokerPlayerEnvelope> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new HttpError(404, 'Authenticated user could not be found.');
    }

    return {
      sessionId: TABLE_SESSION_ID,
      gameType: GameType.POKER,
      status: this.phase === 'waiting' ? GameSessionStatus.IDLE : GameSessionStatus.WAITING_ACTION,
      balance: user.balance,
      currentBet: this.participants.get(userId)?.ante || 0,
      state: this.buildStateForUser(userId),
      outcome: this.lastOutcomeByUser.get(userId) || null
    };
  }

  async joinHand(userId: string, amount: number): Promise<void> {
    if (this.phase !== 'waiting') {
      throw new HttpError(400, 'A poker hand is already running. Wait for the next round.');
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new HttpError(400, 'Ante must be a positive whole number.');
    }

    const existing = this.participants.get(userId);
    if (existing) {
      throw new HttpError(400, 'You already joined the next poker hand.');
    }

    if (this.participants.size >= MAX_SEATS) {
      throw new HttpError(400, 'The main poker table is full.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new HttpError(404, 'Authenticated user could not be found.');
    }

    if (amount > user.balance) {
      throw new HttpError(400, 'Insufficient demo balance for this poker ante.');
    }

    this.lastOutcomeByUser.delete(userId);
    this.participants.set(userId, {
      userId,
      playerLabel: formatPlayerLabel(user.email),
      ante: amount,
      totalContribution: amount,
      status: 'waiting',
      seatIndex: this.nextSeat(),
      cards: []
    });

    if (this.participants.size >= MIN_PLAYERS && !this.dealStartsAt) {
      this.dealStartsAt = Date.now() + JOIN_WINDOW_MS;
      this.notes = 'Table is filling. Cards deal automatically when the join timer ends.';
      this.schedule(this.closeJoinWindow.bind(this), JOIN_WINDOW_MS);
    } else if (this.participants.size < MIN_PLAYERS) {
      this.notes = 'One more player is needed to open the hand.';
    }

    this.emitStateChange();
  }

  async performAction(userId: string, action: string): Promise<void> {
    if (!['fold'].includes(action.toLowerCase())) {
      throw new HttpError(400, 'Supported poker action: fold.');
    }

    if (this.phase === 'waiting' || this.phase === 'resolved' || this.phase === 'showdown') {
      throw new HttpError(400, 'No active hand available for that action.');
    }

    const participant = this.participants.get(userId);
    if (!participant) {
      throw new HttpError(404, 'You are not seated at this poker table.');
    }

    if (participant.status !== 'active') {
      throw new HttpError(400, 'You already folded or are not in the active hand.');
    }

    participant.status = 'folded';
    this.notes = `${participant.playerLabel} folded.`;
    await this.maybeResolveByLastPlayer();
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

  private buildStateForUser(userId: string): PokerTableState {
    const visiblePlayers = Array.from(this.participants.values())
      .sort((left, right) => left.seatIndex - right.seatIndex)
      .map((player) => {
        const revealCards = this.phase === 'showdown' || this.phase === 'resolved' || player.userId === userId;

        return {
          userId: player.userId,
          playerLabel: player.playerLabel,
          ante: player.ante,
          totalContribution: player.totalContribution,
          status: player.status,
          seatIndex: player.seatIndex,
          isSelf: player.userId === userId,
          cards: revealCards ? player.cards.map(toCardView) : player.cards.map(() => hiddenCardView()),
          evaluation:
            revealCards && this.evaluations.has(player.userId)
              ? { label: this.evaluations.get(player.userId)?.label || 'Hand' }
              : null
        } satisfies PublicPokerSeat;
      });

    return {
      phase: this.phase,
      roundId: this.roundId,
      pot: this.pot,
      players: visiblePlayers,
      communityCards: this.communityCards.map(toCardView),
      playerHand: this.participants.get(userId)?.cards.map(toCardView) || [],
      notes: this.notes,
      dealStartsAt: this.dealStartsAt ? new Date(this.dealStartsAt).toISOString() : undefined,
      phaseEndsAt: this.phaseEndsAt ? new Date(this.phaseEndsAt).toISOString() : undefined,
      winners: this.winners.length ? [...this.winners] : undefined
    };
  }

  private nextSeat(): number {
    const seat = this.seatCursor % MAX_SEATS;
    this.seatCursor += 1;
    return seat;
  }

  private schedule(task: () => void | Promise<void>, delayMs: number): void {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
    }

    this.roundTimer = setTimeout(() => {
      void task();
    }, delayMs);
  }

  private async closeJoinWindow(): Promise<void> {
    if (this.participants.size < MIN_PLAYERS) {
      this.dealStartsAt = null;
      this.notes = 'Join window expired. Waiting for enough players again.';
      this.emitStateChange();
      return;
    }

    this.phase = 'preflop';
    this.dealStartsAt = null;
    this.phaseEndsAt = Date.now() + PREFLOP_MS;
    this.deck = shuffleDeck(createDeck());
    this.communityCards = [];
    this.evaluations.clear();
    this.winners = [];
    this.pot = 0;

    for (const player of this.participants.values()) {
      player.status = 'active';
      player.cards = [drawCard(this.deck), drawCard(this.deck)];
      this.pot += player.ante;
    }

    this.notes = 'Cards are live. Watch the board build and fold if the hand looks dead.';
    this.emitStateChange();
    this.schedule(this.revealFlop.bind(this), PREFLOP_MS);
  }

  private async revealFlop(): Promise<void> {
    if (this.phase !== 'preflop') {
      return;
    }

    this.communityCards.push(drawCard(this.deck), drawCard(this.deck), drawCard(this.deck));
    this.phase = 'flop';
    this.phaseEndsAt = Date.now() + FLOP_MS;
    this.notes = 'Flop on the felt. Active players stay in unless they fold.';
    await this.maybeResolveByLastPlayer();
    this.emitStateChange();
    if (this.phase === 'flop') {
      this.schedule(this.revealTurn.bind(this), FLOP_MS);
    }
  }

  private async revealTurn(): Promise<void> {
    if (this.phase !== 'flop') {
      return;
    }

    this.communityCards.push(drawCard(this.deck));
    this.phase = 'turn';
    this.phaseEndsAt = Date.now() + TURN_MS;
    this.notes = 'Turn card revealed. The table is heading into the final stretch.';
    await this.maybeResolveByLastPlayer();
    this.emitStateChange();
    if (this.phase === 'turn') {
      this.schedule(this.revealRiver.bind(this), TURN_MS);
    }
  }

  private async revealRiver(): Promise<void> {
    if (this.phase !== 'turn') {
      return;
    }

    this.communityCards.push(drawCard(this.deck));
    this.phase = 'river';
    this.phaseEndsAt = Date.now() + RIVER_MS;
    this.notes = 'River is out. Showdown is next unless the hand is already dead.';
    await this.maybeResolveByLastPlayer();
    this.emitStateChange();
    if (this.phase === 'river') {
      this.schedule(this.runShowdown.bind(this), RIVER_MS);
    }
  }

  private async maybeResolveByLastPlayer(): Promise<void> {
    const activePlayers = Array.from(this.participants.values()).filter((player) => player.status === 'active');

    if (activePlayers.length > 1) {
      return;
    }

    if (activePlayers.length === 0) {
      await this.resolveRound([]);
      return;
    }

    this.phase = 'showdown';
    this.phaseEndsAt = Date.now() + SHOWDOWN_MS;
    const winner = activePlayers[0];
    this.evaluations.set(winner.userId, evaluatePlaceholderHand([...winner.cards, ...this.communityCards]));
    this.winners = [
      {
        userId: winner.userId,
        playerLabel: winner.playerLabel,
        hand: this.evaluations.get(winner.userId)?.label || 'Survived'
      }
    ];
    this.notes = `${winner.playerLabel} wins after everyone else folded.`;
    await this.resolveRound([winner.userId]);
  }

  private async runShowdown(): Promise<void> {
    if (!['river', 'flop', 'turn', 'preflop'].includes(this.phase)) {
      return;
    }

    this.phase = 'showdown';
    this.phaseEndsAt = Date.now() + SHOWDOWN_MS;

    const activePlayers = Array.from(this.participants.values()).filter((player) => player.status === 'active');

    if (activePlayers.length === 0) {
      await this.resolveRound([]);
      return;
    }

    let bestEvaluation: PokerHandEvaluation | null = null;
    let winners: string[] = [];

    for (const player of activePlayers) {
      const evaluation = evaluatePlaceholderHand([...player.cards, ...this.communityCards]);
      this.evaluations.set(player.userId, evaluation);

      if (!bestEvaluation) {
        bestEvaluation = evaluation;
        winners = [player.userId];
        continue;
      }

      const comparison = compareEvaluations(evaluation, bestEvaluation);

      if (comparison > 0) {
        bestEvaluation = evaluation;
        winners = [player.userId];
        continue;
      }

      if (comparison === 0) {
        winners.push(player.userId);
      }
    }

    this.winners = winners.map((userId) => {
      const player = this.participants.get(userId)!;
      return {
        userId,
        playerLabel: player.playerLabel,
        hand: this.evaluations.get(userId)?.label || 'Hand'
      };
    });
    this.notes = this.winners.length > 1 ? 'Split pot. Multiple players hit the same best hand.' : 'Showdown complete.';
    await this.resolveRound(winners);
  }

  private async resolveRound(winnerIds: string[]): Promise<void> {
    const participantList = Array.from(this.participants.values()).sort((left, right) => left.seatIndex - right.seatIndex);
    const totalPot = this.pot;
    const winnerCount = winnerIds.length;
    const winnerSet = new Set(winnerIds);

    const payouts = new Map<string, number>();
    if (winnerCount > 0) {
      const baseShare = Math.floor(totalPot / winnerCount);
      let remainder = totalPot % winnerCount;

      for (const winnerId of winnerIds) {
        const share = baseShare + (remainder > 0 ? 1 : 0);
        payouts.set(winnerId, share);
        remainder = Math.max(0, remainder - 1);
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const player of participantList) {
        const payout = payouts.get(player.userId) || 0;
        const balanceChange = payout - player.ante;
        const result =
          winnerCount === 0
            ? 'VOID'
            : winnerSet.has(player.userId)
              ? winnerCount > 1
                ? 'SPLIT'
                : 'WIN'
              : player.status === 'folded'
                ? 'FOLD'
                : 'LOSS';

        await tx.gameHistory.create({
          data: {
            userId: player.userId,
            gameType: GameType.POKER,
            betAmount: player.ante,
            result,
            balanceChange
          }
        });

        if (balanceChange !== 0) {
          await tx.user.update({
            where: { id: player.userId },
            data: {
              balance: {
                increment: balanceChange
              }
            }
          });
        }

        this.lastOutcomeByUser.set(player.userId, {
          result,
          balanceChange,
          betAmount: player.ante
        });
      }
    });

    this.phase = 'resolved';
    this.phaseEndsAt = Date.now() + RESOLVED_MS;
    this.emitStateChange();
    this.schedule(this.resetRound.bind(this), RESOLVED_MS);
  }

  private resetRound(): void {
    this.phase = 'waiting';
    this.roundId += 1;
    this.participants.clear();
    this.communityCards = [];
    this.deck = [];
    this.notes = 'Next hand is open. Join with a demo ante to sit in.';
    this.pot = 0;
    this.dealStartsAt = null;
    this.phaseEndsAt = null;
    this.winners = [];
    this.evaluations.clear();
    this.emitStateChange();
  }

  private emitStateChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const pokerTableManager = new PokerTableManager();
