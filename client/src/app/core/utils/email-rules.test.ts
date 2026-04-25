import { describe, expect, it } from 'vitest';

import { isAllowedHtlstpEmail, normalizeLoginEmail } from './email-rules';

describe('client email rules', () => {
  it('normalizes user input to lowercase', () => {
    expect(normalizeLoginEmail(' Student@HTLSTP.at ')).toBe('student@htlstp.at');
  });

  it('accepts allowed school emails', () => {
    expect(isAllowedHtlstpEmail('student@htlstp.at')).toBe(true);
  });

  it('rejects tagged aliases', () => {
    expect(isAllowedHtlstpEmail('student+demo@htlstp.at')).toBe(false);
  });
});
