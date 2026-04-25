import type { GameHistory, User } from '@prisma/client';

export type PublicUser = Pick<User, 'id' | 'email' | 'username' | 'balance' | 'createdAt' | 'updatedAt'>;

export interface PublicGameHistory extends Pick<GameHistory, 'id' | 'betAmount' | 'result' | 'balanceChange' | 'createdAt'> {
  gameType: GameHistory['gameType'];
}

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  email: user.email,
  username: user.username,
  balance: user.balance,
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
