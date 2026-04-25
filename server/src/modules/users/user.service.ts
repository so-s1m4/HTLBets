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
}

export const userService = new UserService();
