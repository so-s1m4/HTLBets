import { GameSessionStatus, GameType } from '../../../../generated/prisma';

import { prisma } from '../../../prisma/client';
import { HttpError } from '../../../utils/http-error';
import { createDeck, drawCard, shuffleDeck, type PlayingCard } from '../core/card.utils';
import type { GameResolution } from '../core/game-engine.interface';
import {
  classifyPokerOutcome,
  computeLayeredPayouts,
  evaluatePokerHand,
  type PokerHandEvaluation
} from './poker.utils';

type PokerTableVisibility = 'public' | 'private';
type PokerPhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'resolved';
type PokerSeatStatus = 'waiting' | 'active' | 'folded' | 'all-in' | 'busted';
type PokerAction = 'check' | 'call' | 'raise' | 'all-in' | 'fold';

interface PokerDisplayCard {
  hidden?: boolean;
  rank?: string;
  suit?: string;
}

interface PokerWinnerView {
  userId: string;
  playerLabel: string;
  hand: string;
}

interface PokerSeatView {
  userId: string;
  playerLabel: string;
  buyIn: number;
  stackRemaining: number;
  totalContribution: number;
  streetContribution: number;
  status: PokerSeatStatus;
  seatIndex: number;
  isSelf: boolean;
  cards: PokerDisplayCard[];
  evaluation?: { label: string } | null;
  lastAction?: string;
}

export interface PokerTableSummary {
  sessionId: string;
  tableName: string;
  visibility: PokerTableVisibility;
  maxPlayers: number;
  playerCount: number;
  minBuyIn: number;
  phase: PokerPhase;
  requiresPassword: boolean;
}

export interface PokerLobbyState {
  kind: 'lobby';
  tables: PokerTableSummary[];
  notes: string;
}

export interface PokerTableState {
  kind: 'table';
  tableId: string;
  tableName: string;
  visibility: PokerTableVisibility;
  requiresPassword: boolean;
  maxPlayers: number;
  minBuyIn: number;
  ownerUserId: string;
  phase: PokerPhase;
  pot: number;
  currentBet: number;
  actingUserId?: string;
  minRaiseTo?: number;
  allowedActions?: PokerAction[];
  players: PokerSeatView[];
  communityCards: PokerDisplayCard[];
  winners?: PokerWinnerView[];
  dealStartsAt?: string;
  phaseEndsAt?: string;
  notes: string;
  isSeated: boolean;
  canJoin: boolean;
}

export interface PokerPlayerEnvelope {
  sessionId: string;
  gameType: 'POKER';
  status: GameSessionStatus;
  balance: number;
  currentBet: number;
  state: PokerLobbyState | PokerTableState;
  outcome: GameResolution | null;
}

interface InternalSeat {
  userId: string;
  playerLabel: string;
  seatIndex: number;
  buyIn: number;
  stackRemaining: number;
  totalContribution: number;
  streetContribution: number;
  status: PokerSeatStatus;
  cards: PlayingCard[];
  evaluation: PokerHandEvaluation | null;
  lastAction?: string;
  actedThisStreet: boolean;
  pendingRemoval: boolean;
}

interface NormalizedTableConfig {
  tableName: string;
  visibility: PokerTableVisibility;
  password: string;
  minBuyIn: number;
  maxPlayers: number;
  buyIn: number;
}

const LOBBY_SESSION_ID = 'poker-lobby';
const START_DELAY_MS = 6_000;
const TURN_TIMEOUT_MS = 40_000;
const RUNOUT_STEP_MS = 1_900;
const SHOWDOWN_DELAY_MS = 6_500;
const MIN_TABLE_BUY_IN = 100;
const MAX_TABLES = 40;

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

  if (normalized.length <= 4) {
    return normalized.toLowerCase();
  }

  return `${normalized.slice(0, 4).toLowerCase()}*`;
};

const normalizeTableConfig = (payload?: Record<string, unknown>): NormalizedTableConfig => {
  const visibility = payload?.visibility === 'private' ? 'private' : 'public';
  const rawName = typeof payload?.tableName === 'string' ? payload.tableName.trim() : '';
  const tableName = rawName || 'Custom Poker Table';
  const minBuyIn = Number(payload?.minBuyIn || MIN_TABLE_BUY_IN);
  const maxPlayers = Number(payload?.maxPlayers || 6);
  const buyIn = Number(payload?.buyIn || minBuyIn);
  const password = typeof payload?.password === 'string' ? payload.password.trim() : '';

  if (!Number.isInteger(minBuyIn) || minBuyIn < MIN_TABLE_BUY_IN) {
    throw new HttpError(400, `Minimum buy-in must be at least ${MIN_TABLE_BUY_IN} credits.`);
  }

  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 8) {
    throw new HttpError(400, 'Poker tables must allow between 2 and 8 players.');
  }

  if (!Number.isInteger(buyIn) || buyIn < minBuyIn) {
    throw new HttpError(400, 'Your initial buy-in must meet the table minimum.');
  }

  if (visibility === 'private' && !/^\d{5}$/.test(password)) {
    throw new HttpError(400, 'Private tables require a 5-digit numeric password.');
  }

  return {
    tableName,
    visibility,
    password,
    minBuyIn,
    maxPlayers,
    buyIn
  };
};

