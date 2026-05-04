import { GameSessionStatus, GameType } from '../../../../generated/prisma';

import type {
  ActionRequest,
  BetRequest,
  EngineContext,
  GameEngine,
  GameResolution
} from '../core/game-engine.interface';
import { createDeck, drawCard, shuffleDeck, type PlayingCard } from '../core/card.utils';
import { HttpError } from '../../../utils/http-error';
import { comparePokerEvaluations, evaluatePokerHand, type PokerHandEvaluation } from './poker.utils';

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

const resolveShowdown = (state: PokerState, betAmount: number) => {
  while (state.communityCards.length < 5) {
    state.communityCards.push(drawCard(state.deck));
  }

  const playerEvaluation = evaluatePokerHand([...state.playerHand, ...state.communityCards]);
  const opponentEvaluation = evaluatePokerHand([...state.opponentHand, ...state.communityCards]);
  const comparison = comparePokerEvaluations(playerEvaluation, opponentEvaluation);

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
