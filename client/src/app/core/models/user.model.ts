export interface User {
  id: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  selectedCardDeckId: string;
  bannedAt: string | null;
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

export interface AdminUserCardDeck extends AdminCardDeck {
  owned: boolean;
  selected: boolean;
  grantedAt: string | null;
}

export interface AdminUserDeckMutationResponse {
  user: User;
  decks: AdminUserCardDeck[];
}

export interface GameCatalogEntry {
  id: 'roulette' | 'blackjack' | 'poker' | 'miner' | 'crash' | 'slots' | 'ochko' | 'mafia';
  name: string;
  enabled: boolean;
}

export interface AdminGameCatalogEntry extends GameCatalogEntry {
  sortOrder: number;
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
  gameType: 'ROULETTE' | 'BLACKJACK' | 'POKER' | 'MINER' | 'CRASH' | 'SLOTS' | 'OCHKO' | 'ADMIN';
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
