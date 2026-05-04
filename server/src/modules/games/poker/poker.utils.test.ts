import { describe, expect, it } from 'vitest';

import type { PlayingCard } from '../core/card.utils';
import { classifyPokerOutcome, computeLayeredPayouts, evaluatePokerHand } from './poker.utils';

describe('evaluatePokerHand', () => {
  it('detects a straight instead of falling back to high card', () => {
    const cards: PlayingCard[] = [
      { rank: '2', suit: 'hearts' },
      { rank: '3', suit: 'clubs' },
      { rank: '4', suit: 'spades' },
      { rank: '5', suit: 'diamonds' },
      { rank: '6', suit: 'hearts' },
      { rank: 'K', suit: 'clubs' },
      { rank: 'A', suit: 'spades' }
    ];

    expect(evaluatePokerHand(cards)).toEqual({
      label: 'Straight',
      category: 5,
      ranks: [6]
    });
  });
});

describe('computeLayeredPayouts', () => {
  it('caps the main pot to the covered all-in amount and returns the excess to the deeper stack', () => {
    const result = computeLayeredPayouts(
      [
        {
          userId: 'short',
          totalContribution: 10,
          seatIndex: 0,
          status: 'all-in'
        },
        {
          userId: 'deep',
          totalContribution: 1000,
          seatIndex: 1,
          status: 'all-in'
        }
      ],
      new Map([
        [
          'short',
          {
            label: 'Straight',
            category: 5,
            ranks: [10]
          }
        ],
        [
          'deep',
          {
            label: 'Pair',
            category: 2,
            ranks: [14, 13, 12, 11]
          }
        ]
      ])
    );

    expect(result.payouts.get('short')).toBe(20);
    expect(result.payouts.get('deep')).toBe(990);
  });
});

describe('classifyPokerOutcome', () => {
  it('marks negative side-pot net results as losses instead of push', () => {
    expect(
      classifyPokerOutcome({
        winnerCount: 1,
        balanceChange: -25,
        sharedWinner: false,
        folded: false
      })
    ).toBe('LOSS');
  });

  it('keeps zero net outcomes as push', () => {
    expect(
      classifyPokerOutcome({
        winnerCount: 1,
        balanceChange: 0,
        sharedWinner: false,
        folded: false
      })
    ).toBe('PUSH');
  });
});
