import { describe, expect, it } from 'vitest';

import { CreditsPipe } from './credits.pipe';

describe('CreditsPipe', () => {
  const pipe = new CreditsPipe();

  it('formats positive credit balances', () => {
    expect(pipe.transform(123456)).toBe('123,456 cr');
  });

  it('falls back to zero for empty values', () => {
    expect(pipe.transform(undefined)).toBe('0 cr');
  });
});
