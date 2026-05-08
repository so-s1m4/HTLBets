import { prisma } from '../../prisma/client';
import { HttpError } from '../../utils/http-error';
import { dailyRewardsService } from './daily-rewards.service';
import {
  toPublicGameHistory,
  toPublicUser,
  type PublicDailyTask,
  type PublicGameHistory,
  type PublicUser
} from './user.model';

class UserService {
  async getCurrentUser(userId: string): Promise<PublicUser> {
    return toPublicUser(await dailyRewardsService.grantDailyLoginBonus(userId));
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

  async getDailyTasks(userId: string): Promise<PublicDailyTask[]> {
    return dailyRewardsService.getDailyTasks(userId);
  }

  async claimDailyTask(userId: string, taskKey: string): Promise<{ user: PublicUser; task: PublicDailyTask }> {
    return dailyRewardsService.claimDailyTask(userId, taskKey);
  }

  async listUsers(): Promise<PublicUser[]> {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return users.map(toPublicUser);
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

  async setBalance(userId: string, balance: number): Promise<PublicUser> {
    if (!Number.isInteger(balance) || balance < 0) {
      throw new HttpError(400, 'Balance must be a non-negative whole number.');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { balance }
    });

    return toPublicUser(user);
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
