import { describe, expect, it } from 'vitest';

import { isAllowedHtlstpEmail } from './email';

describe('isAllowedHtlstpEmail', () => {
  it('accepts a plain @htlstp.at address', () => {
    expect(isAllowedHtlstpEmail('student@htlstp.at')).toBe(true);
  });

  it('rejects plus tags', () => {
    expect(isAllowedHtlstpEmail('maks+1@htlstp.at')).toBe(false);
  });

  it('rejects other domains', () => {
    expect(isAllowedHtlstpEmail('student@example.com')).toBe(false);
  });
});
