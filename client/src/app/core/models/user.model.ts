export interface User {
  id: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  selectedCardDeckId: string;
  balance: number;
  isAdmin: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CardDeck {
  id: string;
  name: string;
  price: number;
  backImageUrl: string;
  faceImageTemplate: string;
  isDefault: boolean;
  enabled: boolean;
  owned: boolean;
  selected: boolean;
}

export interface CardDeckMutationResponse {
  user: User;
  decks: CardDeck[];
}

export interface AdminCardDeck {
  id: string;
  name: string;
  price: number;
  backImageUrl: string;
  faceImageTemplate: string;
  isDefault: boolean;
  enabled: boolean;
  purchaseCount: number;
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
  gameType: 'ROULETTE' | 'BLACKJACK' | 'POKER' | 'ADMIN';
  betAmount: number;
  result: string;
  balanceChange: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  metricValue: number;
}

export interface LeaderboardSnapshot {
  richest: LeaderboardEntry[];
  mostLosses: LeaderboardEntry[];
  biggestWin: LeaderboardEntry[];
  refreshedAt: string;
}

export interface ProfileLeaderboardTag {
  label: string;
  tier: 'champion' | 'elite' | 'contender';
}
