import { prisma } from '../../prisma/client';
import { env } from '../../config/env';
import { emailService } from '../email/email.service';
import { generateVerificationCode, getVerificationCodeExpiry, hashVerificationCode } from '../../utils/code';
import { HttpError } from '../../utils/http-error';
import { signAccessToken } from '../../utils/jwt';
import { hashPassword, verifyPassword } from '../../utils/password';
import { toPublicUser, type PublicUser } from '../users/user.model';
import { dailyRewardsService } from '../users/daily-rewards.service';
import { cardDeckService } from '../users/card-deck.service';

interface AuthResponse {
  accessToken: string;
  user: PublicUser;
  requiresPasswordSetup: boolean;
}

interface BeginAuthResponse {
  mode: 'password' | 'code';
}

const assertNotBanned = (user: { bannedAt: Date | null } | null): void => {
  if (user?.bannedAt) {
    throw new HttpError(403, 'This account has been suspended by an administrator.');
  }
};

class AuthService {
  async beginAuth(email: string): Promise<BeginAuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        passwordHash: true,
        bannedAt: true
      }
    });

    assertNotBanned(user);

    return {
      mode: user?.passwordHash ? 'password' : 'code'
    };
  }

  async requestCode(email: string): Promise<void> {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { passwordHash: true, bannedAt: true }
    });

    assertNotBanned(existingUser);

    if (existingUser?.passwordHash) {
      throw new HttpError(400, 'This account already uses a password for sign in.');
    }

    if (env.DEBUG_AUTH) {
      return;
    }

    const code = generateVerificationCode();

    await prisma.$transaction(async (tx) => {
      await tx.emailVerificationCode.updateMany({
        where: {
          email,
          used: false
        },
        data: {
          used: true
        }
      });

      await tx.emailVerificationCode.create({
        data: {
          email,
          codeHash: hashVerificationCode(email, code),
          expiresAt: getVerificationCodeExpiry()
        }
      });
    });

    await emailService.sendVerificationCode(email, code);
  }

  async verifyCode(email: string, code: string): Promise<AuthResponse> {
    if (env.DEBUG_AUTH) {
      return this.issueAccessToken(email);
    }

    const verification = await prisma.emailVerificationCode.findFirst({
      where: {
        email,
        used: false,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!verification) {
      throw new HttpError(400, 'Invalid or expired verification code.');
    }

    if (verification.codeHash !== hashVerificationCode(email, code)) {
      throw new HttpError(400, 'Invalid or expired verification code.');
    }

    await prisma.emailVerificationCode.update({
      where: { id: verification.id },
      data: { used: true }
    });

    return this.issueAccessToken(email);
  }

  async loginWithPassword(email: string, password: string): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    assertNotBanned(user);

    if (!user?.passwordHash) {
      throw new HttpError(400, 'This account must be verified by code before password sign in is available.');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new HttpError(400, 'Incorrect password.');
    }

    return this.buildAuthResponse(await dailyRewardsService.grantDailyLoginBonus(user.id));
  }

  async setPassword(userId: string, password: string): Promise<PublicUser> {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    return toPublicUser(user);
  }

  private async issueAccessToken(email: string): Promise<AuthResponse> {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email }
    });

    assertNotBanned(user);

    await cardDeckService.ensureDefaultOwnership(user.id);
    return this.buildAuthResponse(await dailyRewardsService.grantDailyLoginBonus(user.id));
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    username: string | null;
    avatarUrl: string | null;
    selectedCardDeckId: string;
    passwordHash: string | null;
    bannedAt: Date | null;
    lastDailyLoginAt: string | null;
    balance: bigint;
    createdAt: Date;
    updatedAt: Date;
  }): AuthResponse {
    return {
      accessToken: signAccessToken({
        userId: user.id,
        email: user.email
      }),
      user: toPublicUser(user),
      requiresPasswordSetup: !user.passwordHash
    };
  }
}

export const authService = new AuthService();
