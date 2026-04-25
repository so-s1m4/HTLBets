import { GameSessionStatus, GameType } from '@prisma/client';

import type {
  ActionRequest,
  BetRequest,
  EngineContext,
  GameEngine,
  GameResolution
} from '../core/game-engine.interface';
import { createDeck, drawCard, getPokerRankValue, shuffleDeck, type PlayingCard } from '../core/card.utils';
import { HttpError } from '../../../utils/http-error';

interface PokerHandEvaluation {
  label: string;
  category: number;
  ranks: number[];
}

export interface PokerState {
  phase: 'ready' | 'turn' | 'river' | 'showdown' | 'resolved';
  deck: PlayingCard[];
  playerHand: PlayingCard[];
  opponentHand: PlayingCard[];
  communityCards: PlayingCard[];
  notes: string;
  playerEvaluation?: PokerHandEvaluation;
  opponentEvaluation?: PokerHandEvaluation;
  resolution?: GameResolution | null;
}

const evaluatePlaceholderHand = (cards: PlayingCard[]): PokerHandEvaluation => {
  const ranks = cards.map(getPokerRankValue).sort((left, right) => right - left);
  const counts = new Map<number, number>();

  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) || 0) + 1);
  }

  const groups = Array.from(counts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return right[0] - left[0];
  });

  const pairs = groups.filter((group) => group[1] === 2).map((group) => group[0]).sort((left, right) => right - left);
  const trips = groups.filter((group) => group[1] === 3).map((group) => group[0]).sort((left, right) => right - left);
  const quads = groups.find((group) => group[1] === 4)?.[0];
  const kickers = groups.filter((group) => group[1] === 1).map((group) => group[0]).sort((left, right) => right - left);

  if (quads) {
    return {
      label: 'Four of a Kind',
      category: 6,
      ranks: [quads, ...kickers.slice(0, 1)]
    };
  }

  if (trips.length > 0 && pairs.length > 0) {
    return {
      label: 'Full House',
      category: 5,
      ranks: [trips[0], pairs[0]]
    };
  }

  if (trips.length > 0) {
    return {
      label: 'Three of a Kind',
      category: 4,
      ranks: [trips[0], ...kickers.slice(0, 2)]
    };
  }

  if (pairs.length >= 2) {
    return {
      label: 'Two Pair',
      category: 3,
      ranks: [pairs[0], pairs[1], ...kickers.slice(0, 1)]
    };
  }

  if (pairs.length === 1) {
    return {
      label: 'Pair',
      category: 2,
      ranks: [pairs[0], ...kickers.slice(0, 3)]
    };
  }

  return {
    label: 'High Card',
    category: 1,
    ranks: ranks.slice(0, 5)
  };
};

const compareEvaluations = (left: PokerHandEvaluation, right: PokerHandEvaluation): number => {
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

const resolveShowdown = (state: PokerState, betAmount: number) => {
  while (state.communityCards.length < 5) {
    state.communityCards.push(drawCard(state.deck));
  }

  const playerEvaluation = evaluatePlaceholderHand([...state.playerHand, ...state.communityCards]);
  const opponentEvaluation = evaluatePlaceholderHand([...state.opponentHand, ...state.communityCards]);
  const comparison = compareEvaluations(playerEvaluation, opponentEvaluation);

  let resolution: GameResolution;

  if (comparison > 0) {
    resolution = {
      result: 'WIN',
      balanceChange: betAmount,
      betAmount
    };
  } else if (comparison < 0) {
    resolution = {
      result: 'LOSS',
      balanceChange: -betAmount,
      betAmount
    };
  } else {
    resolution = {
      result: 'PUSH',
      balanceChange: 0,
      betAmount
    };
  }

  const resolvedState: PokerState = {
    ...state,
    phase: 'resolved',
    notes: 'Poker uses a placeholder evaluator focused on matching ranks for this demo.',
    playerEvaluation,
    opponentEvaluation,
    resolution
  };

  return {
    state: resolvedState,
    currentBet: 0,
    status: GameSessionStatus.COMPLETED,
    resolution
  };
};

export class PokerEngine implements GameEngine<PokerState> {
  readonly gameType = GameType.POKER;

  createInitialState(): PokerState {
    return {
      phase: 'ready',
      deck: [],
      playerHand: [],
      opponentHand: [],
      communityCards: [],
      notes: 'Poker is a placeholder demo flow with expandable room state.',
      resolution: null
    };
  }

  handleBet(_context: EngineContext<PokerState>, request: BetRequest) {
    const deck = shuffleDeck(createDeck());
    const state: PokerState = {
      phase: 'turn',
      deck,
      playerHand: [drawCard(deck), drawCard(deck)],
      opponentHand: [drawCard(deck), drawCard(deck)],
      communityCards: [drawCard(deck), drawCard(deck), drawCard(deck)],
      notes: 'Draw the turn, draw the river, then go to showdown.',
      resolution: null
    };

    return {
      state,
      currentBet: request.amount,
      status: GameSessionStatus.WAITING_ACTION
    };
  }

  handleAction(context: EngineContext<PokerState>, request: ActionRequest) {
    if (context.currentBet <= 0 || context.state.phase === 'ready' || context.state.phase === 'resolved') {
      throw new HttpError(400, 'There is no active poker round.');
    }

    const action = request.action.toLowerCase();
    const state: PokerState = {
      ...context.state,
      deck: [...context.state.deck],
      playerHand: [...context.state.playerHand],
      opponentHand: [...context.state.opponentHand],
      communityCards: [...context.state.communityCards],
      resolution: null
    };

    if (action === 'draw-turn') {
      if (state.phase !== 'turn') {
        throw new HttpError(400, 'Turn card is only available after the flop.');
      }

      state.communityCards.push(drawCard(state.deck));
      state.phase = 'river';
      state.notes = 'River card is ready. Reveal it or go straight to showdown.';

      return {
        state,
        currentBet: context.currentBet,
        status: GameSessionStatus.WAITING_ACTION
      };
    }

    if (action === 'draw-river') {
      if (state.phase !== 'river') {
        throw new HttpError(400, 'River card is only available after the turn.');
      }

      state.communityCards.push(drawCard(state.deck));
      state.phase = 'showdown';
      state.notes = 'All cards are on the table. Trigger showdown to resolve the hand.';

      return {
        state,
        currentBet: context.currentBet,
        status: GameSessionStatus.WAITING_ACTION
      };
    }

    if (action === 'showdown') {
      return resolveShowdown(state, context.currentBet);
    }

    if (action === 'fold') {
      const foldedState: PokerState = {
        ...state,
        phase: 'resolved',
        notes: 'You folded the demo hand.',
        resolution: {
          result: 'FOLD',
          balanceChange: -context.currentBet,
          betAmount: context.currentBet
        }
      };

      return {
        state: foldedState,
        currentBet: 0,
        status: GameSessionStatus.COMPLETED,
        resolution: foldedState.resolution || undefined
      };
    }

    throw new HttpError(400, `Unsupported poker action: ${request.action}`);
  }

  calculateResult(state: PokerState): GameResolution | null {
    return state.resolution || null;
  }

  serializeState(state: PokerState) {
    return {
      phase: state.phase,
      playerHand: state.playerHand,
      opponentHand: state.phase === 'resolved' ? state.opponentHand : [{ hidden: true }, { hidden: true }],
      communityCards: state.communityCards,
      notes: state.notes,
      playerEvaluation: state.phase === 'resolved' ? state.playerEvaluation : null,
      opponentEvaluation: state.phase === 'resolved' ? state.opponentEvaluation : null,
      resolution: state.resolution || null
    };
  }
}
