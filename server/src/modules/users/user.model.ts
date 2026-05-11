import type { GameHistory, User } from '../../../generated/prisma';

import { isAdminEmail } from '../../utils/admin';

export interface PublicUser extends Pick<User, 'id' | 'email' | 'username' | 'avatarUrl' | 'balance' | 'createdAt' | 'updatedAt' | 'selectedCardDeckId' | 'bannedAt'> {
  isAdmin: boolean;
  hasPassword: boolean;
}

export interface PublicGameHistory extends Pick<GameHistory, 'id' | 'betAmount' | 'result' | 'balanceChange' | 'createdAt'> {
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
  balance: user.balance,
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
  betAmount: history.betAmount,
  result: history.result,
  balanceChange: history.balanceChange,
  createdAt: history.createdAt
});