const normalizeJoinConfig = (payload?: Record<string, unknown>): { sessionId?: string; password?: string; buyIn: number } => {
  const sessionId = typeof payload?.sessionId === 'string' && payload.sessionId.trim() ? payload.sessionId.trim() : undefined;
  const password = typeof payload?.password === 'string' && payload.password.trim() ? payload.password.trim() : undefined;
  const buyIn = Number(payload?.buyIn || 0);

  if (!Number.isInteger(buyIn) || buyIn <= 0) {
    throw new HttpError(400, 'Choose a valid buy-in amount to join the table.');
  }

  return {
    sessionId,
    password,
    buyIn
  };
};

const buildTableId = (): string => `poker-${Math.random().toString(36).slice(2, 10)}`;

class PokerTableInstance {
  readonly sessionId: string;
  readonly tableName: string;
  readonly visibility: PokerTableVisibility;
  readonly password: string | null;
  readonly minBuyIn: number;
  readonly maxPlayers: number;

  ownerUserId: string;
  phase: PokerPhase = 'waiting';
  pot = 0;
  currentBet = 0;
  actingUserId?: string;
  minRaiseTo?: number;
  notes = 'Seat at the table to join the next hand.';
  dealStartsAt?: number;
  phaseEndsAt?: number;
  winners: PokerWinnerView[] = [];
  communityCards: PlayingCard[] = [];
  private deck: PlayingCard[] = [];
  private readonly seats: InternalSeat[] = [];
  private readonly lastOutcomeByUser = new Map<string, GameResolution>();
  private startTimer: NodeJS.Timeout | null = null;
  private turnTimer: NodeJS.Timeout | null = null;
  private runoutTimer: NodeJS.Timeout | null = null;
  private showdownTimer: NodeJS.Timeout | null = null;

  constructor(
    config: {
      sessionId: string;
      tableName: string;
      visibility: PokerTableVisibility;
      password: string | null;
      minBuyIn: number;
      maxPlayers: number;
      ownerUserId: string;
    },
    private readonly onStateChange: () => void
  ) {
    this.sessionId = config.sessionId;
    this.tableName = config.tableName;
    this.visibility = config.visibility;
    this.password = config.password;
    this.minBuyIn = config.minBuyIn;
    this.maxPlayers = config.maxPlayers;
    this.ownerUserId = config.ownerUserId;
  }

  hasUser(userId: string): boolean {
    return this.seats.some((seat) => seat.userId === userId && !seat.pendingRemoval);
  }

  isPrivate(): boolean {
    return this.visibility === 'private';
  }

  playerCount(): number {
    return this.seats.filter((seat) => !seat.pendingRemoval).length;
  }

  isFull(): boolean {
    return this.playerCount() >= this.maxPlayers;
  }

  isEmpty(): boolean {
    return this.playerCount() === 0;
  }

  getLastOutcome(userId: string): GameResolution | null {
    return this.lastOutcomeByUser.get(userId) || null;
  }

  getSummary(): PokerTableSummary {
    return {
      sessionId: this.sessionId,
      tableName: this.tableName,
      visibility: this.visibility,
      maxPlayers: this.maxPlayers,
      playerCount: this.playerCount(),
      minBuyIn: this.minBuyIn,
      phase: this.phase,
      requiresPassword: Boolean(this.password)
    };
  }

  addSeat(userId: string, playerLabel: string, buyIn: number): void {
    if (this.hasUser(userId)) {
      throw new HttpError(400, 'You are already seated at this table.');
    }

    if (this.isFull()) {
      throw new HttpError(400, 'That poker table is already full.');
    }

    this.seats.push({
      userId,
      playerLabel,
      seatIndex: this.seats.length,
      buyIn,
      stackRemaining: buyIn,
      totalContribution: 0,
      streetContribution: 0,
      status: 'waiting',
      cards: [],
      evaluation: null,
      actedThisStreet: false,
      pendingRemoval: false,
      lastAction: 'Seated'
    });

    this.scheduleNextHandIfReady();
    this.emit();
  }

