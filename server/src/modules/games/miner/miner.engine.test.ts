import { describe, expect, it } from 'vitest';

import { HttpError } from '../../../utils/http-error';
import { MinerEngine } from './miner.engine';

const engine = new MinerEngine();

const createContext = () => ({
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    email: 'student@htlstp.at',
    balance: 1000
  },
  state: engine.createInitialState(),
  currentBet: 0
});

describe('MinerEngine', () => {
  it('starts with a ready state', () => {
    expect(engine.createInitialState()).toMatchObject({
      phase: 'ready',
      mineCount: 3,
      revealedSafeCount: 0
    });
  });

  it('rejects invalid mine counts on bet', () => {
    expect(() =>
      engine.handleBet(createContext(), {
        amount: 25,
        payload: {
          mineCount: 25
        }
      })
    ).toThrow(HttpError);
  });

  it('starts a playing round with requested mine count', () => {
    const result = engine.handleBet(createContext(), {
      amount: 50,
      payload: {
        mineCount: 5
      }
    });

    expect(result.state).toMatchObject({
      phase: 'playing',
      mineCount: 5
    });
    expect(result.currentBet).toBe(50);
  });
});
