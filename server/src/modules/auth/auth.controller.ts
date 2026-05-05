import type { RequestHandler } from 'express';

import type {
  BeginAuthInput,
  PasswordLoginInput,
  RequestCodeInput,
  SetPasswordInput,
  VerifyCodeInput
} from './auth.validation';
import { authService } from './auth.service';

export const beginAuthController: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body as BeginAuthInput;
    const result = await authService.beginAuth(email);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

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

export const passwordLoginController: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body as PasswordLoginInput;
    const result = await authService.loginWithPassword(email, password);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const setPasswordController: RequestHandler = async (req, res, next) => {
  try {
    const { password } = req.body as SetPasswordInput;
    const user = await authService.setPassword(req.auth!.userId, password);

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};
