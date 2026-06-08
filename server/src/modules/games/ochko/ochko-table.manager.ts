import { GameSessionStatus, GameType } from '../../../../generated/prisma';

import { prisma } from '../../../prisma/client';
import { HttpError } from '../../../utils/http-error';
import { fromDbAmount, parseNonNegativeAmount, toDbAmount } from '../../../utils/money';
import type { GameResolution } from '../core/game-engine.interface';

type OchkoVisibility = 'public' | 'private';
type OchkoPhase = 'waiting' | 'round' | 'round-end' | 'finished';
type OchkoSeatStatus = 'waiting' | 'active' | 'busted';
type CardVisibility = 'public' | 'private';

interface OchkoNumberCard {
  value: number;
}

export type OchkoActionCardType =
  | 'FORCE_DRAW_OPPONENT'
  | 'SWAP_LAST_DRAWN'
  | 'IMMUNITY'
  | 'SECRET_DRAW'
  | 'SET_TARGET_27'
  | 'SET_TARGET_17'
  | 'ALL_DRAW_ONE'
  | 'CANCEL_LAST_BONUS';

interface InternalCardRecord {
  card: OchkoNumberCard;
  visibility: CardVisibility;
}

interface LastDrawnCard {
  visibility: CardVisibility;
  index: number;
}

interface OchkoBonusLogEntry {
  kind: 'target' | 'immunity';
  playerId: string;
  previousValue: number | boolean;
}

interface InternalSeat {
  userId: string;
  playerLabel: string;
  avatarUrl: string | null;
  seatIndex: number;
  buyIn: number;
  isReady: boolean;
  roundWins: number;
  status: OchkoSeatStatus;
  targetTotal: number;
  cards: InternalCardRecord[];
  actionCards: OchkoActionCardType[];
  immunityArmed: boolean;
  lastDrawn: LastDrawnCard | null;
}

export interface OchkoDisplayCard {
  hidden?: boolean;
  rank?: string;
  suit?: string;
}

export interface OchkoActionCardView {
  type: OchkoActionCardType;
  label: string;
  description: string;
  requiresTarget: boolean;
  targetMode: 'self' | 'opponent' | 'any' | 'none';
}

export interface OchkoPlayerView {
  userId: string;
  playerLabel: string;
  avatarUrl: string | null;
  seatIndex: number;
  isSelf: boolean;
  isReady: boolean;
  status: OchkoSeatStatus;
  roundWins: number;
  targetTotal: number;
  visibleTotal: number;
  total: number | null;
  publicCards: OchkoDisplayCard[];
  privateCards: OchkoDisplayCard[];
  actionCards: OchkoActionCardView[];
  immunityArmed: boolean;
}

export interface OchkoWinnerView {
  userId: string;
  playerLabel: string;
  roundWins: number;
  payout: number;
}

export interface OchkoTableSummary {
  sessionId: string;
  roomName: string;
  visibility: OchkoVisibility;
  maxPlayers: number;
  playerCount: number;
  buyIn: number;
  roundNumber: number;
  phase: OchkoPhase;
  requiresPassword: boolean;
}

export interface OchkoLobbyState {
  kind: 'lobby';
  rooms: OchkoTableSummary[];
  notes: string;
}

export interface OchkoRoomState {
  kind: 'room';
  roomId: string;
  roomName: string;
  visibility: OchkoVisibility;
  requiresPassword: boolean;
  maxPlayers: number;
  buyIn: number;
  totalRounds: number;
  roundNumber: number;
  phase: OchkoPhase;
  pot: number;
  currentPlayerId?: string;
  currentPlayerLabel?: string;
  players: OchkoPlayerView[];
  winners: OchkoWinnerView[];
  recentEvents: string[];
  notes: string;
  phaseEndsAt?: string;
  isSeated: boolean;
  canJoin: boolean;
}

export interface OchkoPlayerEnvelope {
  sessionId: string;
  gameType: 'OCHKO';
  status: GameSessionStatus;
  balance: number;
  currentBet: number;
  state: OchkoLobbyState | OchkoRoomState;
  outcome: GameResolution | null;
}

interface OchkoRoomConfig {
  sessionId: string;
  roomName: string;
  visibility: OchkoVisibility;
  password: string | null;
  buyIn: number;
  maxPlayers: number;
  ownerUserId: string;
}

const LOBBY_SESSION_ID = 'ochko-lobby';
const TOTAL_ROUNDS = 5;
const MAX_ACTION_CARDS = 3;
const START_DELAY_MS = 3_500;
const ROUND_END_DELAY_MS = 4_500;
const MIN_BUY_IN = 100;
const ROOM_PLAYERS = 2;
const ACTION_DROP_CHANCE = 0.65;
const EVENT_LIMIT = 8;

