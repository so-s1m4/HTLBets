import dotenv from 'dotenv';
import { z } from 'zod';

import { parseTrustProxy } from '../utils/trust-proxy';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_ORIGIN: z.string().default('http://localhost:4200'),
  TRUST_PROXY: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long.'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CODE_HASH_SECRET: z.string().optional(),
  AUTH_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  MAIL_HOST: z.string().default('localhost'),
  MAIL_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_SECURE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  MAIL_USER: z.string().optional(),
  MAIL_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('no-reply@minigames.local'),
  MAIL_DEBUG_BCC: z.string().optional()
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = {
  ...parsedEnv.data,
  TRUST_PROXY: parseTrustProxy(parsedEnv.data.TRUST_PROXY),
  CODE_HASH_SECRET: parsedEnv.data.CODE_HASH_SECRET || parsedEnv.data.JWT_SECRET
};
