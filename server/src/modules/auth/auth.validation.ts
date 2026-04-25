import { z } from 'zod';

import { normalizeEmail } from '../../utils/code';
import { htlstpEmailErrorMessage, isAllowedHtlstpEmail } from '../../utils/email';

const htlstpEmailSchema = z
  .string()
  .email('Please provide a valid email address.')
  .transform(normalizeEmail)
  .refine(isAllowedHtlstpEmail, htlstpEmailErrorMessage);

export const requestCodeSchema = z.object({
  email: htlstpEmailSchema
});

export const verifyCodeSchema = z.object({
  email: htlstpEmailSchema,
  code: z.string().regex(/^\d{6}$/, 'Verification code must be a 6-digit number.')
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