const actionCardCatalog: Record<OchkoActionCardType, OchkoActionCardView> = {
  FORCE_DRAW_OPPONENT: {
    type: 'FORCE_DRAW_OPPONENT',
    label: 'Force Draw',
    description: 'Choose an opponent and force them to take one public card.',
    requiresTarget: true,
    targetMode: 'opponent'
  },
  SWAP_LAST_DRAWN: {
    type: 'SWAP_LAST_DRAWN',
    label: 'Swap Last Drawn',
    description: 'Swap your latest drawn card with the latest drawn card of an opponent.',
    requiresTarget: true,
    targetMode: 'opponent'
  },
  IMMUNITY: {
    type: 'IMMUNITY',
    label: 'Immunity',
    description: 'One-time shield. A bust card gets moved to the bottom of the deck instead.',
    requiresTarget: false,
    targetMode: 'self'
  },
  SECRET_DRAW: {
    type: 'SECRET_DRAW',
    label: 'Secret Draw',
    description: 'Draw a private card that only you can see.',
    requiresTarget: false,
    targetMode: 'self'
  },
  SET_TARGET_27: {
    type: 'SET_TARGET_27',
    label: 'Play To 27',
    description: 'Set a player target to 27 for this round.',
    requiresTarget: true,
    targetMode: 'any'
  },
  SET_TARGET_17: {
    type: 'SET_TARGET_17',
    label: 'Play To 17',
    description: 'Set a player target to 17 for this round.',
    requiresTarget: true,
    targetMode: 'any'
  },
  ALL_DRAW_ONE: {
    type: 'ALL_DRAW_ONE',
    label: 'All Draw One',
    description: 'Every non-busted player draws one public card.',
    requiresTarget: false,
    targetMode: 'none'
  },
  CANCEL_LAST_BONUS: {
    type: 'CANCEL_LAST_BONUS',
    label: 'Cancel Bonus',
    description: 'Revert the latest active immunity or target modifier.',
    requiresTarget: false,
    targetMode: 'none'
  }
};

const actionCardPool = Object.keys(actionCardCatalog) as OchkoActionCardType[];

const buildOchkoDeck = (playerCount: number): OchkoNumberCard[] => {
  const deckCopies = 1 + Math.ceil(Math.max(0, playerCount - 2) / 2);
  const cards: OchkoNumberCard[] = [];

  for (let copy = 0; copy < deckCopies; copy += 1) {
    for (let value = 1; value <= 11; value += 1) {
      cards.push({ value });
    }
  }

  return cards;
};

const shuffleOchkoDeck = (deck: OchkoNumberCard[]): OchkoNumberCard[] => {
  const cards = [...deck];

  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }

  return cards;
};

const drawOchkoCard = (deck: OchkoNumberCard[]): OchkoNumberCard => {
  const card = deck.shift();

  if (!card) {
    throw new Error('Deck is empty.');
  }

  return card;
};

const buildRoomId = (): string => `ochko-${Math.random().toString(36).slice(2, 10)}`;

const formatPlayerLabel = (email: string, username?: string | null): string => {
  const normalizedUsername = String(username || '').trim();

  if (normalizedUsername) {
    return normalizedUsername;
  }

  const [localPart] = email.split('@');
  const cleaned = String(localPart || 'player').replace(/[^a-z0-9]/gi, '');
  if (cleaned.length <= 4) {
    return cleaned.toLowerCase();
  }

  return `${cleaned.slice(0, 4).toLowerCase()}*`;
};

const normalizeRoomConfig = (payload?: Record<string, unknown>): Omit<OchkoRoomConfig, 'sessionId' | 'ownerUserId'> => {
  const visibility = payload?.visibility === 'private' ? 'private' : 'public';
  const roomName = String(payload?.roomName || '').trim() || 'Ochko Arena';
  const buyIn = parseNonNegativeAmount(payload?.buyIn ?? MIN_BUY_IN, 'Buy-in');
  const password = visibility === 'private' ? String(payload?.password || '').trim() : '';

  if (buyIn < MIN_BUY_IN) {
    throw new HttpError(400, `Buy-in must be at least ${MIN_BUY_IN} credits.`);
  }

  if (visibility === 'private' && !/^\d{5}$/.test(password)) {
    throw new HttpError(400, 'Private Ochko rooms require a 5-digit numeric password.');
  }

  return {
    roomName,
    visibility,
    password: visibility === 'private' ? password : null,
    buyIn,
    maxPlayers: ROOM_PLAYERS
  };
};

const normalizeJoinConfig = (payload?: Record<string, unknown>): { sessionId: string; password?: string } => {
  const sessionId = String(payload?.sessionId || '').trim();
  const password = String(payload?.password || '').trim() || undefined;

  if (!sessionId) {
    throw new HttpError(400, 'Choose an Ochko room before trying to join.');
  }

  return {
    sessionId,
    password
  };
};

const cardToView = (card: OchkoNumberCard): OchkoDisplayCard => ({
  rank: String(card.value)
});

const calculateBestTotal = (cards: OchkoNumberCard[], target: number): number | null => {
  const total = cards.reduce((sum, card) => sum + card.value, 0);
  return total > target ? null : total;
};

