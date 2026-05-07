import { GameType } from '../../../generated/prisma';
import { prisma } from '../../prisma/client';
import { env } from '../../config/env';
import { HttpError } from '../../utils/http-error';
import {
  type PublicLeaderboard,
  type PublicLeaderboardEntry,
  toPublicGameHistory,
  toPublicUser,
  type PublicGameHistory,
  type PublicUser
} from './user.model';

class UserService {
  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new HttpError(404, 'User was not found.');
    }

    return toPublicUser(user);
  }

  async getHistory(userId: string): Promise<PublicGameHistory[]> {
    const history = await prisma.gameHistory.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    return history.map(toPublicGameHistory);
  }

  async listUsers(): Promise<PublicUser[]> {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return users.map(toPublicUser);
  }

  async getLeaderboard(): Promise<PublicLeaderboard> {
    const leaderboardLimit = 100;
    const users = await prisma.user.findMany({
      where: {
        email: {
          notIn: env.ADMIN_EMAILS
        }
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        balance: true,
        gameHistory: {
          select: {
            balanceChange: true,
            result: true
          }
        }
      }
    });

    const toEntry = (
      user: (typeof users)[number],
      metricValue: number
    ): PublicLeaderboardEntry => ({
      userId: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      metricValue
    });

    const richest = [...users]
      .sort((left, right) => right.balance - left.balance)
      .slice(0, leaderboardLimit)
      .map((user) => toEntry(user, user.balance));

    const mostLosses = users
      .map((user) => ({
        user,
        metricValue: user.gameHistory.reduce((totalLosses, entry) => {
          if (entry.balanceChange >= 0 || entry.result === 'ADMIN_ADJUSTMENT') {
            return totalLosses;
          }

          return totalLosses + Math.abs(entry.balanceChange);
        }, 0)
      }))
      .filter((entry) => entry.metricValue > 0)
      .sort((left, right) => right.metricValue - left.metricValue)
      .slice(0, leaderboardLimit)
      .map((entry) => toEntry(entry.user, entry.metricValue));

    const biggestWin = users
      .map((user) => ({
        user,
        metricValue: user.gameHistory.reduce((best, entry) => {
          if (entry.result === 'ADMIN_ADJUSTMENT') {
            return best;
          }

          return Math.max(best, entry.balanceChange);
        }, 0)
      }))
      .filter((entry) => entry.metricValue > 0)
      .sort((left, right) => right.metricValue - left.metricValue)
      .slice(0, leaderboardLimit)
      .map((entry) => toEntry(entry.user, entry.metricValue));

    return {
      richest,
      mostLosses,
      biggestWin,
      refreshedAt: new Date()
    };
  }

  async getUserHistory(userId: string): Promise<PublicGameHistory[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new HttpError(404, 'User was not found.');
    }

    return this.getHistory(userId);
  }

  async setBalance(actorUserId: string, userId: string, balance: number): Promise<PublicUser> {
    if (!Number.isInteger(balance) || balance < 0) {
      throw new HttpError(400, 'Balance must be a non-negative whole number.');
    }

    const [actor, user] = await Promise.all([
      prisma.user.findUnique({
        where: { id: actorUserId }
      }),
      prisma.user.findUnique({
        where: { id: userId }
      })
    ]);

    if (!actor || !user) {
      throw new HttpError(404, 'User was not found.');
    }

    const balanceChange = balance - user.balance;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: userId },
        data: { balance }
      });

      if (balanceChange !== 0) {
        await tx.gameHistory.create({
          data: {
            userId,
            gameType: GameType.ADMIN,
            betAmount: 0,
            result: 'ADMIN_ADJUSTMENT',
            balanceChange
          }
        });
      }

      return nextUser;
    });

    return toPublicUser(updatedUser);
  }

  async updateProfile(userId: string, input: { username?: string; avatarUrl?: string | null }): Promise<PublicUser> {
    const data: { username?: string | null; avatarUrl?: string | null } = {};

    if (input.username !== undefined) {
      const username = String(input.username || '').trim();

      if (username.length > 0 && (username.length < 2 || username.length > 24)) {
        throw new HttpError(400, 'Username must be between 2 and 24 characters long.');
      }

      data.username = username || null;
    }

    if (input.avatarUrl !== undefined) {
      const avatarUrl = String(input.avatarUrl || '').trim();

      if (avatarUrl) {
        let parsed: URL;

        try {
          parsed = new URL(avatarUrl);
        } catch {
          throw new HttpError(400, 'Profile picture must be a valid URL.');
        }

        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new HttpError(400, 'Profile picture URL must start with http:// or https://.');
        }
      }

      data.avatarUrl = avatarUrl || null;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data
    });

    return toPublicUser(user);
  }
}

export const userService = new UserService();
