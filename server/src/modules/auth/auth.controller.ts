import type { RequestHandler } from 'express';

import type { RequestCodeInput, VerifyCodeInput } from './auth.validation';
import { authService } from './auth.service';

export const requestCodeController: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body as RequestCodeInput;
    await authService.requestCode(email);

    res.status(202).json({
      message: 'If the email can receive mail, a verification code has been sent.'
    });
  } catch (error) {
    next(error);
  }
};

export const verifyCodeController: RequestHandler = async (req, res, next) => {
  try {
    const { email, code } = req.body as VerifyCodeInput;
    const result = await authService.verifyCode(email, code);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