  leaveSeat(userId: string): { refundAmount: number } {
    const seat = this.getSeat(userId);
    const refundAmount = seat.stackRemaining;

    if (this.phase === 'waiting' || this.phase === 'resolved' || this.phase === 'showdown') {
      this.removeSeat(userId);
      return { refundAmount };
    }

    seat.stackRemaining = 0;
    seat.pendingRemoval = true;
    seat.cards = [];
    seat.evaluation = null;
    seat.status = 'folded';
    seat.lastAction = 'Left table';
    seat.actedThisStreet = true;

    if (this.actingUserId === userId) {
      void this.continueAfterAction(userId);
    } else {
      void this.checkImmediateResolution();
      this.emit();
    }

    return { refundAmount };
  }

  buildStateForUser(userId: string): PokerTableState {
    const selfSeat = this.findSeat(userId);
    const revealAllHands = this.phase === 'showdown' || this.phase === 'resolved';

    return {
      kind: 'table',
      tableId: this.sessionId,
      tableName: this.tableName,
      visibility: this.visibility,
      requiresPassword: Boolean(this.password),
      maxPlayers: this.maxPlayers,
      minBuyIn: this.minBuyIn,
      ownerUserId: this.ownerUserId,
      phase: this.phase,
      pot: this.pot,
      currentBet: this.currentBet,
      actingUserId: this.actingUserId,
      minRaiseTo: this.minRaiseTo,
      allowedActions: selfSeat ? this.allowedActionsFor(selfSeat) : [],
      players: [...this.seats]
        .filter((seat) => !seat.pendingRemoval)
        .sort((left, right) => left.seatIndex - right.seatIndex)
        .map((seat) => ({
          userId: seat.userId,
          playerLabel: seat.playerLabel,
          buyIn: seat.buyIn,
          stackRemaining: seat.stackRemaining,
          totalContribution: seat.totalContribution,
          streetContribution: seat.streetContribution,
          status: seat.status,
          seatIndex: seat.seatIndex,
          isSelf: seat.userId === userId,
          cards: seat.cards.length
            ? seat.cards.map((card) =>
                revealAllHands || seat.userId === userId
                  ? { rank: card.rank, suit: card.suit }
                  : { hidden: true }
              )
            : [{ hidden: true }, { hidden: true }],
          evaluation: revealAllHands && seat.evaluation ? { label: seat.evaluation.label } : null,
          lastAction: seat.lastAction
        })),
      communityCards: this.communityCards.map((card) => ({
        rank: card.rank,
        suit: card.suit
      })),
      winners: this.winners.length ? [...this.winners] : undefined,
      dealStartsAt: this.dealStartsAt ? new Date(this.dealStartsAt).toISOString() : undefined,
      phaseEndsAt: this.phaseEndsAt ? new Date(this.phaseEndsAt).toISOString() : undefined,
      notes: this.notes,
      isSeated: Boolean(selfSeat),
      canJoin: !selfSeat && !this.isFull()
    };
  }

  async performAction(userId: string, action: string, payload?: Record<string, unknown>): Promise<void> {
    const seat = this.getSeat(userId);

    if (this.phase === 'waiting' || this.phase === 'showdown' || this.phase === 'resolved') {
      throw new HttpError(400, 'There is no live poker hand to act on right now.');
    }

    if (this.actingUserId !== seat.userId) {
      throw new HttpError(400, 'It is not your turn.');
    }

    const normalized = action.toLowerCase() as PokerAction;
    const callAmount = Math.max(0, this.currentBet - seat.streetContribution);

    if (normalized === 'check') {
      if (callAmount > 0) {
        throw new HttpError(400, 'You cannot check while facing a live bet.');
      }

      seat.actedThisStreet = true;
      seat.lastAction = 'Checked';
      await this.continueAfterAction(userId);
      return;
    }

    if (normalized === 'fold') {
      seat.status = 'folded';
      seat.actedThisStreet = true;
      seat.lastAction = 'Folded';
      await this.continueAfterAction(userId);
      return;
    }

    if (normalized === 'call') {
      if (callAmount <= 0) {
        throw new HttpError(400, 'There is nothing to call.');
      }

      const amount = Math.min(callAmount, seat.stackRemaining);
      this.commitChips(seat, amount);
      seat.actedThisStreet = true;
      seat.lastAction = amount < callAmount ? `Called all-in ${amount}` : `Called ${amount}`;
      if (seat.stackRemaining === 0) {
        seat.status = 'all-in';
      }

      await this.continueAfterAction(userId);
      return;
    }

    if (normalized === 'raise') {
      const target = Number(payload?.amount);

      if (!Number.isInteger(target)) {
        throw new HttpError(400, 'Raise target must be a whole number.');
      }

      const minimumTarget = this.minRaiseTo || this.currentBet + this.minBuyIn;
      if (target < minimumTarget) {
        throw new HttpError(400, `Raise must be at least ${minimumTarget} credits.`);
      }

      const extra = target - seat.streetContribution;
      if (extra <= 0) {
        throw new HttpError(400, 'Raise target must move the action forward.');
      }

      if (extra > seat.stackRemaining) {
        throw new HttpError(400, 'You do not have enough chips behind for that raise.');
      }

      this.commitChips(seat, extra);
      this.currentBet = seat.streetContribution;
      this.minRaiseTo = this.currentBet + this.minBuyIn;
      seat.actedThisStreet = true;
      seat.lastAction = `Raised to ${this.currentBet}`;
      if (seat.stackRemaining === 0) {
        seat.status = 'all-in';
      }

      // Everyone else now needs to respond again.
      for (const other of this.activeBettingSeats()) {
        if (other.userId !== seat.userId) {
          other.actedThisStreet = false;
        }
      }

      await this.continueAfterAction(userId);
      return;
    }

    if (normalized === 'all-in') {
      if (seat.stackRemaining <= 0) {
        throw new HttpError(400, 'You have no chips left to push all-in.');
      }

      const raiseTarget = seat.streetContribution + seat.stackRemaining;
      const wasRaise = raiseTarget > this.currentBet;
      const contributed = seat.stackRemaining;
      this.commitChips(seat, contributed);
      seat.actedThisStreet = true;
      seat.status = 'all-in';
      seat.lastAction = `All-in ${contributed}`;

      if (wasRaise) {
        this.currentBet = seat.streetContribution;
        this.minRaiseTo = this.currentBet + this.minBuyIn;
        for (const other of this.activeBettingSeats()) {
          if (other.userId !== seat.userId) {
            other.actedThisStreet = false;
          }
        }
      }

      await this.continueAfterAction(userId);
      return;
    }

    throw new HttpError(400, `Unsupported poker action: ${action}`);
  }

