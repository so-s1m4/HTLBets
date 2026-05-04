import { getPokerRankValue, type PlayingCard } from '../core/card.utils';

export interface PokerHandEvaluation {
  label: string;
  category: number;
  ranks: number[];
}

interface PayoutSeatLike {
  userId: string;
  totalContribution: number;
  seatIndex: number;
  status: string;
}

export interface LayeredPayoutResult {
  payouts: Map<string, number>;
  winningUserIds: Set<string>;
  sharedWinners: Set<string>;
}

export const classifyPokerOutcome = ({
  winnerCount,
  balanceChange,
  sharedWinner,
  folded
}: {
  winnerCount: number;
  balanceChange: number;
  sharedWinner: boolean;
  folded: boolean;
}): string => {
  if (winnerCount === 0) {
    return 'VOID';
  }

  if (balanceChange > 0) {
    return sharedWinner ? 'SPLIT' : 'WIN';
  }

  if (balanceChange === 0) {
    return 'PUSH';
  }

  if (folded) {
    return 'FOLD';
  }

  return 'LOSS';
};

export const getStraightHigh = (values: number[]): number | null => {
  const unique = Array.from(new Set(values)).sort((left, right) => right - left);

  if (unique.includes(14)) {
    unique.push(1);
  }

  for (let index = 0; index <= unique.length - 5; index += 1) {
    const window = unique.slice(index, index + 5);
    const isStraight = window.every((value, windowIndex) => {
      if (windowIndex === 0) {
        return true;
      }

      return window[windowIndex - 1] - 1 === value;
    });

    if (isStraight) {
      return window[0];
    }
  }

  return null;
};

export const evaluatePokerHand = (cards: PlayingCard[]): PokerHandEvaluation => {
  const rankValues = cards.map(getPokerRankValue).sort((left, right) => right - left);
  const counts = new Map<number, number>();
  const suits = new Map<string, number[]>();

  for (const card of cards) {
    const rank = getPokerRankValue(card);
    counts.set(rank, (counts.get(rank) || 0) + 1);
    suits.set(card.suit, [...(suits.get(card.suit) || []), rank]);
  }

  const groups = Array.from(counts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return right[0] - left[0];
  });

  const flushRanks = Array.from(suits.values()).find((entries) => entries.length >= 5)?.sort((left, right) => right - left) || null;
  const straightHigh = getStraightHigh(rankValues);
  const straightFlushHigh = flushRanks ? getStraightHigh(flushRanks) : null;
  const pairs = groups.filter((group) => group[1] === 2).map((group) => group[0]).sort((left, right) => right - left);
  const trips = groups.filter((group) => group[1] === 3).map((group) => group[0]).sort((left, right) => right - left);
  const quads = groups.find((group) => group[1] === 4)?.[0];
  const singles = groups.filter((group) => group[1] === 1).map((group) => group[0]).sort((left, right) => right - left);

  if (straightFlushHigh) {
    return {
      label: straightFlushHigh === 14 ? 'Royal Flush' : 'Straight Flush',
      category: 9,
      ranks: [straightFlushHigh]
    };
  }

  if (quads) {
    return {
      label: 'Four of a Kind',
      category: 8,
      ranks: [quads, ...singles.slice(0, 1)]
    };
  }

  if (trips.length > 0 && (pairs.length > 0 || trips.length > 1)) {
    return {
      label: 'Full House',
      category: 7,
      ranks: [trips[0], pairs[0] || trips[1]]
    };
  }

  if (flushRanks) {
    return {
      label: 'Flush',
      category: 6,
      ranks: flushRanks.slice(0, 5)
    };
  }

  if (straightHigh) {
    return {
      label: 'Straight',
      category: 5,
      ranks: [straightHigh]
    };
  }

  if (trips.length > 0) {
    return {
      label: 'Three of a Kind',
      category: 4,
      ranks: [trips[0], ...singles.slice(0, 2)]
    };
  }

  if (pairs.length >= 2) {
    return {
      label: 'Two Pair',
      category: 3,
      ranks: [pairs[0], pairs[1], ...singles.slice(0, 1)]
    };
  }

  if (pairs.length === 1) {
    return {
      label: 'Pair',
      category: 2,
      ranks: [pairs[0], ...singles.slice(0, 3)]
    };
  }

  return {
    label: 'High Card',
    category: 1,
    ranks: rankValues.slice(0, 5)
  };
};

export const comparePokerEvaluations = (left: PokerHandEvaluation, right: PokerHandEvaluation): number => {
  if (left.category !== right.category) {
    return left.category - right.category;
  }

  const maxLength = Math.max(left.ranks.length, right.ranks.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftRank = left.ranks[index] || 0;
    const rightRank = right.ranks[index] || 0;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
  }

  return 0;
};

export const computeLayeredPayouts = (
  seats: PayoutSeatLike[],
  evaluations: ReadonlyMap<string, PokerHandEvaluation>
): LayeredPayoutResult => {
  const payouts = new Map<string, number>();
  const winningUserIds = new Set<string>();
  const sharedWinners = new Set<string>();
  const orderedSeats = [...seats].sort((left, right) => left.seatIndex - right.seatIndex);
  const levels = Array.from(new Set(orderedSeats.map((seat) => seat.totalContribution).filter((value) => value > 0))).sort((left, right) => left - right);

  let previousLevel = 0;

  for (const level of levels) {
    const contributors = orderedSeats.filter((seat) => seat.totalContribution >= level);
    const eligible = contributors.filter((seat) => seat.status !== 'folded');
    const layerAmount = (level - previousLevel) * contributors.length;
    previousLevel = level;

    if (layerAmount <= 0 || eligible.length === 0) {
      continue;
    }

    let layerWinners = eligible;

    if (eligible.length > 1) {
      let bestEvaluation: PokerHandEvaluation | null = null;
      layerWinners = [];

      for (const seat of eligible) {
        const evaluation = evaluations.get(seat.userId);

        if (!evaluation) {
          throw new Error(`Missing showdown evaluation for user ${seat.userId}.`);
        }

        if (!bestEvaluation) {
          bestEvaluation = evaluation;
          layerWinners = [seat];
          continue;
        }

        const comparison = comparePokerEvaluations(evaluation, bestEvaluation);

        if (comparison > 0) {
          bestEvaluation = evaluation;
          layerWinners = [seat];
        } else if (comparison === 0) {
          layerWinners.push(seat);
        }
      }
    }

    const sortedWinners = [...layerWinners].sort((left, right) => left.seatIndex - right.seatIndex);
    const baseShare = Math.floor(layerAmount / sortedWinners.length);
    let remainder = layerAmount % sortedWinners.length;

    for (const winner of sortedWinners) {
      const share = baseShare + (remainder > 0 ? 1 : 0);
      payouts.set(winner.userId, (payouts.get(winner.userId) || 0) + share);
      winningUserIds.add(winner.userId);

      if (sortedWinners.length > 1) {
        sharedWinners.add(winner.userId);
      }

      remainder = Math.max(0, remainder - 1);
    }
  }

  return {
    payouts,
    winningUserIds,
    sharedWinners
  };
};
