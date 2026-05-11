import type { GameHistory, User } from '../../../generated/prisma';

import { isAdminEmail } from '../../utils/admin';
import { fromDbAmount } from '../../utils/money';

export interface PublicUser {
  id: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
  selectedCardDeckId: string;
  bannedAt: Date | null;
  isAdmin: boolean;
  hasPassword: boolean;
}

export interface PublicGameHistory {
  id: string;
  betAmount: number;
  result: string;
  balanceChange: number;
  createdAt: Date;
  gameType: GameHistory['gameType'];
}

export interface PublicDailyTask {
  key: string;
  title: string;
  description: string;
  reward: number;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}
export interface PublicLeaderboardEntry {
  userId: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  metricValue: number;
}

export interface PublicLeaderboard {
  richest: PublicLeaderboardEntry[];
  mostLosses: PublicLeaderboardEntry[];
  biggestWin: PublicLeaderboardEntry[];
  refreshedAt: Date;
}

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  email: user.email,
  username: user.username,
  avatarUrl: user.avatarUrl,
  balance: fromDbAmount(user.balance),
  selectedCardDeckId: user.selectedCardDeckId,
  bannedAt: user.bannedAt,
  isAdmin: isAdminEmail(user.email),
  hasPassword: Boolean(user.passwordHash),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export const toPublicGameHistory = (history: GameHistory): PublicGameHistory => ({
  id: history.id,
  gameType: history.gameType,
  betAmount: fromDbAmount(history.betAmount),
  result: history.result,
  balanceChange: fromDbAmount(history.balanceChange),
  createdAt: history.createdAt
});