const calculateVisibleTotal = (seat: InternalSeat): number => {
  const publicCards = seat.cards.filter((entry) => entry.visibility === 'public').map((entry) => entry.card);
  return calculateBestTotal(publicCards, seat.targetTotal) ?? publicCards.reduce((sum, card) => sum + card.value, 0);
};

const getSeatTotal = (seat: InternalSeat): number | null =>
  calculateBestTotal(seat.cards.map((entry) => entry.card), seat.targetTotal);

class OchkoRoom {
  readonly sessionId: string;
  readonly roomName: string;
  readonly visibility: OchkoVisibility;
  readonly password: string | null;
  readonly buyIn: number;
  readonly maxPlayers: number;
  readonly ownerUserId: string;

  phase: OchkoPhase = 'waiting';
  roundNumber = 0;
  readonly totalRounds = TOTAL_ROUNDS;
  notes = 'Waiting for one opponent. Both players must ready up to begin the five-round duel.';
  phaseEndsAt?: number;
  currentPlayerId?: string;
  winners: OchkoWinnerView[] = [];
  recentEvents: string[] = [];

  private readonly seats: InternalSeat[] = [];
  private readonly lastOutcomeByUser = new Map<string, GameResolution>();
  private readonly bonusLog: OchkoBonusLogEntry[] = [];
  private startTimer: NodeJS.Timeout | null = null;
  private roundEndTimer: NodeJS.Timeout | null = null;
  private deck: OchkoNumberCard[] = [];
  private currentTurnActions = 0;

  constructor(
    config: OchkoRoomConfig,
    private readonly onStateChange: () => void
  ) {
    this.sessionId = config.sessionId;
    this.roomName = config.roomName;
    this.visibility = config.visibility;
    this.password = config.password;
    this.buyIn = config.buyIn;
    this.maxPlayers = config.maxPlayers;
    this.ownerUserId = config.ownerUserId;
  }

  get playerCount(): number {
    return this.seats.length;
  }

  get pot(): number {
    return this.seats.reduce((sum, seat) => sum + seat.buyIn, 0);
  }

  isPrivate(): boolean {
    return this.visibility === 'private';
  }

  hasUser(userId: string): boolean {
    return this.seats.some((seat) => seat.userId === userId);
  }

  isEmpty(): boolean {
    return this.seats.length === 0;
  }

  canAcceptSeat(): boolean {
    return this.phase === 'waiting' && this.seats.length < ROOM_PLAYERS;
  }

  getLastOutcome(userId: string): GameResolution | null {
    return this.lastOutcomeByUser.get(userId) || null;
  }

  addSeat(user: { id: string; email: string; username: string | null; avatarUrl: string | null }): void {
    if (this.seats.length >= this.maxPlayers) {
      throw new HttpError(400, 'That Ochko room is already full.');
    }

    if (this.hasUser(user.id)) {
      return;
    }

    this.seats.push({
      userId: user.id,
      playerLabel: formatPlayerLabel(user.email, user.username),
      avatarUrl: user.avatarUrl,
      seatIndex: this.seats.length,
      buyIn: this.buyIn,
      isReady: false,
      roundWins: 0,
      status: 'waiting',
      targetTotal: 21,
      cards: [],
      actionCards: [],
      immunityArmed: false,
      lastDrawn: null
    });

    this.notes = 'A new challenger joined the room. Ready up when everyone is seated.';
    this.emit();
  }

  removeSeat(userId: string): { refundAmount: number } {
    const seatIndex = this.seats.findIndex((seat) => seat.userId === userId);

    if (seatIndex === -1) {
      return {
        refundAmount: 0
      };
    }

    if (this.phase === 'round' || this.phase === 'round-end') {
      throw new HttpError(400, 'The five-round match is already live. Finish it before leaving the room.');
    }

    const [seat] = this.seats.splice(seatIndex, 1);
    this.reindexSeats();
    this.clearStartTimer();

    if (this.phase === 'waiting') {
      this.notes = this.seats.length > 0
        ? 'Opponent left. Waiting for a new challenger.'
        : 'Room is empty.';
      this.phaseEndsAt = undefined;
      this.emit();
      return {
        refundAmount: seat.buyIn
      };
    }

    this.emit();
    return {
      refundAmount: 0
    };
  }

  readySeat(userId: string): void {
    if (this.phase !== 'waiting') {
      throw new HttpError(400, 'Ready checks are only available before the match starts.');
    }

    const seat = this.requireSeat(userId);
    seat.isReady = true;

    if (this.seats.length === ROOM_PLAYERS && this.seats.every((entry) => entry.isReady)) {
      this.scheduleMatchStart();
    } else {
      this.notes = `Waiting for ${Math.max(0, this.seats.filter((entry) => !entry.isReady).length)} more ready check${this.seats.filter((entry) => !entry.isReady).length === 1 ? '' : 's'}.`;
    }

    this.emit();
  }