  private allowedActionsFor(seat: InternalSeat): PokerAction[] {
    if (this.actingUserId !== seat.userId || !['preflop', 'flop', 'turn', 'river'].includes(this.phase)) {
      return [];
    }

    const callAmount = Math.max(0, this.currentBet - seat.streetContribution);
    const actions: PokerAction[] = ['fold'];

    if (callAmount === 0) {
      actions.unshift('check');
    }

    if (callAmount > 0 && seat.stackRemaining > 0) {
      actions.unshift('call');
    }

    if (seat.stackRemaining > callAmount) {
      actions.push('raise');
    }

    if (seat.stackRemaining > 0) {
      actions.push('all-in');
    }

    return actions;
  }

  private scheduleNextHandIfReady(): void {
    if (this.phase !== 'waiting') {
      return;
    }

    if (this.seatedPlayableSeats().length < 2) {
      this.clearStartTimer();
      this.dealStartsAt = undefined;
      this.notes = 'Need at least two seated players to start dealing.';
      return;
    }

    if (this.startTimer) {
      return;
    }

    this.dealStartsAt = Date.now() + START_DELAY_MS;
    this.notes = 'Next hand is queued. Top up your stack or wait for the deal.';
    this.startTimer = setTimeout(() => {
      this.startTimer = null;
      void this.startHand();
    }, START_DELAY_MS);
  }

  private async startHand(): Promise<void> {
    const participants = this.seatedPlayableSeats();
    if (participants.length < 2) {
      this.phase = 'waiting';
      this.dealStartsAt = undefined;
      this.notes = 'Need at least two seated players to start dealing.';
      this.emit();
      return;
    }

    this.clearTurnTimer();
    this.clearRunoutTimer();
    this.clearShowdownTimer();
    this.lastOutcomeByUser.clear();
    this.winners = [];
    this.communityCards = [];
    this.deck = shuffleDeck(createDeck());
    this.pot = 0;
    this.currentBet = 0;
    this.minRaiseTo = this.minBuyIn;
    this.phase = 'preflop';
    this.dealStartsAt = undefined;
    this.phaseEndsAt = undefined;
    this.notes = 'Cards are live. Build the pot or check it down.';

    for (const seat of this.seats) {
      seat.cards = [];
      seat.evaluation = null;
      seat.actedThisStreet = false;
      seat.totalContribution = 0;
      seat.streetContribution = 0;
      seat.pendingRemoval = false;

      if (seat.stackRemaining > 0) {
        seat.cards = [drawCard(this.deck), drawCard(this.deck)];
        seat.status = 'active';
        seat.lastAction = 'Dealt in';
      } else {
        seat.status = 'busted';
        seat.lastAction = 'Busted';
      }
    }

    this.setNextActor();
    this.emit();
  }

  private setNextActor(afterUserId?: string): void {
    this.clearTurnTimer();

    const actionableSeats = this.activeBettingSeats();
    if (actionableSeats.length === 0) {
      this.actingUserId = undefined;
      this.phaseEndsAt = undefined;
      return;
    }

    const sorted = [...actionableSeats].sort((left, right) => left.seatIndex - right.seatIndex);
    let nextSeat = sorted[0];

    if (afterUserId) {
      const currentIndex = sorted.findIndex((seat) => seat.userId === afterUserId);
      nextSeat = currentIndex >= 0 ? sorted[(currentIndex + 1) % sorted.length] : sorted[0];
    }

    this.actingUserId = nextSeat.userId;
    this.phaseEndsAt = Date.now() + TURN_TIMEOUT_MS;
    this.turnTimer = setTimeout(() => {
      void this.handleTurnTimeout(nextSeat.userId);
    }, TURN_TIMEOUT_MS);
  }

