import type { RequestHandler } from 'express';

import { prisma } from '../prisma/client';
import { verifyAccessToken } from '../utils/jwt';
import { HttpError } from '../utils/http-error';

export const authMiddleware: RequestHandler = (req, _res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    next(new HttpError(401, 'Authentication token is missing.'));
    return;
  }

  try {
    const token = authorization.slice('Bearer '.length);
    const auth = verifyAccessToken(token);

    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, bannedAt: true }
    })
      .then((user) => {
        if (!user) {
          next(new HttpError(401, 'Authentication token is invalid or expired.'));
          return;
        }

        if (user.bannedAt) {
          next(new HttpError(403, 'This account has been suspended by an administrator.'));
          return;
        }

        req.auth = auth;
        next();
      })
      .catch((error) => next(error));
  } catch {
    next(new HttpError(401, 'Authentication token is invalid or expired.'));
  }
};
