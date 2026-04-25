export interface User {
  id: string;
  email: string;
  username: string | null;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface GameHistoryRecord {
  id: string;
  gameType: 'ROULETTE' | 'BLACKJACK' | 'POKER';
  betAmount: number;
  result: string;
  balanceChange: number;
  createdAt: string;
}
