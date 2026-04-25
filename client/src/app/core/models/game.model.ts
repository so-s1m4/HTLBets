export type GameSlug = 'roulette' | 'blackjack' | 'poker';
export type GameType = 'ROULETTE' | 'BLACKJACK' | 'POKER';
export type GameStatus = 'IDLE' | 'WAITING_ACTION' | 'COMPLETED';

export interface GameOutcome {
  result: string;
  balanceChange: number;
  betAmount: number;
}

export interface RealtimeGameState {
  sessionId: string;
  gameType: GameType;
  status: GameStatus;
  balance: number;
  currentBet: number;
  state: Record<string, unknown>;
  outcome: GameOutcome | null;
}

export const gameSlugToType: Record<GameSlug, GameType> = {
  roulette: 'ROULETTE',
  blackjack: 'BLACKJACK',
  poker: 'POKER'
};

export const gameTypeLabels: Record<GameType, string> = {
  ROULETTE: 'Roulette',
  BLACKJACK: 'Blackjack',
  POKER: 'Poker'
};
