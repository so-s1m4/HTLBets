import { env } from '../../config/env';
import { describe, expect, it } from 'vitest';

import { passwordLoginSchema, requestCodeSchema, verifyCodeSchema } from './auth.validation';
import { htlstpEmailErrorMessage } from '../../utils/email';

describe('auth validation', () => {
  it('normalizes and accepts allowed school emails', () => {
    const parsed = requestCodeSchema.parse({
      email: 'Student@HTLSTP.at'
    });

    expect(parsed.email).toBe('student@htlstp.at');
  });

  it('rejects tagged school emails', () => {
    const parsed = requestCodeSchema.safeParse({
      email: 'student+demo@htlstp.at'
    });

    expect(parsed.success).toBe(env.DEBUG_AUTH ? true : false);

    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(htlstpEmailErrorMessage);
    }
  });

  it('accepts valid verification payloads', () => {
    const parsed = verifyCodeSchema.parse({
      email: 'student@htlstp.at',
      code: '123456'
    });

    expect(parsed).toEqual({
      email: 'student@htlstp.at',
      code: '123456'
    });
  });

  it('accepts valid password login payloads', () => {
    const parsed = passwordLoginSchema.parse({
      email: 'student@htlstp.at',
      password: 'strongpass123'
    });

    expect(parsed).toEqual({
      email: 'student@htlstp.at',
      password: 'strongpass123'
    });
  });
});