  private async handleTurnTimeout(userId: string): Promise<void> {
    const seat = this.findSeat(userId);
    if (!seat || this.actingUserId !== userId) {
      return;
    }

    seat.status = 'folded';
    seat.actedThisStreet = true;
    seat.lastAction = 'Auto-folded';
    await this.continueAfterAction(userId);
  }

  private commitChips(seat: InternalSeat, amount: number): void {
    if (amount <= 0) {
      return;
    }

    seat.stackRemaining -= amount;
    seat.streetContribution += amount;
    seat.totalContribution += amount;
    this.pot += amount;
  }

  private async continueAfterAction(userId: string): Promise<void> {
    if (await this.checkImmediateResolution()) {
      return;
    }

    if (this.everyoneIsAllIn()) {
      this.beginRunout();
      return;
    }

    if (this.isStreetClosed()) {
      await this.advanceStreet();
      return;
    }

    this.setNextActor(userId);
    this.emit();
  }

  private async checkImmediateResolution(): Promise<boolean> {
    const contenders = this.liveContenders();

    if (contenders.length > 1) {
      return false;
    }

    if (contenders.length === 1) {
      await this.awardSingleWinner(contenders[0]);
      return true;
    }

    return false;
  }

  private everyoneIsAllIn(): boolean {
    const contenders = this.liveContenders();
    return contenders.length > 1 && contenders.every((seat) => seat.status === 'all-in');
  }

  private isStreetClosed(): boolean {
    const contenders = this.liveContenders();
    if (contenders.length <= 1) {
      return true;
    }

    const actionable = contenders.filter((seat) => seat.status !== 'all-in');
    if (actionable.length === 0) {
      return true;
    }

    return actionable.every((seat) => seat.actedThisStreet && seat.streetContribution === this.currentBet);
  }

  private async advanceStreet(): Promise<void> {
    this.clearTurnTimer();
    this.phaseEndsAt = undefined;
    this.actingUserId = undefined;

    if (this.phase === 'river') {
      await this.startShowdown();
      return;
    }

    for (const seat of this.seats) {
      seat.streetContribution = 0;
      seat.actedThisStreet = false;
      if (seat.status === 'active') {
        seat.lastAction = 'Waiting';
      }
    }

    this.currentBet = 0;
    this.minRaiseTo = this.minBuyIn;

    if (this.phase === 'preflop') {
      this.phase = 'flop';
      this.communityCards.push(drawCard(this.deck), drawCard(this.deck), drawCard(this.deck));
      this.notes = 'Flop dealt. Pressure the table or float a cheap card.';
    } else if (this.phase === 'flop') {
      this.phase = 'turn';
      this.communityCards.push(drawCard(this.deck));
      this.notes = 'Turn dealt. Bigger bets start to matter now.';
    } else {
      this.phase = 'river';
      this.communityCards.push(drawCard(this.deck));
      this.notes = 'River dealt. Final decision before showdown.';
    }

    this.setNextActor();
    this.emit();
  }

  private beginRunout(): void {
    this.clearTurnTimer();
    this.actingUserId = undefined;
    this.queueRunoutStep();
    this.emit();
  }

  private queueRunoutStep(): void {
    this.clearRunoutTimer();
    this.phaseEndsAt = Date.now() + RUNOUT_STEP_MS;
    this.runoutTimer = setTimeout(() => {
      void this.executeRunoutStep();
    }, RUNOUT_STEP_MS);
  }

  private async executeRunoutStep(): Promise<void> {
    this.runoutTimer = null;

    if (this.phase === 'preflop') {
      this.phase = 'flop';
      this.communityCards.push(drawCard(this.deck), drawCard(this.deck), drawCard(this.deck));
      this.notes = 'Flop rolled out automatically after all-in.';
      this.queueRunoutStep();
      this.emit();
      return;
    }

    if (this.phase === 'flop') {
      this.phase = 'turn';
      this.communityCards.push(drawCard(this.deck));
      this.notes = 'Turn rolled out automatically after all-in.';
      this.queueRunoutStep();
      this.emit();
      return;
    }

    if (this.phase === 'turn') {
      this.phase = 'river';
      this.communityCards.push(drawCard(this.deck));
      this.notes = 'River rolled out automatically after all-in.';
      this.queueRunoutStep();
      this.emit();
      return;
    }

    await this.startShowdown();
  }

