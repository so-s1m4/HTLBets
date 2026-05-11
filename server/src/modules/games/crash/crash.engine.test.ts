import { describe, expect, it, vi } from 'vitest';

import { CrashEngine } from './crash.engine';

const engine = new CrashEngine();

const createContext = (state = engine.createInitialState(), currentBet = 0) => ({
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    email: 'student@htlstp.at',
    balance: 1000
  },
  state,
  currentBet
});

describe('CrashEngine', () => {
  it('starts with a ready state', () => {
    expect(engine.createInitialState()).toMatchObject({
      phase: 'ready',
      startTime: null,
      lastSettledMultiplier: 1
    });
  });

  it('starts a live round on bet', () => {
    const result = engine.handleBet(createContext(), { amount: 50 });

    expect(result.state).toMatchObject({
      phase: 'live'
    });
    expect(result.state.crashPoint).toBeGreaterThan(1);
    expect(result.currentBet).toBe(50);
  });

  it('cashes out before the crash point', () => {
    const startTime = new Date(Date.now() - 4_000).toISOString();
    const state = {
      ...engine.createInitialState(),
      phase: 'live' as const,
      startTime,
      crashPoint: 8,
      crashDurationMs: 30_000,
      message: 'Live'
    };

    const result = engine.handleAction(createContext(state, 100), { action: 'cash-out' });

    expect(result.state.phase).toBe('resolved');
    expect(result.resolution?.result).toMatch(/CASH_OUT/);
    expect(result.resolution?.balanceChange).toBeGreaterThan(0);
  });

  it('synchronizes an expired live round into a bust', () => {
    const now = new Date('2026-05-11T12:00:00.000Z').getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const state = {
      ...engine.createInitialState(),
      phase: 'live' as const,
      startTime: new Date(now - 8_000).toISOString(),
      crashPoint: 1.5,
      crashDurationMs: 2_000,
      message: 'Live'
    };

    const result = engine.synchronize?.(createContext(state, 75));

    expect(result?.state.phase).toBe('resolved');
    expect(result?.resolution).toMatchObject({
      result: 'BUST',
      balanceChange: -75
    });

    vi.useRealTimers();
  });
});
