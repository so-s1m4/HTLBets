import { createHmac, randomInt } from 'node:crypto';

import { env } from '../config/env';

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const generateVerificationCode = (): string =>
  randomInt(0, 1_000_000)
    .toString()
    .padStart(6, '0');

export const hashVerificationCode = (email: string, code: string): string =>
  createHmac('sha256', env.CODE_HASH_SECRET)
    .update(`${normalizeEmail(email)}:${code}`)
    .digest('hex');

export const getVerificationCodeExpiry = (): Date =>
  new Date(Date.now() + env.AUTH_CODE_TTL_MINUTES * 60_000);