  private async awardSingleWinner(winner: InternalSeat): Promise<void> {
    winner.stackRemaining += this.pot;
    winner.evaluation = null;
    this.winners = [
      {
        userId: winner.userId,
        playerLabel: winner.playerLabel,
        hand: 'Uncontested'
      }
    ];
    this.phase = 'showdown';
    this.actingUserId = undefined;
    this.currentBet = 0;
    this.minRaiseTo = undefined;
    this.notes = `${winner.playerLabel} drags the pot after the table folds around them.`;

    const historyRows = this.seats
      .filter((seat) => seat.totalContribution > 0 || seat.userId === winner.userId)
      .map((seat) => {
        const payout = seat.userId === winner.userId ? this.pot : 0;
        const balanceChange = payout - seat.totalContribution;
        const resolution: GameResolution = {
          result: classifyPokerOutcome({
            winnerCount: 1,
            balanceChange,
            sharedWinner: false,
            folded: seat.status === 'folded'
          }),
          balanceChange,
          betAmount: seat.totalContribution
        };
        this.lastOutcomeByUser.set(seat.userId, resolution);
        return {
          userId: seat.userId,
          gameType: GameType.POKER,
          betAmount: seat.totalContribution,
          result: resolution.result,
          balanceChange: resolution.balanceChange
        };
      });

    await this.persistHistory(historyRows);
    this.scheduleShowdownExit();
    this.emit();
  }

  private async startShowdown(): Promise<void> {
    this.clearRunoutTimer();
    this.clearTurnTimer();

    while (this.communityCards.length < 5) {
      this.communityCards.push(drawCard(this.deck));
    }

    const contenders = this.liveContenders();
    const evaluations = new Map<string, PokerHandEvaluation>();

    for (const seat of contenders) {
      const evaluation = evaluatePokerHand([...seat.cards, ...this.communityCards]);
      seat.evaluation = evaluation;
      evaluations.set(seat.userId, evaluation);
    }

    const layered = computeLayeredPayouts(
      this.seats
        .filter((seat) => seat.totalContribution > 0)
        .map((seat) => ({
          userId: seat.userId,
          totalContribution: seat.totalContribution,
          seatIndex: seat.seatIndex,
          status: seat.status
        })),
      evaluations
    );

    const historyRows = this.seats
      .filter((seat) => seat.totalContribution > 0 || layered.payouts.has(seat.userId))
      .map((seat) => {
        const payout = layered.payouts.get(seat.userId) || 0;
        seat.stackRemaining += payout;
        const balanceChange = payout - seat.totalContribution;
        const resolution: GameResolution = {
          result: classifyPokerOutcome({
            winnerCount: layered.winningUserIds.size,
            balanceChange,
            sharedWinner: layered.sharedWinners.has(seat.userId),
            folded: seat.status === 'folded'
          }),
          balanceChange,
          betAmount: seat.totalContribution
        };
        this.lastOutcomeByUser.set(seat.userId, resolution);
        return {
          userId: seat.userId,
          gameType: GameType.POKER,
          betAmount: seat.totalContribution,
          result: resolution.result,
          balanceChange: resolution.balanceChange
        };
      });

    const winnerSeats = this.seats
      .filter((seat) => layered.winningUserIds.has(seat.userId))
      .sort((left, right) => left.seatIndex - right.seatIndex);

    this.winners = winnerSeats.map((seat) => ({
      userId: seat.userId,
      playerLabel: seat.playerLabel,
      hand: seat.evaluation?.label || 'Made hand'
    }));
    this.phase = 'showdown';
    this.actingUserId = undefined;
    this.currentBet = 0;
    this.minRaiseTo = undefined;
    this.notes = this.winners.length > 1 ? 'Split pot at showdown.' : 'Showdown complete. Pot awarded.';

    await this.persistHistory(historyRows);
    this.scheduleShowdownExit();
    this.emit();
  }

  private scheduleShowdownExit(): void {
    this.clearShowdownTimer();
    this.phaseEndsAt = Date.now() + SHOWDOWN_DELAY_MS;
    this.showdownTimer = setTimeout(() => {
      this.finishHand();
    }, SHOWDOWN_DELAY_MS);
  }

  private finishHand(): void {
    this.clearShowdownTimer();
    this.phase = 'waiting';
    this.currentBet = 0;
    this.pot = 0;
    this.minRaiseTo = undefined;
    this.actingUserId = undefined;
    this.communityCards = [];
    this.winners = [];
    this.phaseEndsAt = undefined;
    this.notes = 'Seat at the table to join the next hand.';

    for (const seat of this.seats) {
      seat.cards = [];
      seat.evaluation = null;
      seat.totalContribution = 0;
      seat.streetContribution = 0;
      seat.actedThisStreet = false;
      seat.status = seat.stackRemaining > 0 ? 'waiting' : 'busted';
      seat.lastAction = seat.stackRemaining > 0 ? 'Waiting' : 'Busted';
    }

    this.removeEmptySeats();
    this.scheduleNextHandIfReady();
    this.emit();
  }

