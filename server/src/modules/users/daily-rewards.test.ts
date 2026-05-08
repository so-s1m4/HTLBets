import { describe, expect, it } from 'vitest';

import { buildDailyTaskStates } from './daily-rewards';

describe('buildDailyTaskStates', () => {
  it('computes progress, completion and claim flags for the current daily date', () => {
    const tasks = buildDailyTaskStates(
      [
        { createdAt: new Date('2026-05-08T09:00:00.000Z'), balanceChange: 50 },
        { createdAt: new Date('2026-05-08T10:00:00.000Z'), balanceChange: -20 },
        { createdAt: new Date('2026-05-08T11:00:00.000Z'), balanceChange: 10 },
        { createdAt: new Date('2026-05-07T18:00:00.000Z'), balanceChange: 999 }
      ],
      new Set(['play-1-round']),
      '2026-05-08'
    );

    expect(tasks).toEqual([
      expect.objectContaining({
        key: 'play-1-round',
        progress: 1,
        target: 1,
        completed: true,
        claimed: true,
        reward: 100
      }),
      expect.objectContaining({
        key: 'play-3-rounds',
        progress: 3,
        target: 3,
        completed: true,
        claimed: false,
        reward: 200
      }),
      expect.objectContaining({
        key: 'win-1-round',
        progress: 1,
        target: 1,
        completed: true,
        claimed: false,
        reward: 300
      })
    ]);
  });
});
