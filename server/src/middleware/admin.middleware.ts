import type { RequestHandler } from 'express';

import { HttpError } from '../utils/http-error';
import { isAdminEmail } from '../utils/admin';

export const adminMiddleware: RequestHandler = (req, _res, next) => {
  const email = req.auth?.email;

  if (!email || !isAdminEmail(email)) {
    next(new HttpError(403, 'Admin access is required.'));
    return;
  }

  next();
};
