import type { GameHistory, User } from '../../../generated/prisma';

import { isAdminEmail } from '../../utils/admin';

export interface PublicUser extends Pick<User, 'id' | 'email' | 'username' | 'avatarUrl' | 'balance' | 'createdAt' | 'updatedAt'> {
  isAdmin: boolean;
  hasPassword: boolean;
}

export interface PublicGameHistory extends Pick<GameHistory, 'id' | 'betAmount' | 'result' | 'balanceChange' | 'createdAt'> {
  gameType: GameHistory['gameType'];
}

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  email: user.email,
  username: user.username,
  avatarUrl: user.avatarUrl,
  balance: user.balance,
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