  private removeEmptySeats(): void {
    const remaining = this.seats.filter((seat) => !seat.pendingRemoval && seat.stackRemaining > 0);
    this.seats.splice(0, this.seats.length, ...remaining);
    this.reindexSeats();
    this.ownerUserId = this.seats[0]?.userId || this.ownerUserId;
  }

  private removeSeat(userId: string): void {
    const nextSeats = this.seats.filter((seat) => seat.userId !== userId);
    this.seats.splice(0, this.seats.length, ...nextSeats);
    this.reindexSeats();
    this.ownerUserId = this.seats[0]?.userId || this.ownerUserId;
    this.scheduleNextHandIfReady();
    this.emit();
  }

  private reindexSeats(): void {
    this.seats.forEach((seat, index) => {
      seat.seatIndex = index;
    });
  }

  private seatedPlayableSeats(): InternalSeat[] {
    return this.seats.filter((seat) => !seat.pendingRemoval && seat.stackRemaining > 0);
  }

  private activeBettingSeats(): InternalSeat[] {
    return this.seats.filter((seat) => seat.status === 'active' && seat.stackRemaining > 0 && !seat.pendingRemoval);
  }

  private liveContenders(): InternalSeat[] {
    return this.seats.filter((seat) => ['active', 'all-in'].includes(seat.status) && seat.cards.length === 2);
  }

  private getSeat(userId: string): InternalSeat {
    const seat = this.findSeat(userId);

    if (!seat) {
      throw new HttpError(404, 'You are not seated at this poker table.');
    }

    return seat;
  }

  private findSeat(userId: string): InternalSeat | undefined {
    return this.seats.find((seat) => seat.userId === userId && !seat.pendingRemoval);
  }

  private clearStartTimer(): void {
    if (!this.startTimer) {
      return;
    }

    clearTimeout(this.startTimer);
    this.startTimer = null;
  }

  private clearTurnTimer(): void {
    if (!this.turnTimer) {
      return;
    }

    clearTimeout(this.turnTimer);
    this.turnTimer = null;
  }

  private clearRunoutTimer(): void {
    if (!this.runoutTimer) {
      return;
    }

    clearTimeout(this.runoutTimer);
    this.runoutTimer = null;
  }

  private clearShowdownTimer(): void {
    if (!this.showdownTimer) {
      return;
    }

    clearTimeout(this.showdownTimer);
    this.showdownTimer = null;
  }

  private async persistHistory(
    rows: Array<{
      userId: string;
      gameType: GameType;
      betAmount: number;
      result: string;
      balanceChange: number;
    }>
  ): Promise<void> {
    if (!rows.length) {
      return;
    }

    await prisma.gameHistory.createMany({
      data: rows
    });
  }

  private emit(): void {
    this.onStateChange();
  }
}

class PokerTableManager {
  private readonly listeners = new Set<() => void>();
  private readonly tables = new Map<string, PokerTableInstance>();
  private readonly userTable = new Map<string, string>();

  getLobbySessionId(): string {
    return LOBBY_SESSION_ID;
  }

  onStateChange(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async getStateForUser(userId: string, requestedSessionId?: string): Promise<PokerPlayerEnvelope> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new HttpError(404, 'Authenticated user could not be found.');
    }

    const targetSessionId = this.resolveSessionIdForUser(userId, requestedSessionId);
    const table = targetSessionId ? this.tables.get(targetSessionId) : null;

    if (!table) {
      return {
        sessionId: LOBBY_SESSION_ID,
        gameType: GameType.POKER,
        status: GameSessionStatus.IDLE,
        balance: user.balance,
        currentBet: 0,
        state: {
          kind: 'lobby',
          tables: [...this.tables.values()]
            .filter((entry) => !entry.isPrivate())
            .map((entry) => entry.getSummary())
            .sort((left, right) => right.playerCount - left.playerCount),
          notes: 'Create a custom table or buy in to a public room.'
        },
        outcome: null
      };
    }

    const state = table.buildStateForUser(userId);

