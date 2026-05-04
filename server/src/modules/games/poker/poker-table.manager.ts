import { GameSessionStatus, GameType } from '../../../../generated/prisma';

import { prisma } from '../../../prisma/client';
import { HttpError } from '../../../utils/http-error';
import { createDeck, drawCard, getPokerRankValue, shuffleDeck, type PlayingCard } from '../core/card.utils';
import type { GameResolution } from '../core/game-engine.interface';
import { classifyPokerOutcome, comparePokerEvaluations, computeLayeredPayouts, evaluatePokerHand, type PokerHandEvaluation } from './poker.utils';

type PokerPhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'resolved';
type PokerPlayerStatus = 'waiting' | 'active' | 'folded' | 'all-in';
type PokerAction = 'check' | 'call' | 'raise' | 'all-in' | 'fold';

interface PokerSeatState {
  userId: string;
  playerLabel: string;
  ante: number;
  stackAtJoin: number;
  totalContribution: number;
  streetContribution: number;
  status: PokerPlayerStatus;
  seatIndex: number;
  cards: PlayingCard[];
  lastAction?: string;
}

interface PublicPokerSeat {
  userId: string;
  playerLabel: string;
  ante: number;
  stackRemaining: number;
  totalContribution: number;
  streetContribution: number;
  status: PokerPlayerStatus;
  seatIndex: number;
  isSelf: boolean;
  cards: Array<Record<string, string | boolean>>;
  evaluation?: { label: string } | null;
  lastAction?: string;
}

export interface PokerTableState {
  phase: PokerPhase;
  roundId: number;
  pot: number;
  joinMinimum: number;
  currentBet: number;
  actingUserId?: string;
  minRaiseTo?: number;
  players: PublicPokerSeat[];
  communityCards: Array<Record<string, string>>;
  notes: string;
  dealStartsAt?: string;
  phaseEndsAt?: string;
  winners?: Array<{ userId: string; playerLabel: string; hand: string }>;
  allowedActions?: PokerAction[];
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
const RESOLVED_MS = 12_000;
const MAX_SEATS = 6;
const MIN_RAISE_INCREMENT = 25;
const MIN_BUY_IN = 100;
const TURN_TIMEOUT_MS = 40_000;

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

export class PokerTableManager {
  private readonly listeners = new Set<() => void>();
  private phase: PokerPhase = 'waiting';
  private roundId = 1;
  private participants = new Map<string, PokerSeatState>();
  private turnOrder: string[] = [];
  private actingUserId: string | null = null;
  private streetActed = new Set<string>();
  private currentStreetBet = 0;
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
      currentBet: this.currentStreetBet,
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

    const joinAmount = this.currentJoinMinimum();

    if (this.participants.size > 0 && amount !== joinAmount) {
      throw new HttpError(400, `This hand is locked to a ${joinAmount} buy-in. Join with exactly ${joinAmount}.`);
    }

    if (this.participants.size === 0 && amount < joinAmount) {
      throw new HttpError(400, `Minimum buy-in for this poker table is currently ${joinAmount}.`);
    }

    if (this.participants.has(userId)) {
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
      stackAtJoin: user.balance,
      totalContribution: amount,
      streetContribution: 0,
      status: 'waiting',
      seatIndex: this.nextSeat(),
      cards: [],
      lastAction: 'Joined'
    });

    if (this.participants.size >= MIN_PLAYERS && !this.dealStartsAt) {
      this.dealStartsAt = Date.now() + JOIN_WINDOW_MS;
      this.phaseEndsAt = this.dealStartsAt;
      this.notes = 'Table is filling. Cards deal automatically when the join timer ends.';
      this.schedule(this.closeJoinWindow.bind(this), JOIN_WINDOW_MS);
    } else if (this.participants.size < MIN_PLAYERS) {
      this.notes = 'One more player is needed to open the hand.';
    }

