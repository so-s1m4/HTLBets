import { describe, expect, it } from 'vitest';

import { HttpError } from '../../../utils/http-error';
import { RouletteEngine } from './roulette.engine';

const engine = new RouletteEngine();

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

describe('RouletteEngine', () => {
  it('starts with a ready state', () => {
    expect(engine.createInitialState()).toMatchObject({
      phase: 'ready',
      history: []
    });
  });

  it('rejects unsupported bet payloads', () => {
    expect(() =>
      engine.handleBet(createContext(), {
        amount: 25,
        payload: {
          selectionType: 'color',
          value: 'blue'
        }
      })
    ).toThrow(HttpError);
  });

  it('rejects actions because roulette resolves on bet', () => {
    expect(() =>
      engine.handleAction(createContext(), {
        action: 'spin-again'
      })
    ).toThrow('Roulette resolves immediately after placing a bet.');
  });
});
