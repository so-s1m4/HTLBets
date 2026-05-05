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

export const requestCodeSchema = z.object({
  email: emailSchema
});

export const verifyCodeSchema = z.object({
  email: emailSchema,
  code: codeSchema
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
