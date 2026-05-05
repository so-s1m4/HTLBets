import { prisma } from '../../prisma/client';
import { env } from '../../config/env';
import { emailService } from '../email/email.service';
import { generateVerificationCode, getVerificationCodeExpiry, hashVerificationCode } from '../../utils/code';
import { HttpError } from '../../utils/http-error';
import { signAccessToken } from '../../utils/jwt';
import { toPublicUser, type PublicUser } from '../users/user.model';

interface VerifyCodeResult {
  accessToken: string;
  user: PublicUser;
}

class AuthService {
  async requestCode(email: string): Promise<void> {
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

  async verifyCode(email: string, code: string): Promise<VerifyCodeResult> {
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

  private async issueAccessToken(email: string): Promise<VerifyCodeResult> {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email }
    });

    return {
      accessToken: signAccessToken({
        userId: user.id,
        email: user.email
      }),
      user: toPublicUser(user)
    };
  }
}

export const authService = new AuthService();