  buildSummary(): OchkoTableSummary {
    return {
      sessionId: this.sessionId,
      roomName: this.roomName,
      visibility: this.visibility,
      maxPlayers: this.maxPlayers,
      playerCount: this.seats.length,
      buyIn: this.buyIn,
      roundNumber: this.roundNumber,
      phase: this.phase,
      requiresPassword: this.isPrivate()
    };
  }

  buildStateForUser(userId: string): OchkoRoomState {
    const currentSeat = this.seats.find((seat) => seat.userId === this.currentPlayerId);
    const players = [...this.seats]
      .sort((left, right) => left.seatIndex - right.seatIndex)
      .map((seat) => {
        const self = seat.userId === userId;
        const isRoundReveal = this.phase !== 'round';
        const privateCards = seat.cards
          .filter((entry) => entry.visibility === 'private')
          .map((entry) => (self || isRoundReveal ? cardToView(entry.card) : { hidden: true }));

        return {
          userId: seat.userId,
          playerLabel: seat.playerLabel,
          avatarUrl: seat.avatarUrl,
          seatIndex: seat.seatIndex,
          isSelf: self,
          isReady: seat.isReady,
          status: self || isRoundReveal ? seat.status : seat.status === 'waiting' ? 'waiting' : 'active',
          roundWins: seat.roundWins,
          targetTotal: seat.targetTotal,
          visibleTotal: calculateVisibleTotal(seat),
          total: self || isRoundReveal ? getSeatTotal(seat) : null,
          publicCards: seat.cards.filter((entry) => entry.visibility === 'public').map((entry) => cardToView(entry.card)),
          privateCards,
          actionCards: self ? seat.actionCards.map((type) => actionCardCatalog[type]) : [],
          immunityArmed: seat.immunityArmed
        } satisfies OchkoPlayerView;
      });

    return {
      kind: 'room',
      roomId: this.sessionId,
      roomName: this.roomName,
      visibility: this.visibility,
      requiresPassword: this.isPrivate(),
      maxPlayers: this.maxPlayers,
      buyIn: this.buyIn,
      totalRounds: this.totalRounds,
      roundNumber: this.roundNumber,
      phase: this.phase,
      pot: this.pot,
      currentPlayerId: this.currentPlayerId,
      currentPlayerLabel: currentSeat?.playerLabel,
      players,
      winners: [...this.winners],
      recentEvents: [...this.recentEvents],
      notes: this.notes,
      phaseEndsAt: this.phaseEndsAt ? new Date(this.phaseEndsAt).toISOString() : undefined,
      isSeated: this.hasUser(userId),
      canJoin: this.canAcceptSeat()
    };
  }

  async performAction(userId: string, action: string, payload?: Record<string, unknown>): Promise<void> {
    if (this.phase !== 'round') {
      throw new HttpError(400, 'Ochko actions are only available during a live round.');
    }

    if (this.currentPlayerId !== userId) {
      throw new HttpError(400, 'Wait for your turn before acting.');
    }

    const seat = this.requireSeat(userId);

    if (seat.status !== 'active') {
      throw new HttpError(400, 'This seat can no longer act in the current round.');
    }

    if (action === 'draw-card') {
      this.drawToSeat(seat, 'public', `${seat.playerLabel} drew a public card.`);
      this.currentTurnActions += 1;
      const seatBusted = this.requireSeat(userId).status === 'busted';

      if (seatBusted) {
        this.advanceTurn();
      } else {
        this.notes = `${seat.playerLabel} can keep drawing, cast a spell, or end the turn.`;
      }

      this.emit();
      return;
    }

    if (action === 'stand' || action === 'end-turn') {
      if (this.currentTurnActions === 0) {
        this.notes = `${seat.playerLabel} passed without acting. Round ${this.roundNumber} is resolving.`;
        await this.endRound();
      } else {
        this.pushEvent(`${seat.playerLabel} ended the turn after ${this.currentTurnActions} action${this.currentTurnActions === 1 ? '' : 's'}.`);
        this.advanceTurn();
      }

      this.emit();
      return;
    }

    if (action === 'play-action-card') {
      const cardType = String(payload?.cardType || '') as OchkoActionCardType;
      const targetUserId = payload?.targetUserId ? String(payload.targetUserId) : undefined;
      this.playActionCard(seat, cardType, targetUserId);
      this.currentTurnActions += 1;
      const seatBusted = this.requireSeat(userId).status === 'busted';

      if (seatBusted) {
        this.advanceTurn();
      } else {
        this.notes = `${seat.playerLabel} can keep pushing the turn or end it.`;
      }

      this.emit();
      return;
    }

    throw new HttpError(400, `Unsupported Ochko action: ${action}`);
  }

