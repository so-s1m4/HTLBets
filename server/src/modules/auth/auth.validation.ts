import { z } from 'zod';

import { env } from '../../config/env';
import { normalizeEmail } from '../../utils/code';
import { htlstpEmailErrorMessage, isAllowedHtlstpEmail } from '../../utils/email';

const defaultEmailSchema = z
  .string()
  .email('Please provide a valid email address.')
  .transform(normalizeEmail);

const htlstpEmailSchema = defaultEmailSchema.refine(isAllowedHtlstpEmail, htlstpEmailErrorMessage);
const emailSchema = env.DEBUG_AUTH ? defaultEmailSchema : htlstpEmailSchema;
const codeSchema = env.DEBUG_AUTH
  ? z.string().min(1, 'Verification code is required.')
  : z.string().regex(/^\d{6}$/, 'Verification code must be a 6-digit number.');
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(72, 'Password must be 72 characters or fewer.');

export const beginAuthSchema = z.object({
  email: emailSchema
});

export const requestCodeSchema = z.object({
  email: emailSchema
});

export const verifyCodeSchema = z.object({
  email: emailSchema,
  code: codeSchema
});

export const passwordLoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

export const setPasswordSchema = z.object({
  password: passwordSchema
});

export type BeginAuthInput = z.infer<typeof beginAuthSchema>;
export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
