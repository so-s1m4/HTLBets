import { describe, expect, it } from 'vitest';

import { parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('defaults to false when unset', () => {
    expect(parseTrustProxy()).toBe(false);
  });

  it('parses booleans', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('parses hop counts', () => {
    expect(parseTrustProxy('2')).toBe(2);
  });

  it('parses named proxy lists', () => {
    expect(parseTrustProxy('loopback, linklocal')).toEqual(['loopback', 'linklocal']);
  });

  it('keeps single named values', () => {
    expect(parseTrustProxy('loopback')).toBe('loopback');
  });
});