  async settleMatch(): Promise<void> {
    if (this.phase !== 'finished' || this.winners.length === 0) {
      return;
    }

    const payoutsByUser = new Map(this.winners.map((winner) => [winner.userId, winner.payout]));

    await prisma.$transaction(async (tx) => {
      for (const seat of this.seats) {
        const payout = payoutsByUser.get(seat.userId) || 0;
        const balanceChange = payout - seat.buyIn;

        await tx.gameHistory.create({
          data: {
            userId: seat.userId,
            gameType: GameType.OCHKO,
            betAmount: toDbAmount(seat.buyIn),
            result: payout > 0 ? 'MATCH_WIN' : 'MATCH_LOSS',
            balanceChange: toDbAmount(balanceChange)
          }
        });

        if (payout > 0) {
          await tx.user.update({
            where: { id: seat.userId },
            data: {
              balance: {
                increment: toDbAmount(payout)
              }
            }
          });
        }

        this.lastOutcomeByUser.set(seat.userId, {
          result: payout > 0 ? 'MATCH_WIN' : 'MATCH_LOSS',
          balanceChange,
          betAmount: seat.buyIn
        });
      }
    });
  }

  private scheduleMatchStart(): void {
    if (this.startTimer) {
      return;
    }

    this.phaseEndsAt = Date.now() + START_DELAY_MS;
    this.notes = 'All seats ready. Match starts in a moment.';
    this.startTimer = setTimeout(() => {
      void this.startRound();
    }, START_DELAY_MS);
  }

  private async startRound(): Promise<void> {
    this.clearStartTimer();
    this.clearRoundEndTimer();

    if (this.seats.length !== ROOM_PLAYERS) {
      this.phase = 'waiting';
      this.phaseEndsAt = undefined;
      this.notes = 'Ochko requires exactly two players.';
      this.emit();
      return;
    }

    this.phase = 'round';
    this.roundNumber += 1;
    this.phaseEndsAt = undefined;
    this.bonusLog.length = 0;
    this.deck = shuffleOchkoDeck(buildOchkoDeck(this.seats.length));
    this.winners = [];
    this.recentEvents = [];
    this.currentTurnActions = 0;

    for (const seat of this.seats) {
      seat.status = 'active';
      seat.targetTotal = 21;
      seat.cards = [];
      seat.immunityArmed = false;
      seat.lastDrawn = null;
      seat.cards.push({ card: drawOchkoCard(this.deck), visibility: 'public' });
      seat.cards.push({ card: drawOchkoCard(this.deck), visibility: 'private' });
      seat.lastDrawn = {
        visibility: 'private',
        index: 1
      };

      if (seat.actionCards.length < MAX_ACTION_CARDS && Math.random() < ACTION_DROP_CHANCE) {
        const droppedCard = actionCardPool[Math.floor(Math.random() * actionCardPool.length)];
        if (droppedCard) {
          seat.actionCards.push(droppedCard);
          this.pushEvent(`${seat.playerLabel} found ${actionCardCatalog[droppedCard].label}.`);
        }
      }
    }

    const firstSeat = this.seats[(this.roundNumber - 1) % this.seats.length];
    this.currentPlayerId = firstSeat?.userId;
    this.notes = `${firstSeat?.playerLabel || 'Player'} opens round ${this.roundNumber}/${this.totalRounds}.`;
    this.pushEvent(`Round ${this.roundNumber} started. Everyone has one open card and one secret card.`);
    this.emit();
  }

  private drawToSeat(seat: InternalSeat, visibility: CardVisibility, eventLabel?: string): void {
    const drawnCard = drawOchkoCard(this.deck);
    const nextIndex = seat.cards.length;
    seat.cards.push({
      card: drawnCard,
      visibility
    });
    seat.lastDrawn = {
      visibility,
      index: nextIndex
    };

    const resolvedSafely = this.resolveSeatAfterRiskyCard(seat, nextIndex, drawnCard);

    if (resolvedSafely && eventLabel) {
      this.pushEvent(eventLabel);
    }
  }

