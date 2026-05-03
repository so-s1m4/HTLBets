import { prisma } from '../../prisma/client';
import { HttpError } from '../../utils/http-error';
import {
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
}

export const userService = new UserService();
