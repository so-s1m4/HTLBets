import type { RequestHandler } from 'express';
import { z } from 'zod';

import { HttpError } from '../utils/http-error';

export const validateBody = <T>(schema: z.ZodType<T>): RequestHandler => {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join(', ');
      next(new HttpError(400, message));
      return;
    }

    req.body = parsed.data;
    next();
  };
};