  private playActionCard(seat: InternalSeat, type: OchkoActionCardType, targetUserId?: string): void {
    const index = seat.actionCards.indexOf(type);

    if (index === -1) {
      throw new HttpError(400, 'That action card is not in your hand.');
    }

    switch (type) {
      case 'FORCE_DRAW_OPPONENT': {
        const target = this.requireTargetSeat(seat.userId, targetUserId, 'opponent');
        seat.actionCards.splice(index, 1);
        this.drawToSeat(target, 'public', `${seat.playerLabel} forced ${target.playerLabel} to draw.`);
        break;
      }
      case 'SWAP_LAST_DRAWN': {
        const target = this.requireTargetSeat(seat.userId, targetUserId, 'opponent');
        if (!seat.lastDrawn || !target.lastDrawn) {
          throw new HttpError(400, 'Both players need a latest drawn card to swap.');
        }

        const seatRecord = seat.cards[seat.lastDrawn.index];
        const targetRecord = target.cards[target.lastDrawn.index];

        if (!seatRecord || !targetRecord) {
          throw new HttpError(400, 'Could not resolve the latest drawn cards for the swap.');
        }

        seat.actionCards.splice(index, 1);
        seat.cards[seat.lastDrawn.index] = targetRecord;
        target.cards[target.lastDrawn.index] = seatRecord;

        const seatStayedSafe = this.resolveSeatAfterRiskyCard(seat, seat.lastDrawn.index, targetRecord.card);
        const targetStayedSafe = this.resolveSeatAfterRiskyCard(target, target.lastDrawn.index, seatRecord.card);

        if (seatStayedSafe && targetStayedSafe) {
          this.pushEvent(`${seat.playerLabel} swapped their latest draw with ${target.playerLabel}.`);
        }
        break;
      }
      case 'IMMUNITY':
        seat.actionCards.splice(index, 1);
        this.bonusLog.push({
          kind: 'immunity',
          playerId: seat.userId,
          previousValue: seat.immunityArmed
        });
        seat.immunityArmed = true;
        this.pushEvent(`${seat.playerLabel} armed immunity.`);
        break;
      case 'SECRET_DRAW':
        seat.actionCards.splice(index, 1);
        this.drawToSeat(seat, 'private', `${seat.playerLabel} drew a private card.`);
        break;
      case 'SET_TARGET_27': {
        const target = this.requireTargetSeat(seat.userId, targetUserId, 'any');
        seat.actionCards.splice(index, 1);
        this.bonusLog.push({
          kind: 'target',
          playerId: target.userId,
          previousValue: target.targetTotal
        });
        target.targetTotal = 27;
        this.pushEvent(`${seat.playerLabel} set ${target.playerLabel}'s cap to 27.`);
        break;
      }
      case 'SET_TARGET_17': {
        const target = this.requireTargetSeat(seat.userId, targetUserId, 'any');
        seat.actionCards.splice(index, 1);
        this.bonusLog.push({
          kind: 'target',
          playerId: target.userId,
          previousValue: target.targetTotal
        });
        target.targetTotal = 17;
        this.pushEvent(`${seat.playerLabel} forced ${target.playerLabel} to play to 17.`);
        break;
      }
      case 'ALL_DRAW_ONE':
        seat.actionCards.splice(index, 1);
        for (const target of this.seats.filter((entry) => entry.status !== 'busted')) {
          this.drawToSeat(target, 'public');
        }
        this.pushEvent(`${seat.playerLabel} triggered a table-wide draw.`);
        break;
      case 'CANCEL_LAST_BONUS': {
        const previous = this.bonusLog.pop();

        if (!previous) {
          throw new HttpError(400, 'There is no active bonus left to cancel.');
        }

        seat.actionCards.splice(index, 1);
        const target = this.requireSeat(previous.playerId);
        if (previous.kind === 'target') {
          target.targetTotal = Number(previous.previousValue);
          this.pushEvent(`${seat.playerLabel} cancelled the latest target modifier.`);
        } else {
          target.immunityArmed = Boolean(previous.previousValue);
          this.pushEvent(`${seat.playerLabel} cancelled the latest immunity effect.`);
        }
        break;
      }
      default:
        throw new HttpError(400, `Unsupported Ochko action card: ${type}`);
    }
  }

  private resolveSeatAfterRiskyCard(seat: InternalSeat, cardIndex: number, riskyCard: OchkoNumberCard): boolean {
    const previousStatus = seat.status;
    const total = getSeatTotal(seat);

    if (total !== null) {
      seat.status = previousStatus;
      return true;
    }

    if (seat.immunityArmed) {
      seat.immunityArmed = false;
      seat.cards.splice(cardIndex, 1);
      this.deck.push(riskyCard);
      seat.lastDrawn = null;
      seat.status = previousStatus;
      this.pushEvent(`${seat.playerLabel} triggered immunity.`);
      return false;
    }

    seat.status = 'busted';
    return false;
  }

  private advanceTurn(): void {
    const activeSeats = this.seats.filter((seat) => seat.status === 'active');
    if (activeSeats.length === 0) {
      void this.endRound();
      return;
    }

    const currentIndex = this.currentPlayerId ? this.seats.findIndex((seat) => seat.userId === this.currentPlayerId) : -1;
    for (let offset = 1; offset <= this.seats.length; offset += 1) {
      const candidate = this.seats[(currentIndex + offset + this.seats.length) % this.seats.length];
      if (candidate && candidate.status === 'active') {
        this.currentPlayerId = candidate.userId;
        this.currentTurnActions = 0;
        this.notes = `${candidate.playerLabel} is up. They can chain cards and spells before ending the turn.`;
        return;
      }
    }
  }

