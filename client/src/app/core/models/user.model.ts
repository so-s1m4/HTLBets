export interface User {
  id: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  balance: number;
  isAdmin: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTask {
  key: string;
  title: string;
  description: string;
  reward: number;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

export interface DailyTaskClaimResponse {
  user: User;
  task: DailyTask;
}

export interface GameHistoryRecord {
  id: string;
  gameType: 'ROULETTE' | 'BLACKJACK' | 'POKER';
  betAmount: number;
  result: string;
  balanceChange: number;
  createdAt: string;
}
