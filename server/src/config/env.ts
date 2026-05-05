import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

import { parseTrustProxy } from '../utils/trust-proxy';

const dotenvPathCandidates = [resolve(process.cwd(), '.env.docker'), resolve(process.cwd(), '..', '.env.docker')];
const dotenvPath = dotenvPathCandidates.find((candidate) => existsSync(candidate));

dotenv.config({
  path: dotenvPath,
  quiet: true
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_ORIGIN: z.string().default('http://localhost:4200'),
  DEBUG_AUTH: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  TRUST_PROXY: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long.'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  ADMIN_EMAILS: z.string().optional(),
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
  CODE_HASH_SECRET: parsedEnv.data.CODE_HASH_SECRET || parsedEnv.data.JWT_SECRET,
  ADMIN_EMAILS: (parsedEnv.data.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
};
