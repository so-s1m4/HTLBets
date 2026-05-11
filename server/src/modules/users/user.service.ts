import { GameType } from '../../../generated/prisma';
import { prisma } from '../../prisma/client';
import { env } from '../../config/env';
import { HttpError } from '../../utils/http-error';
import { isAdminEmail } from '../../utils/admin';
import { fromDbAmount, parseBalanceAmount, toDbAmount } from '../../utils/money';
import { dailyRewardsService } from './daily-rewards.service';
import {
  type PublicLeaderboard,
  type PublicLeaderboardEntry,
  toPublicGameHistory,
  toPublicUser,
  type PublicDailyTask,
  type PublicGameHistory,
  type PublicUser
} from './user.model';
import { cardDeckService, DEFAULT_CARD_DECK_ID, type AdminCardDeck, type AdminUserCardDeck, type PublicCardDeck } from './card-deck.service';
import { pokerTableManager } from '../games/poker/poker-table.manager';

const DEFAULT_USER_BALANCE = 1000;

class UserService {
  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new HttpError(404, 'User was not found.');
    }

    if (user.bannedAt) {
      throw new HttpError(403, 'This account has been suspended by an administrator.');
    }

    await cardDeckService.ensureDefaultOwnership(userId);
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

  async listCardDecks(userId: string): Promise<PublicCardDeck[]> {
    return cardDeckService.listForUser(userId);
  }

  async purchaseCardDeck(userId: string, deckId: string): Promise<{ user: PublicUser; decks: PublicCardDeck[] }> {
    return cardDeckService.purchaseForUser(userId, deckId);
  }

  async selectCardDeck(userId: string, deckId: string): Promise<{ user: PublicUser; decks: PublicCardDeck[] }> {
    const result = await cardDeckService.selectForUser(userId, deckId);
    const selectedDeck = result.decks.find((deck) => deck.selected);

    if (selectedDeck) {
      pokerTableManager.updateUserCardDeck(
        userId,
        selectedDeck.id,
        selectedDeck.backImageUrl,
        selectedDeck.faceImageTemplate
      );
    }

    return result;
  }

  async listAdminCardDecks(): Promise<AdminCardDeck[]> {
    return cardDeckService.listForAdmin();
  }

  async listAdminUserCardDecks(userId: string): Promise<AdminUserCardDeck[]> {
    return cardDeckService.listForAdminUser(userId);
  }

  async importAdminCardDeck(payload?: Record<string, unknown>): Promise<AdminCardDeck> {
    return cardDeckService.importForAdmin(payload);
  }

  async setAdminDefaultCardDeck(deckId: string): Promise<AdminCardDeck> {
    const previousDefault = await cardDeckService.getDefaultDeck();
    const nextDefault = await cardDeckService.setDefaultForAdmin(deckId);

    if (previousDefault && previousDefault.id !== nextDefault.id) {
      pokerTableManager.replaceCardDeckSelection(
        previousDefault.id,
        nextDefault.id,
        nextDefault.backImageUrl,
        nextDefault.faceImageTemplate
      );
    }

    return nextDefault;
  }

  async grantAdminCardDeck(
    userId: string,
    deckId: string,
    options?: { select?: boolean }
  ): Promise<{ user: PublicUser; decks: AdminUserCardDeck[] }> {
    const result = await cardDeckService.grantForAdmin(userId, deckId, options);
    const selectedDeck = result.decks.find((deck) => deck.selected);

    if (selectedDeck) {
      pokerTableManager.updateUserCardDeck(
        userId,
        selectedDeck.id,
        selectedDeck.backImageUrl,
        selectedDeck.faceImageTemplate
      );
    }

    return result;
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
      .sort((left, right) => fromDbAmount(right.balance) - fromDbAmount(left.balance))
      .slice(0, leaderboardLimit)
      .map((user) => toEntry(user, fromDbAmount(user.balance)));

    const mostLosses = users
      .map((user) => ({
        user,
        metricValue: user.gameHistory.reduce((totalLosses, entry) => {
          const balanceChange = fromDbAmount(entry.balanceChange);

          if (balanceChange >= 0 || entry.result === 'ADMIN_ADJUSTMENT') {
            return totalLosses;
          }

          return totalLosses + Math.abs(balanceChange);
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

          return Math.max(best, fromDbAmount(entry.balanceChange));
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
    balance = parseBalanceAmount(balance);

    const [actor, targetUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: actorUserId }
      }),
      prisma.user.findUnique({
        where: { id: userId }
      })
    ]);

    const { user } = this.requireAdminActorAndTarget(actor, targetUser, { allowSelf: true, allowAdminTarget: true });

    const balanceChange = balance - fromDbAmount(user.balance);

    const updatedUser = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: userId },
        data: { balance: toDbAmount(balance) }
      });

      if (balanceChange !== 0) {
        await tx.gameHistory.create({
          data: {
            userId,
            gameType: GameType.ADMIN,
            betAmount: 0n,
            result: 'ADMIN_ADJUSTMENT',
            balanceChange: toDbAmount(balanceChange)
          }
        });
      }

      return nextUser;
    });

    return toPublicUser(updatedUser);
  }

  async setUserBanState(actorUserId: string, userId: string, banned: boolean): Promise<PublicUser> {
    const [actor, targetUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: actorUserId }
      }),
      prisma.user.findUnique({
        where: { id: userId }
      })
    ]);

    const { user } = this.requireAdminActorAndTarget(actor, targetUser, { allowSelf: false, allowAdminTarget: false });

    if (Boolean(user.bannedAt) === banned) {
      return toPublicUser(user);
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: userId },
        data: {
          bannedAt: banned ? new Date() : null
        }
      });

      await tx.gameHistory.create({
        data: {
          userId,
          gameType: GameType.ADMIN,
          betAmount: 0n,
          result: banned ? 'ADMIN_BAN' : 'ADMIN_UNBAN',
          balanceChange: 0n
        }
      });

      return nextUser;
    });

    return toPublicUser(updatedUser);
  }

  async wipeUser(actorUserId: string, userId: string): Promise<PublicUser> {
    const [actor, targetUser, defaultDeck] = await Promise.all([
      prisma.user.findUnique({
        where: { id: actorUserId }
      }),
      prisma.user.findUnique({
        where: { id: userId }
      }),
      cardDeckService.getDefaultDeck()
    ]);

    this.requireAdminActorAndTarget(actor, targetUser, { allowSelf: false, allowAdminTarget: false });

    const defaultDeckId = defaultDeck?.id || DEFAULT_CARD_DECK_ID;

    await pokerTableManager.leaveTable(userId);

    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.gameSession.deleteMany({
        where: { userId }
      });

      await tx.gameHistory.deleteMany({
        where: { userId }
      });

      await tx.dailyTaskClaim.deleteMany({
        where: { userId }
      });

      await tx.userCardDeck.deleteMany({
        where: {
          userId,
          deckId: {
            not: defaultDeckId
          }
        }
      });

      await tx.userCardDeck.upsert({
        where: {
          userId_deckId: {
            userId,
            deckId: defaultDeckId
          }
        },
        update: {},
        create: {
          userId,
          deckId: defaultDeckId
        }
      });

      const nextUser = await tx.user.update({
        where: { id: userId },
        data: {
          balance: toDbAmount(DEFAULT_USER_BALANCE),
          selectedCardDeckId: defaultDeckId,
          lastDailyLoginAt: null
        }
      });

      await tx.gameHistory.create({
        data: {
          userId,
          gameType: GameType.ADMIN,
          betAmount: 0n,
          result: 'ADMIN_WIPE',
          balanceChange: 0n
        }
      });

      return nextUser;
    });

    if (defaultDeck) {
      pokerTableManager.updateUserCardDeck(
        userId,
        defaultDeck.id,
        defaultDeck.backImageUrl,
        defaultDeck.faceImageTemplate
      );
    }

    return toPublicUser(updatedUser);
  }

  async deleteUser(actorUserId: string, userId: string): Promise<{ deletedUserId: string }> {
    const [actor, targetUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: actorUserId }
      }),
      prisma.user.findUnique({
        where: { id: userId }
      })
    ]);

    this.requireAdminActorAndTarget(actor, targetUser, { allowSelf: false, allowAdminTarget: false });

    await pokerTableManager.leaveTable(userId);

    await prisma.user.delete({
      where: { id: userId }
    });

    return {
      deletedUserId: userId
    };
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

  private requireAdminActorAndTarget<TUser extends { id: string; email: string; bannedAt: Date | null }>(
    actor: { id: string; email: string } | null,
    user: TUser | null,
    options?: { allowSelf?: boolean; allowAdminTarget?: boolean }
  ): { actor: { id: string; email: string }; user: TUser } {
    if (!actor || !user) {
      throw new HttpError(404, 'User was not found.');
    }

    if (!options?.allowSelf && actor.id === user.id) {
      throw new HttpError(400, 'You cannot perform this action on your own account.');
    }

    if (!options?.allowAdminTarget && isAdminEmail(user.email)) {
      throw new HttpError(400, 'Administrator accounts cannot be modified with this action.');
    }

    return { actor, user };
  }
}

export const userService = new UserService();
