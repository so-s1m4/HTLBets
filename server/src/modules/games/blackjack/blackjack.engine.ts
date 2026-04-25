import { GameSessionStatus, GameType } from '@prisma/client';

import type {
  ActionRequest,
  BetRequest,
  EngineContext,
  GameEngine,
  GameResolution
} from '../core/game-engine.interface';
import { createDeck, drawCard, getBlackjackCardValue, shuffleDeck, type PlayingCard } from '../core/card.utils';
import { HttpError } from '../../../utils/http-error';

export interface BlackjackState {
  phase: 'ready' | 'player-turn' | 'dealer-turn' | 'resolved';
  deck: PlayingCard[];
  playerHand: PlayingCard[];
  dealerHand: PlayingCard[];
  doubledDown: boolean;
  message: string;
  resolution?: GameResolution | null;
}

const getHandScore = (hand: PlayingCard[]) => {
  let total = hand.reduce((sum, card) => sum + getBlackjackCardValue(card), 0);
  let aces = hand.filter((card) => card.rank === 'A').length;

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
};

const hasBlackjack = (hand: PlayingCard[]): boolean => hand.length === 2 && getHandScore(hand) === 21;

const resolveRound = (state: BlackjackState, betAmount: number, result: string, balanceChange: number, message: string) => {
  const resolvedState: BlackjackState = {
    ...state,
    phase: 'resolved',
    message,
    resolution: {
      result,
      balanceChange,
      betAmount
    }
  };

  return {
    state: resolvedState,
    currentBet: 0,
    status: GameSessionStatus.COMPLETED,
    resolution: resolvedState.resolution || undefined
  };
};

const finishAgainstDealer = (state: BlackjackState, betAmount: number) => {
  state.phase = 'dealer-turn';

  while (getHandScore(state.dealerHand) < 17) {
    state.dealerHand.push(drawCard(state.deck));
  }

  const playerScore = getHandScore(state.playerHand);
  const dealerScore = getHandScore(state.dealerHand);

  if (dealerScore > 21 || playerScore > dealerScore) {
    return resolveRound(state, betAmount, 'WIN', betAmount, 'You beat the dealer.');
  }

  if (playerScore < dealerScore) {
    return resolveRound(state, betAmount, 'LOSS', -betAmount, 'Dealer wins this round.');
  }

  return resolveRound(state, betAmount, 'PUSH', 0, 'Push. Your balance stays the same.');
};

export class BlackjackEngine implements GameEngine<BlackjackState> {
  readonly gameType = GameType.BLACKJACK;

  createInitialState(): BlackjackState {
    return {
      phase: 'ready',
      deck: [],
      playerHand: [],
      dealerHand: [],
      doubledDown: false,
      message: 'Place a bet to start a blackjack round.',
      resolution: null
    };
  }

  handleBet(_context: EngineContext<BlackjackState>, request: BetRequest) {
    const deck = shuffleDeck(createDeck());
    const state: BlackjackState = {
      phase: 'player-turn',
      deck,
      playerHand: [drawCard(deck), drawCard(deck)],
      dealerHand: [drawCard(deck), drawCard(deck)],
      doubledDown: false,
      message: 'Choose hit, stand, or double.',
      resolution: null
    };

    const playerBlackjack = hasBlackjack(state.playerHand);
    const dealerBlackjack = hasBlackjack(state.dealerHand);

    if (playerBlackjack && dealerBlackjack) {
      return resolveRound(state, request.amount, 'PUSH', 0, 'Both hands hit blackjack. Push.');
    }

    if (playerBlackjack) {
      return resolveRound(
        state,
        request.amount,
        'BLACKJACK',
        Math.floor(request.amount * 1.5),
        'Blackjack. You win with a 3:2 payout.'
      );
    }

    if (dealerBlackjack) {
      return resolveRound(state, request.amount, 'LOSS', -request.amount, 'Dealer blackjack. Round lost.');
    }

    return {
      state,
      currentBet: request.amount,
      status: GameSessionStatus.WAITING_ACTION
    };
  }

  handleAction(context: EngineContext<BlackjackState>, request: ActionRequest) {
    if (context.state.phase !== 'player-turn' || context.currentBet <= 0) {
      throw new HttpError(400, 'There is no active blackjack round.');
    }

    const action = request.action.toLowerCase();
    const state: BlackjackState = {
      ...context.state,
      deck: [...context.state.deck],
      playerHand: [...context.state.playerHand],
      dealerHand: [...context.state.dealerHand],
      resolution: null
    };

    if (action === 'hit') {
      state.playerHand.push(drawCard(state.deck));

      if (getHandScore(state.playerHand) > 21) {
        return resolveRound(state, context.currentBet, 'LOSS', -context.currentBet, 'Bust. You went over 21.');
      }

      state.message = 'You drew a card. Hit again or stand.';

      return {
        state,
        currentBet: context.currentBet,
        status: GameSessionStatus.WAITING_ACTION
      };
    }

    if (action === 'stand') {
      return finishAgainstDealer(state, context.currentBet);
    }

    if (action === 'double') {
      if (state.doubledDown || state.playerHand.length !== 2) {
        throw new HttpError(400, 'Double is only available on the first move of a round.');
      }

      if (context.user.balance < context.currentBet * 2) {
        throw new HttpError(400, 'Not enough balance to double this hand.');
      }

      const doubledBet = context.currentBet * 2;
      state.doubledDown = true;
      state.playerHand.push(drawCard(state.deck));

      if (getHandScore(state.playerHand) > 21) {
        return resolveRound(state, doubledBet, 'LOSS', -doubledBet, 'Bust after doubling down.');
      }

      return finishAgainstDealer(state, doubledBet);
    }

    throw new HttpError(400, `Unsupported blackjack action: ${request.action}`);
  }

  calculateResult(state: BlackjackState): GameResolution | null {
    return state.resolution || null;
  }

  serializeState(state: BlackjackState) {
    const hideDealerHoleCard = state.phase === 'player-turn' && state.dealerHand.length > 1;
    const visibleDealerHand = hideDealerHoleCard
      ? [{ hidden: true }, state.dealerHand[1]]
      : state.dealerHand;

    return {
      phase: state.phase,
      playerHand: state.playerHand,
      dealerHand: visibleDealerHand,
      playerScore: getHandScore(state.playerHand),
      dealerScore: hideDealerHoleCard ? getBlackjackCardValue(state.dealerHand[1]) : getHandScore(state.dealerHand),
      doubledDown: state.doubledDown,
      canDouble: state.phase === 'player-turn' && state.playerHand.length === 2 && !state.doubledDown,
      message: state.message,
      resolution: state.resolution || null
    };
  }
}
