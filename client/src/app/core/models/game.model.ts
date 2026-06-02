export type GameSlug = 'roulette' | 'blackjack' | 'poker' | 'miner' | 'crash' | 'slots' | 'ochko' | 'mafia';
export type GameType = 'ROULETTE' | 'BLACKJACK' | 'POKER' | 'MINER' | 'CRASH' | 'SLOTS' | 'OCHKO' | 'MAFIA' | 'ADMIN';
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

export interface OchkoDisplayCard {
  hidden?: boolean;
  rank?: string;
  suit?: string;
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
  avatarUrl?: string | null;
  seatIndex: number;
  isSelf: boolean;
  isReady: boolean;
  status: 'waiting' | 'active' | 'busted';
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
  visibility: 'public' | 'private';
  maxPlayers: number;
  playerCount: number;
  buyIn: number;
  roundNumber: number;
  phase: 'waiting' | 'round' | 'round-end' | 'finished';
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
  visibility: 'public' | 'private';
  requiresPassword: boolean;
  maxPlayers: number;
  buyIn: number;
  totalRounds: number;
  roundNumber: number;
  phase: 'waiting' | 'round' | 'round-end' | 'finished';
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

export type OchkoRealtimeState = OchkoLobbyState | OchkoRoomState;

export type MafiaRoleKey = 'mafia' | 'detective' | 'doctor' | 'jester' | 'civilian';

export interface MafiaRoleConfigView {
  key: MafiaRoleKey;
  label: string;
  count: number;
}

export interface MafiaPlayerView {
  userId: string;
  playerLabel: string;
  avatarUrl?: string | null;
  seatIndex: number;
  isSelf: boolean;
  isOwner: boolean;
  alive: boolean;
  roleHint?: string | null;
  revealedRole?: MafiaRoleKey | null;
  isKnownAlly?: boolean;
}

export interface MafiaChatMessageView {
  id: string;
  userId: string;
  playerLabel: string;
  text: string;
  createdAt: string;
  isSystem?: boolean;
}

export interface MafiaRoomSummary {
  sessionId: string;
  roomName: string;
  visibility: 'public' | 'private';
  maxPlayers: number;
  playerCount: number;
  requiresPassword: boolean;
  videoEnabled: boolean;
  textChatEnabled: boolean;
  roles: MafiaRoleConfigView[];
}

export interface MafiaLobbyState {
  kind: 'lobby';
  rooms: MafiaRoomSummary[];
  notes: string;
}

export interface MafiaRoomState {
  kind: 'room';
  roomId: string;
  roomName: string;
  visibility: 'public' | 'private';
  requiresPassword: boolean;
  maxPlayers: number;
  ownerUserId: string;
  phase: 'waiting' | 'mafia-intro' | 'night' | 'day' | 'voting' | 'resolved';
  roundNumber: number;
  videoEnabled: boolean;
  textChatEnabled: boolean;
  roles: MafiaRoleConfigView[];
  players: MafiaPlayerView[];
  messages: MafiaChatMessageView[];
  notes: string;
  phaseEndsAt?: string;
  isSeated: boolean;
  canJoin: boolean;
  selfRole?: MafiaRoleKey | null;
  selfTeamHint?: string | null;
  lastInvestigation?: string | null;
  actionOptions?: Array<{ userId: string; playerLabel: string }>;
  hasSubmittedAction?: boolean;
  canStartGame?: boolean;
  canAdvanceIntro?: boolean;
  canAdvancePhase?: boolean;
  winners?: Array<{ side: 'town' | 'mafia' | 'jester'; label: string }>;
}

export type MafiaRealtimeState = MafiaLobbyState | MafiaRoomState;

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
  winners?: number;
  players?: number;
}

export interface CrashPlayerView {
  userId: string;
  playerLabel: string;
  avatarUrl?: string | null;
  stake: number;
  status: 'queued' | 'live' | 'cashed-out' | 'busted';
  cashOutMultiplier: number | null;
  isSelf: boolean;
}

export interface CrashViewState {
  phase: 'betting' | 'live' | 'resolved';
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
  slots: 'SLOTS',
  ochko: 'OCHKO',
  mafia: 'MAFIA'
};

export const gameTypeLabels: Record<GameType, string> = {
  ROULETTE: 'Roulette',
  BLACKJACK: 'Blackjack',
  POKER: 'Poker',
  MINER: 'Miner',
  CRASH: 'Crash',
  SLOTS: 'Slots',
  OCHKO: 'Ochko',
  MAFIA: 'Mafia',
  ADMIN: 'Admin'
};