    this.emitStateChange();
  }

  async performAction(userId: string, action: string, payload?: Record<string, unknown>): Promise<void> {
    if (this.phase === 'waiting' || this.phase === 'resolved' || this.phase === 'showdown') {
      throw new HttpError(400, 'No active hand available for that action.');
    }

    const normalizedAction = action.toLowerCase() as PokerAction;
    const player = this.participants.get(userId);

    if (!player) {
      throw new HttpError(404, 'You are not seated at this poker table.');
    }

    if (player.status === 'folded') {
      throw new HttpError(400, 'You already folded this hand.');
    }

    if (player.status === 'all-in') {
      throw new HttpError(400, 'You are already all-in for this hand.');
    }

    if (this.actingUserId !== userId) {
      throw new HttpError(400, 'It is not your turn.');
    }

    switch (normalizedAction) {
      case 'check':
        this.handleCheck(player);
        break;
      case 'call':
        this.handleCall(player);
        break;
      case 'raise':
        this.handleRaise(player, payload);
        break;
      case 'all-in':
        this.handleAllIn(player);
        break;
      case 'fold':
        this.handleFold(player);
        break;
      default:
        throw new HttpError(400, 'Supported poker actions: check, call, raise, all-in, fold.');
    }

    await this.afterAction(player.userId);
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
    const waitingCommitted = Array.from(this.participants.values()).reduce((sum, player) => sum + player.totalContribution, 0);
    const visiblePlayers = Array.from(this.participants.values())
      .sort((left, right) => left.seatIndex - right.seatIndex)
      .map((player) => {
        const revealCards = this.phase === 'showdown' || this.phase === 'resolved' || player.userId === userId;

        return {
          userId: player.userId,
          playerLabel: player.playerLabel,
          ante: player.ante,
          stackRemaining: Math.max(0, player.stackAtJoin - player.totalContribution),
          totalContribution: player.totalContribution,
          streetContribution: player.streetContribution,
          status: player.status,
          seatIndex: player.seatIndex,
          isSelf: player.userId === userId,
          cards: revealCards ? player.cards.map(toCardView) : player.cards.map(() => hiddenCardView()),
          evaluation:
            revealCards && this.evaluations.has(player.userId)
              ? { label: this.evaluations.get(player.userId)?.label || 'Hand' }
              : null,
          lastAction: player.lastAction
        } satisfies PublicPokerSeat;
      });

    return {
      phase: this.phase,
      roundId: this.roundId,
      pot: this.phase === 'waiting' ? waitingCommitted : this.pot,
      joinMinimum: this.currentJoinMinimum(),
      currentBet: this.currentStreetBet,
      actingUserId: this.actingUserId || undefined,
      minRaiseTo: this.currentStreetBet + MIN_RAISE_INCREMENT,
      players: visiblePlayers,
      communityCards: this.communityCards.map(toCardView),
      notes: this.notes,
      dealStartsAt: this.dealStartsAt ? new Date(this.dealStartsAt).toISOString() : undefined,
      phaseEndsAt: this.phaseEndsAt ? new Date(this.phaseEndsAt).toISOString() : undefined,
      winners: this.winners.length ? [...this.winners] : undefined,
      allowedActions: this.allowedActionsFor(userId)
    };
  }

  private allowedActionsFor(userId: string): PokerAction[] {
    const player = this.participants.get(userId);

    if (!player || this.actingUserId !== userId || ['waiting', 'showdown', 'resolved'].includes(this.phase)) {
      return [];
    }

    if (player.status === 'folded' || player.status === 'all-in') {
      return [];
    }

    const toCall = this.currentStreetBet - player.streetContribution;
    const remaining = this.stackRemaining(player);
    const actions: PokerAction[] = ['fold'];

    if (toCall <= 0) {
      actions.unshift('check');
    } else if (remaining >= toCall) {
      actions.unshift('call');
    }

    if (remaining > toCall && remaining > 0) {
      actions.push('raise');
      actions.push('all-in');
    } else if (remaining > 0 && !actions.includes('all-in')) {
      actions.push('all-in');
    }

    return actions;
  }

  private nextSeat(): number {
    const seat = this.seatCursor % MAX_SEATS;
    this.seatCursor += 1;
    return seat;
  }

  private currentJoinMinimum(): number {
    const committedMaximum = Array.from(this.participants.values()).reduce(
      (highest, player) => Math.max(highest, player.ante),
      0
    );

    return Math.max(MIN_BUY_IN, committedMaximum);
  }

  private schedule(task: () => void | Promise<void>, delayMs: number): void {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
    }

    this.roundTimer = setTimeout(() => {
      void task();
    }, delayMs);
  }

  private clearRoundTimer(): void {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }

  private beginTurn(userId: string | null): void {
    this.clearRoundTimer();
    this.actingUserId = userId;

    if (!userId) {
      this.phaseEndsAt = null;
      return;
    }

    this.phaseEndsAt = Date.now() + TURN_TIMEOUT_MS;
    this.schedule(async () => {
      await this.autoFoldTurn(userId);
    }, TURN_TIMEOUT_MS);
  }

  private async autoFoldTurn(userId: string): Promise<void> {
    if (this.actingUserId !== userId || ['waiting', 'showdown', 'resolved'].includes(this.phase)) {
      return;
    }

    const player = this.participants.get(userId);

    if (!player || player.status !== 'active') {
      return;
    }

    player.status = 'folded';
    player.lastAction = 'Auto-folded';
    this.streetActed.add(player.userId);
    this.notes = `${player.playerLabel} timed out and was auto-folded.`;

    await this.afterAction(player.userId);
    this.emitStateChange();
  }

  private async closeJoinWindow(): Promise<void> {
    if (this.participants.size < MIN_PLAYERS) {
      this.dealStartsAt = null;
      this.phaseEndsAt = null;
      this.notes = 'Join window expired. Waiting for enough players again.';
      this.emitStateChange();
      return;
    }

    this.phase = 'preflop';
    this.dealStartsAt = null;
    this.phaseEndsAt = null;
    this.deck = shuffleDeck(createDeck());
    this.communityCards = [];
    this.evaluations.clear();
    this.winners = [];
    this.currentStreetBet = 0;
    this.streetActed.clear();
    this.pot = 0;

    const orderedPlayers = Array.from(this.participants.values()).sort((left, right) => left.seatIndex - right.seatIndex);
    this.turnOrder = orderedPlayers.map((player) => player.userId);

    for (const player of orderedPlayers) {
      player.status = 'active';
      player.cards = [drawCard(this.deck), drawCard(this.deck)];
      player.streetContribution = 0;
      player.lastAction = 'Dealt in';
      this.pot += player.ante;
    }

    this.beginTurn(this.turnOrder[0] || null);
    this.notes = 'Preflop betting is live. Use check, call, raise, all-in, or fold.';
    this.emitStateChange();
  }

  private handleCheck(player: PokerSeatState): void {
    if (player.streetContribution !== this.currentStreetBet) {
      throw new HttpError(400, 'You can only check when you already match the current bet.');
    }

    player.lastAction = 'Checked';
    this.streetActed.add(player.userId);
  }

  private handleCall(player: PokerSeatState): void {
    const toCall = this.currentStreetBet - player.streetContribution;

    if (toCall <= 0) {
      throw new HttpError(400, 'There is nothing to call right now.');
    }

    if (this.stackRemaining(player) < toCall) {
      throw new HttpError(400, 'Use all-in if you cannot cover the call.');
    }

    player.streetContribution += toCall;
    player.totalContribution += toCall;
    player.lastAction = `Called ${this.currentStreetBet}`;
    this.pot += toCall;
    this.streetActed.add(player.userId);

    if (this.stackRemaining(player) === 0) {
      player.status = 'all-in';
    }
  }

  private handleRaise(player: PokerSeatState, payload?: Record<string, unknown>): void {
    const raiseTo = Number(payload?.amount);

    if (!Number.isFinite(raiseTo) || !Number.isInteger(raiseTo)) {
      throw new HttpError(400, 'Raise amount must be a whole number.');
    }

    const minimum = this.currentStreetBet + MIN_RAISE_INCREMENT;
    if (raiseTo < minimum) {
      throw new HttpError(400, `Raise must be at least ${minimum}.`);
    }

    const additional = raiseTo - player.streetContribution;
    if (additional <= 0) {
      throw new HttpError(400, 'Raise must increase your total street contribution.');
    }

    if (additional > this.stackRemaining(player)) {
      throw new HttpError(400, 'Raise exceeds your remaining demo stack. Use all-in instead.');
    }

    player.streetContribution = raiseTo;
    player.totalContribution += additional;
    player.lastAction = `Raised to ${raiseTo}`;
    this.currentStreetBet = raiseTo;
    this.pot += additional;
    this.streetActed = new Set([player.userId]);

    if (this.stackRemaining(player) === 0) {
      player.status = 'all-in';
    }
  }

  private handleAllIn(player: PokerSeatState): void {
    const remaining = this.stackRemaining(player);

    if (remaining <= 0) {
      throw new HttpError(400, 'You have no remaining stack for an all-in.');
    }

    player.streetContribution += remaining;
    player.totalContribution += remaining;
    this.pot += remaining;

    if (player.streetContribution > this.currentStreetBet) {
      this.currentStreetBet = player.streetContribution;
      this.streetActed = new Set([player.userId]);
      player.lastAction = `All-in ${player.streetContribution}`;
    } else {
      this.streetActed.add(player.userId);
      player.lastAction = 'All-in';
    }

    player.status = 'all-in';
  }

  private handleFold(player: PokerSeatState): void {
    player.status = 'folded';
    player.lastAction = 'Folded';
    this.streetActed.add(player.userId);
  }

  private async afterAction(userId: string): Promise<void> {
    const activePlayers = this.nonFoldedPlayers();

    if (activePlayers.length <= 1) {
      await this.resolveByLastPlayer();
      return;
    }

    if (this.isBettingRoundComplete()) {
      await this.advanceStreet();
      return;
    }

    const nextActor = this.findNextActingPlayer(userId);
    this.beginTurn(nextActor);
    this.notes = `${this.participants.get(nextActor || '')?.playerLabel || 'Next player'} to act.`;
  }

  private nonFoldedPlayers(): PokerSeatState[] {
    return Array.from(this.participants.values()).filter((player) => player.status !== 'folded');
  }

  private activeTurnPlayers(): PokerSeatState[] {
    return Array.from(this.participants.values()).filter((player) => player.status === 'active');
  }

  private stackRemaining(player: PokerSeatState): number {
    return Math.max(0, player.stackAtJoin - player.totalContribution);
  }

  private findNextActingPlayer(currentUserId: string): string | null {
    if (!this.turnOrder.length) {
      return null;
    }

    const startIndex = this.turnOrder.indexOf(currentUserId);

    for (let offset = 1; offset <= this.turnOrder.length; offset += 1) {
      const userId = this.turnOrder[(startIndex + offset) % this.turnOrder.length];
      const player = this.participants.get(userId);

      if (player && player.status === 'active') {
        return userId;
      }
    }

    return null;
  }

  private isBettingRoundComplete(): boolean {
    const players = this.nonFoldedPlayers();

    if (players.length <= 1) {
      return true;
    }

    return players.every((player) => {
      if (player.status === 'all-in') {
        return true;
      }

      return player.streetContribution === this.currentStreetBet && this.streetActed.has(player.userId);
    });
  }

  private async advanceStreet(): Promise<void> {
    if (this.phase === 'river') {
      await this.runShowdown();
      return;
    }

    for (const player of this.participants.values()) {
      player.streetContribution = 0;
    }

    this.currentStreetBet = 0;
    this.streetActed.clear();

    if (this.phase === 'preflop') {
      this.communityCards.push(drawCard(this.deck), drawCard(this.deck), drawCard(this.deck));
      this.phase = 'flop';
      this.notes = 'Flop is out. New betting round.';
    } else if (this.phase === 'flop') {
      this.communityCards.push(drawCard(this.deck));
      this.phase = 'turn';
      this.notes = 'Turn card revealed. Betting continues.';
    } else if (this.phase === 'turn') {
      this.communityCards.push(drawCard(this.deck));
      this.phase = 'river';
      this.notes = 'River card is out. Final betting round.';
    }

    const next = this.turnOrder.find((userId) => this.participants.get(userId)?.status === 'active') || null;

    if (!next) {
      await this.runShowdown();
      return;
    }

    this.beginTurn(next);
  }

  private async resolveByLastPlayer(): Promise<void> {
    const players = this.nonFoldedPlayers();
    this.phase = 'showdown';
    this.clearRoundTimer();
    this.actingUserId = null;
    this.phaseEndsAt = Date.now() + RESOLVED_MS;

    if (players.length === 1) {
      const winner = players[0];
      this.evaluations.set(winner.userId, evaluatePokerHand([...winner.cards, ...this.communityCards]));
      this.winners = [
        {
          userId: winner.userId,
          playerLabel: winner.playerLabel,
          hand: this.evaluations.get(winner.userId)?.label || 'Survived'
        }
      ];
      this.notes = `${winner.playerLabel} wins because everyone else folded.`;
      await this.resolveRound([winner.userId]);
      return;
    }

    this.winners = [];
    this.notes = 'Hand ended without a showdown winner.';
    await this.resolveRound([]);
  }

  private async runShowdown(): Promise<void> {
    this.phase = 'showdown';
    this.phaseEndsAt = Date.now() + RESOLVED_MS;
    this.clearRoundTimer();
    this.actingUserId = null;

    const contenders = this.nonFoldedPlayers();

    if (contenders.length === 0) {
      await this.resolveRound([]);
      return;
    }

    let bestEvaluation: PokerHandEvaluation | null = null;
    let winnerIds: string[] = [];

    for (const player of contenders) {
      const evaluation = evaluatePokerHand([...player.cards, ...this.communityCards]);
      this.evaluations.set(player.userId, evaluation);

      if (!bestEvaluation) {
        bestEvaluation = evaluation;
        winnerIds = [player.userId];
        continue;
      }

      const comparison = comparePokerEvaluations(evaluation, bestEvaluation);

      if (comparison > 0) {
        bestEvaluation = evaluation;
        winnerIds = [player.userId];
      } else if (comparison === 0) {
        winnerIds.push(player.userId);
      }
    }

    this.winners = winnerIds.map((userId) => {
      const player = this.participants.get(userId)!;
      return {
        userId,
        playerLabel: player.playerLabel,
        hand: this.evaluations.get(userId)?.label || 'Hand'
      };
    });
    this.notes = this.winners.length > 1 ? 'Split pot. Matched best hands at showdown.' : 'Showdown complete.';
    await this.resolveRound(winnerIds);
  }

  private async resolveRound(winnerIds: string[]): Promise<void> {
    const participantList = Array.from(this.participants.values()).sort((left, right) => left.seatIndex - right.seatIndex);
    const winnerCount = winnerIds.length;
    const { payouts, winningUserIds, sharedWinners } = computeLayeredPayouts(participantList, this.evaluations);

    if (this.phase === 'showdown') {
      this.winners = participantList
        .filter((player) => (payouts.get(player.userId) || 0) > 0)
        .map((player) => ({
          userId: player.userId,
          playerLabel: player.playerLabel,
          hand: this.evaluations.get(player.userId)?.label || 'Hand'
        }));
    }

    await prisma.$transaction(async (tx) => {
      for (const player of participantList) {
        const payout = payouts.get(player.userId) || 0;
        const balanceChange = payout - player.totalContribution;
        const result = classifyPokerOutcome({
          winnerCount,
          balanceChange,
          sharedWinner: sharedWinners.has(player.userId),
          folded: player.status === 'folded'
        });

        await tx.gameHistory.create({
          data: {
            userId: player.userId,
            gameType: GameType.POKER,
            betAmount: player.totalContribution,
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
          betAmount: player.totalContribution
        });
      }
    });

    this.phase = 'resolved';
    this.phaseEndsAt = Date.now() + RESOLVED_MS;
    this.clearRoundTimer();
    this.emitStateChange();
    this.schedule(this.resetRound.bind(this), RESOLVED_MS);
  }

  private resetRound(): void {
    this.clearRoundTimer();
    this.phase = 'waiting';
    this.roundId += 1;
    this.participants.clear();
    this.turnOrder = [];
    this.actingUserId = null;
    this.streetActed.clear();
    this.currentStreetBet = 0;
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