  private async endRound(): Promise<void> {
    if (this.phase !== 'round') {
      return;
    }

    this.phase = 'round-end';
    this.currentPlayerId = undefined;
    this.currentTurnActions = 0;
    const eligibleSeats = this.seats
      .map((seat) => ({
        seat,
        total: getSeatTotal(seat)
      }))
      .filter((entry) => entry.total !== null) as Array<{ seat: InternalSeat; total: number }>;

    const bestTotal = eligibleSeats.reduce((best, entry) => Math.max(best, entry.total), 0);
    const roundWinners = eligibleSeats.filter((entry) => entry.total === bestTotal).map((entry) => entry.seat);

    for (const winner of roundWinners) {
      winner.roundWins += 1;
    }

    if (roundWinners.length === 0) {
      this.notes = `Round ${this.roundNumber} ended with a full bust.`;
    } else if (roundWinners.length === 1) {
      this.notes = `${roundWinners[0]!.playerLabel} took round ${this.roundNumber} with ${bestTotal}.`;
    } else {
      this.notes = `${roundWinners.map((winner) => winner.playerLabel).join(', ')} split round ${this.roundNumber} at ${bestTotal}.`;
    }

    if (this.roundNumber >= this.totalRounds) {
      this.finishMatch();
      await this.settleMatch();
      this.emit();
      return;
    }

    this.phaseEndsAt = Date.now() + ROUND_END_DELAY_MS;
    this.roundEndTimer = setTimeout(() => {
      void this.startRound();
    }, ROUND_END_DELAY_MS);
  }

  private finishMatch(): void {
    this.clearRoundEndTimer();
    this.phase = 'finished';
    this.phaseEndsAt = undefined;
    this.currentPlayerId = undefined;

    const highestScore = this.seats.reduce((best, seat) => Math.max(best, seat.roundWins), 0);
    const winners = this.seats.filter((seat) => seat.roundWins === highestScore);
    const payoutFloor = Math.floor(this.pot / Math.max(1, winners.length));
    let remainder = this.pot - payoutFloor * winners.length;

    this.winners = winners.map((seat) => {
      const payout = payoutFloor + (remainder > 0 ? 1 : 0);
      if (remainder > 0) {
        remainder -= 1;
      }

      return {
        userId: seat.userId,
        playerLabel: seat.playerLabel,
        roundWins: seat.roundWins,
        payout
      };
    });

    this.notes = this.winners.length === 1
      ? `${this.winners[0]!.playerLabel} won the five-round match.`
      : `${this.winners.map((winner) => winner.playerLabel).join(', ')} split the five-round match.`;
  }

  private requireSeat(userId: string): InternalSeat {
    const seat = this.seats.find((entry) => entry.userId === userId);

    if (!seat) {
      throw new HttpError(404, 'That player is not seated in this Ochko room.');
    }

    return seat;
  }

  private requireTargetSeat(actorUserId: string, targetUserId: string | undefined, mode: 'self' | 'opponent' | 'any'): InternalSeat {
    const normalizedTarget = String(targetUserId || '').trim();
    if (!normalizedTarget) {
      throw new HttpError(400, 'This action card needs a target.');
    }

    if (mode === 'self' && normalizedTarget !== actorUserId) {
      throw new HttpError(400, 'This action card can only target your own seat.');
    }

    if (mode === 'opponent' && normalizedTarget === actorUserId) {
      throw new HttpError(400, 'Choose an opponent for this action card.');
    }

    return this.requireSeat(normalizedTarget);
  }

  private reindexSeats(): void {
    for (const [seatIndex, seat] of this.seats.entries()) {
      seat.seatIndex = seatIndex;
    }
  }

  private clearStartTimer(): void {
    if (!this.startTimer) {
      return;
    }

    clearTimeout(this.startTimer);
    this.startTimer = null;
  }

  private clearRoundEndTimer(): void {
    if (!this.roundEndTimer) {
      return;
    }

    clearTimeout(this.roundEndTimer);
    this.roundEndTimer = null;
  }

  private pushEvent(message: string): void {
    this.recentEvents = [message, ...this.recentEvents].slice(0, EVENT_LIMIT);
  }

  private emit(): void {
    this.onStateChange();
  }
}

class OchkoTableManager {
  private readonly rooms = new Map<string, OchkoRoom>();
  private readonly userRoom = new Map<string, string>();
  private readonly listeners = new Set<() => void>();

  getLobbySessionId(): string {
    return LOBBY_SESSION_ID;
  }

