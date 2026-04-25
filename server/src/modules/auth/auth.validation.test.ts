import { describe, expect, it } from 'vitest';

import { requestCodeSchema, verifyCodeSchema } from './auth.validation';
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

    expect(parsed.success).toBe(false);

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
});
