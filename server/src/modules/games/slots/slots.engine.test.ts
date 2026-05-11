import { describe, expect, it } from 'vitest';

import { HttpError } from '../../../utils/http-error';
import { SlotsEngine } from './slots.engine';

const engine = new SlotsEngine();

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

describe('SlotsEngine', () => {
  it('starts with a ready state', () => {
    expect(engine.createInitialState()).toMatchObject({
      phase: 'ready',
      selectedMachineId: 'classic-fruit'
    });
  });

  it('selects a machine through action', () => {
    const result = engine.handleAction(createContext(), {
      action: 'select-machine',
      payload: { machineId: 'volcano-gold' }
    });

    expect(result.state).toMatchObject({
      selectedMachineId: 'volcano-gold',
      phase: 'ready'
    });
  });

  it('rejects unknown machines', () => {
    expect(() =>
      engine.handleAction(createContext(), {
        action: 'select-machine',
        payload: { machineId: 'unknown-machine' }
      })
    ).toThrow(HttpError);
  });

  it('produces a resolved spin state on bet', () => {
    const result = engine.handleBet(createContext(), {
      amount: 50,
      payload: { machineId: 'classic-fruit' }
    });

    expect(result.state.phase).toBe('resolved');
    expect(result.state.visibleGrid).toHaveLength(3);
    expect(result.resolution).toBeTruthy();
  });
});