  onStateChange(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async getStateForUser(userId: string, requestedSessionId = LOBBY_SESSION_ID): Promise<OchkoPlayerEnvelope> {
    const user = await this.requireUser(userId);
    const assignedRoomId = this.userRoom.get(userId);
    const room = this.resolveVisibleRoom(requestedSessionId, assignedRoomId);

    if (!room) {
      return {
        sessionId: LOBBY_SESSION_ID,
        gameType: GameType.OCHKO,
        status: GameSessionStatus.IDLE,
        balance: user.balance,
        currentBet: 0,
        state: {
          kind: 'lobby',
          rooms: [...this.rooms.values()]
            .map((entry) => entry.buildSummary())
            .filter((entry) => entry.visibility === 'public' || entry.playerCount > 0)
            .sort((left, right) => left.buyIn - right.buyIn || left.playerCount - right.playerCount),
          notes: 'Create a room or jump into an open Ochko table. Each match lasts exactly five rounds.'
        },
        outcome: null
      };
    }

    return {
      sessionId: room.sessionId,
      gameType: GameType.OCHKO,
      status: room.phase === 'finished' ? GameSessionStatus.COMPLETED : GameSessionStatus.WAITING_ACTION,
      balance: user.balance,
      currentBet: room.hasUser(userId) ? room.buyIn : 0,
      state: room.buildStateForUser(userId),
      outcome: room.getLastOutcome(userId)
    };
  }

  async createRoom(userId: string, payload?: Record<string, unknown>): Promise<string> {
    if (this.userRoom.has(userId)) {
      throw new HttpError(400, 'Leave your current Ochko room before creating another one.');
    }

    const config = normalizeRoomConfig(payload);
    const user = await this.reserveBalance(userId, config.buyIn);
    const room = new OchkoRoom(
      {
        ...config,
        sessionId: buildRoomId(),
        ownerUserId: userId
      },
      () => this.emitStateChange()
    );

    room.addSeat(user);
    this.rooms.set(room.sessionId, room);
    this.userRoom.set(userId, room.sessionId);
    this.emitStateChange();
    return room.sessionId;
  }

  async joinRoom(userId: string, payload?: Record<string, unknown>): Promise<string> {
    const currentRoomId = this.userRoom.get(userId);
    if (currentRoomId) {
      throw new HttpError(400, 'Leave your current Ochko room before joining another one.');
    }

    const config = normalizeJoinConfig(payload);
    const room = this.rooms.get(config.sessionId);

    if (!room) {
      throw new HttpError(404, 'That Ochko room was not found.');
    }

    if (room.isPrivate() && room.password !== config.password) {
      throw new HttpError(400, 'That private Ochko room password is incorrect.');
    }

    if (!room.canAcceptSeat()) {
      throw new HttpError(400, 'That Ochko duel is already full or in progress.');
    }

    const user = await this.reserveBalance(userId, room.buyIn);
    room.addSeat(user);
    this.userRoom.set(userId, room.sessionId);
    this.emitStateChange();
    return room.sessionId;
  }

  async readyRoom(userId: string, sessionId?: string): Promise<void> {
    const room = this.requireRoom(sessionId || this.userRoom.get(userId));
    room.readySeat(userId);
    this.emitStateChange();
  }

  async leaveRoom(userId: string): Promise<void> {
    const roomId = this.userRoom.get(userId);
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    this.userRoom.delete(userId);

    if (!room) {
      this.emitStateChange();
      return;
    }

    const { refundAmount } = room.removeSeat(userId);
    if (refundAmount > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: {
            increment: toDbAmount(refundAmount)
          }
        }
      });
    }

    if (room.isEmpty()) {
      this.rooms.delete(roomId);
    }

    this.emitStateChange();
  }

  async performAction(userId: string, sessionId: string | undefined, action: string, payload?: Record<string, unknown>): Promise<void> {
    const room = this.requireRoom(sessionId || this.userRoom.get(userId));
    await room.performAction(userId, action, payload);
    this.emitStateChange();
  }

  private async reserveBalance(userId: string, amount: number) {
    const updated = await prisma.user.updateMany({
      where: {
        id: userId,
        balance: {
          gte: toDbAmount(amount)
        }
      },
      data: {
        balance: {
          decrement: toDbAmount(amount)
        }
      }
    });

    if (updated.count === 0) {
      throw new HttpError(400, 'Insufficient demo balance for that Ochko room buy-in.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true
      }
    });

    if (!user) {
      throw new HttpError(404, 'Authenticated user could not be found.');
    }

    return user;
  }

  private async requireUser(userId: string): Promise<{ balance: number }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true }
    });

    if (!user) {
      throw new HttpError(404, 'Authenticated user could not be found.');
    }

    return {
      balance: fromDbAmount(user.balance)
    };
  }

  private resolveVisibleRoom(requestedSessionId?: string, assignedRoomId?: string): OchkoRoom | null {
    if (requestedSessionId && requestedSessionId !== LOBBY_SESSION_ID) {
      const room = this.rooms.get(requestedSessionId);
      if (room) {
        return room;
      }
    }

    if (assignedRoomId) {
      return this.rooms.get(assignedRoomId) || null;
    }

    return null;
  }

  private requireRoom(sessionId: string | undefined): OchkoRoom {
    if (!sessionId || sessionId === LOBBY_SESSION_ID) {
      throw new HttpError(400, 'Ochko room session is missing.');
    }

    const room = this.rooms.get(sessionId);

    if (!room) {
      throw new HttpError(404, 'That Ochko room was not found.');
    }

    return room;
  }

  private emitStateChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const ochkoTableManager = new OchkoTableManager();
