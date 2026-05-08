import { Prisma, type User } from '../../../generated/prisma';
import { prisma } from '../../prisma/client';
import { HttpError } from '../../utils/http-error';
import { toPublicUser, type PublicDailyTask, type PublicUser } from './user.model';
import {
  buildDailyTaskStates,
  DAILY_LOGIN_REWARD,
  DAILY_RELEVANT_HISTORY_WINDOW_MS,
  getDailyDateKey,
  isDailyTaskKey
} from './daily-rewards';

class DailyRewardsService {
  async grantDailyLoginBonus(userId: string): Promise<User> {
    const today = getDailyDateKey();

    await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ lastDailyLoginAt: null }, { lastDailyLoginAt: { not: today } }]
      },
      data: {
        balance: {
          increment: DAILY_LOGIN_REWARD
        },
        lastDailyLoginAt: today
      }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new HttpError(404, 'User was not found.');
    }

    return user;
  }

  async getDailyTasks(userId: string): Promise<PublicDailyTask[]> {
    await this.ensureUserExists(userId);
    return this.loadDailyTasks(userId);
  }

  async claimDailyTask(userId: string, taskKey: string): Promise<{ user: PublicUser; task: PublicDailyTask }> {
    if (!isDailyTaskKey(taskKey)) {
      throw new HttpError(404, 'Daily task was not found.');
    }

    const tasks = await this.getDailyTasks(userId);
    const task = tasks.find((entry) => entry.key === taskKey);

    if (!task) {
      throw new HttpError(404, 'Daily task was not found.');
    }

    if (task.claimed) {
      throw new HttpError(400, 'This daily task is already claimed.');
    }

    if (!task.completed) {
      throw new HttpError(400, 'This daily task is not completed yet.');
    }

    const today = getDailyDateKey();

    try {
      const user = await prisma.$transaction(async (tx) => {
        await tx.dailyTaskClaim.create({
          data: {
            userId,
            taskKey,
            claimDate: today
          }
        });

        return tx.user.update({
          where: { id: userId },
          data: {
            balance: {
              increment: task.reward
            }
          }
        });
      });

      return {
        user: toPublicUser(user),
        task: {
          ...task,
          claimed: true
        }
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new HttpError(400, 'This daily task is already claimed.');
      }

      throw error;
    }
  }

  private async loadDailyTasks(userId: string): Promise<PublicDailyTask[]> {
    const today = getDailyDateKey();
    const [history, claims] = await Promise.all([
      prisma.gameHistory.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - DAILY_RELEVANT_HISTORY_WINDOW_MS)
          }
        },
        select: {
          createdAt: true,
          balanceChange: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.dailyTaskClaim.findMany({
        where: {
          userId,
          claimDate: today
        },
        select: {
          taskKey: true
        }
      })
    ]);

    return buildDailyTaskStates(
      history,
      new Set(claims.map((claim) => claim.taskKey)),
      today
    );
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user) {
      throw new HttpError(404, 'User was not found.');
    }
  }
}

export const dailyRewardsService = new DailyRewardsService();