    return {
      sessionId: table.sessionId,
      gameType: GameType.POKER,
      status: ['showdown', 'resolved'].includes(state.phase) ? GameSessionStatus.COMPLETED : GameSessionStatus.WAITING_ACTION,
      balance: user.balance,
      currentBet: state.currentBet,
      state,
      outcome: table.getLastOutcome(userId)
    };
  }

  async createTable(userId: string, payload?: Record<string, unknown>): Promise<string> {
    if (this.tables.size >= MAX_TABLES) {
      throw new HttpError(400, 'The demo already has the maximum number of active poker tables.');
    }

    if (this.userTable.has(userId)) {
      throw new HttpError(400, 'Leave your current table before creating another one.');
    }

    const config = normalizeTableConfig(payload);
    const user = await this.reserveBalance(userId, config.buyIn);

    const table = new PokerTableInstance(
      {
        sessionId: buildTableId(),
        tableName: config.tableName,
        visibility: config.visibility,
        password: config.visibility === 'private' ? String(config.password) : null,
        minBuyIn: Number(config.minBuyIn),
        maxPlayers: Number(config.maxPlayers),
        ownerUserId: userId
      },
      () => this.emitStateChange()
    );

    this.tables.set(table.sessionId, table);
    table.addSeat(userId, formatPlayerLabel(user.email, user.username), Number(config.buyIn));
    this.userTable.set(userId, table.sessionId);
    this.emitStateChange();

    return table.sessionId;
  }

  async joinTable(userId: string, payload?: Record<string, unknown>): Promise<string> {
    const config = normalizeJoinConfig(payload);
    const table = this.resolveJoinTarget(config);

    if (this.userTable.has(userId) && this.userTable.get(userId) !== table.sessionId) {
      throw new HttpError(400, 'Leave your current table before joining a new one.');
    }

    if (table.hasUser(userId)) {
      return table.sessionId;
    }

    if (config.buyIn < table.minBuyIn) {
      throw new HttpError(400, `This table requires at least ${table.minBuyIn} credits to buy in.`);
    }

    const user = await this.reserveBalance(userId, config.buyIn);
    table.addSeat(userId, formatPlayerLabel(user.email, user.username), config.buyIn);
    this.userTable.set(userId, table.sessionId);
    this.emitStateChange();

    return table.sessionId;
  }

  async leaveTable(userId: string): Promise<void> {
    const sessionId = this.userTable.get(userId);
    if (!sessionId) {
      return;
    }

    const table = this.tables.get(sessionId);
    this.userTable.delete(userId);

    if (!table) {
      this.emitStateChange();
      return;
    }

    const { refundAmount } = table.leaveSeat(userId);

    if (refundAmount > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: {
            increment: refundAmount
          }
        }
      });
    }

    if (table.isEmpty()) {
      this.tables.delete(table.sessionId);
    }

    this.emitStateChange();
  }

  async performAction(userId: string, sessionId: string | undefined, action: string, payload?: Record<string, unknown>): Promise<void> {
    const table = this.requireTable(sessionId || this.userTable.get(userId));
    await table.performAction(userId, action, payload);

    if (table.isEmpty()) {
      this.tables.delete(table.sessionId);
    }

    this.emitStateChange();
  }

  private resolveSessionIdForUser(userId: string, requestedSessionId?: string): string | null {
    if (requestedSessionId && requestedSessionId !== LOBBY_SESSION_ID) {
      const requestedTable = this.tables.get(requestedSessionId);
      if (requestedTable && (!requestedTable.isPrivate() || requestedTable.hasUser(userId))) {
        return requestedSessionId;
      }
    }

    const assigned = this.userTable.get(userId);
    if (assigned) {
      const assignedTable = this.tables.get(assigned);
      if (assignedTable?.hasUser(userId)) {
        return assigned;
      }

      this.userTable.delete(userId);
    }

    return null;
  }

  private resolveJoinTarget(config: { sessionId?: string; password?: string; buyIn: number }): PokerTableInstance {
    if (config.sessionId) {
      const table = this.tables.get(config.sessionId);
      if (!table) {
        throw new HttpError(404, 'Poker table was not found.');
      }

      if (table.isPrivate() && table.password !== config.password) {
        throw new HttpError(400, 'That private table password is incorrect.');
      }

      return table;
    }

    if (config.password) {
      const table = [...this.tables.values()].find((entry) => entry.password === config.password);
      if (!table) {
        throw new HttpError(404, 'No private poker table matches that password.');
      }

      return table;
    }

    throw new HttpError(400, 'Choose a public table or enter a private table password.');
  }

  private requireTable(sessionId: string | undefined): PokerTableInstance {
    if (!sessionId) {
      throw new HttpError(400, 'Poker table session is missing.');
    }

    const table = this.tables.get(sessionId);
    if (!table) {
      throw new HttpError(404, 'Poker table was not found.');
    }

    return table;
  }

  private async reserveBalance(userId: string, amount: number) {
    const updated = await prisma.user.updateMany({
      where: {
        id: userId,
        balance: {
          gte: amount
        }
      },
      data: {
        balance: {
          decrement: amount
        }
      }
    });

    if (updated.count === 0) {
      throw new HttpError(400, 'Insufficient demo balance for that poker buy-in.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new HttpError(404, 'Authenticated user could not be found.');
    }

    return user;
  }

  private emitStateChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const pokerTableManager = new PokerTableManager();
