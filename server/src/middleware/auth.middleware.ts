import type { RequestHandler } from 'express';

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
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    next(new HttpError(401, 'Authentication token is invalid or expired.'));
  }
};
