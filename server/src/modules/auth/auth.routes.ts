import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import {
  beginAuthController,
  passwordLoginController,
  requestCodeController,
  setPasswordController,
  verifyCodeController
} from './auth.controller';
import { validateBody } from '../../middleware/validate';
import {
  beginAuthSchema,
  passwordLoginSchema,
  requestCodeSchema,
  setPasswordSchema,
  verifyCodeSchema
} from './auth.validation';
import { authMiddleware } from '../../middleware/auth.middleware';

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

authRouter.post('/begin', validateBody(beginAuthSchema), beginAuthController);
authRouter.post('/request-code', requestCodeLimiter, validateBody(requestCodeSchema), requestCodeController);
authRouter.post('/verify-code', validateBody(verifyCodeSchema), verifyCodeController);
authRouter.post('/login-password', validateBody(passwordLoginSchema), passwordLoginController);
authRouter.post('/set-password', authMiddleware, validateBody(setPasswordSchema), setPasswordController);
