export type GameSlug = 'roulette' | 'blackjack' | 'poker' | 'miner' | 'crash' | 'slots';
export type GameType = 'ROULETTE' | 'BLACKJACK' | 'POKER' | 'MINER' | 'CRASH' | 'SLOTS' | 'ADMIN';
export type GameStatus = 'IDLE' | 'WAITING_ACTION' | 'COMPLETED';

export interface GameOutcome {
  result: string;
  balanceChange: number;
  betAmount: number;
}

export interface PokerDisplayCard {
  hidden?: boolean;
  rank?: string;
  suit?: string;
}

export interface PokerSeatView {
  userId: string;
  playerLabel: string;
  avatarUrl?: string | null;
  selectedCardDeckId: string;
  cardBackAsset: string;
  cardFaceTemplate: string;
  emoteText?: string | null;
  isReady?: boolean;
  buyIn: number;
  stackRemaining: number;
  totalContribution: number;
  streetContribution: number;
  status: 'waiting' | 'active' | 'folded' | 'all-in' | 'busted';
  seatIndex: number;
  isSelf: boolean;
  cards: PokerDisplayCard[];
  evaluation?: { label: string } | null;
  lastAction?: string;
}

export interface PokerWinnerView {
  userId: string;
  playerLabel: string;
  hand: string;
}

export interface PokerTableSummary {
  sessionId: string;
  tableName: string;
  visibility: 'public' | 'private';
  maxPlayers: number;
  playerCount: number;
  minBuyIn: number;
  phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'resolved';
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
  visibility: 'public' | 'private';
  tableCardBackAsset?: string;
  tableCardFaceTemplate?: string;
  requiresPassword: boolean;
  maxPlayers: number;
  minBuyIn: number;
  ownerUserId: string;
  phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'resolved';
  pot: number;
  currentBet: number;
  actingUserId?: string;
  minRaiseTo?: number;
  allowedActions?: Array<'check' | 'call' | 'raise' | 'all-in' | 'fold'>;
  players: PokerSeatView[];
  communityCards: PokerDisplayCard[];
  winners?: PokerWinnerView[];
  dealStartsAt?: string;
  phaseEndsAt?: string;
  notes: string;
  isSeated: boolean;
  canJoin: boolean;
}

export type PokerRealtimeState = PokerLobbyState | PokerTableState;

export interface RealtimeGameState {
  sessionId: string;
  gameType: GameType;
  status: GameStatus;
  balance: number;
  currentBet: number;
  state: Record<string, unknown>;
  outcome: GameOutcome | null;
}

export type MinerCellView = 'hidden' | 'safe' | 'mine';

export interface MinerViewState {
  phase: 'ready' | 'playing' | 'resolved';
  gridSize: number;
  mineCount: number;
  revealedSafeCount: number;
  payoutMultiplier: number;
  message: string;
  cells: MinerCellView[];
}

export interface CrashHistoryEntry {
  result: string;
  multiplier: number;
}

export interface CrashViewState {
  phase: 'ready' | 'live' | 'resolved';
  startTime: string | null;
  lastSettledMultiplier: number;
  message: string;
  history: CrashHistoryEntry[];
}

export interface SlotsMachineSummary {
  id: string;
  name: string;
  accent: string;
  volatility: 'low' | 'medium' | 'high';
  description: string;
  topMultiplier: number;
}

export interface SlotsViewState {
  phase: 'ready' | 'resolved';
  selectedMachineId: string;
  visibleGrid: string[][];
  winLines: number[];
  payoutMultiplier: number;
  message: string;
  history: Array<{
    machineId: string;
    result: string;
    payoutMultiplier: number;
  }>;
  machines: SlotsMachineSummary[];
}

export const gameSlugToType: Record<GameSlug, GameType> = {
  roulette: 'ROULETTE',
  blackjack: 'BLACKJACK',
  poker: 'POKER',
  miner: 'MINER',
  crash: 'CRASH',
  slots: 'SLOTS'
};

export const gameTypeLabels: Record<GameType, string> = {
  ROULETTE: 'Roulette',
  BLACKJACK: 'Blackjack',
  POKER: 'Poker',
  MINER: 'Miner',
  CRASH: 'Crash',
  SLOTS: 'Slots',
  ADMIN: 'Admin'
};
