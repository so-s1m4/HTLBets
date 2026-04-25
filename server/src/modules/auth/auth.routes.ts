import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { requestCodeController, verifyCodeController } from './auth.controller';
import { validateBody } from '../../middleware/validate';
import { requestCodeSchema, verifyCodeSchema } from './auth.validation';

const requestCodeLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      message: 'Too many code requests. Please wait a few minutes and try again.'
    });
  }
});

export const authRouter = Router();

authRouter.post('/request-code', requestCodeLimiter, validateBody(requestCodeSchema), requestCodeController);
authRouter.post('/verify-code', validateBody(verifyCodeSchema), verifyCodeController);
