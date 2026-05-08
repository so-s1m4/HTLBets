import { GameSessionStatus, GameType } from '../../../../generated/prisma';

import type {
  ActionRequest,
  BetRequest,
  EngineContext,
  GameEngine,
  GameResolution
} from '../core/game-engine.interface';
import { createDeck, drawCard, getBlackjackCardValue, shuffleDeck, type PlayingCard } from '../core/card.utils';
import { HttpError } from '../../../utils/http-error';

interface BlackjackHandState {
  cards: PlayingCard[];
  betAmount: number;
  doubledDown: boolean;
  stood: boolean;
  busted: boolean;
  finished: boolean;
  fromSplit: boolean;
  splitAces: boolean;
  outcome?: 'BLACKJACK' | 'WIN' | 'LOSS' | 'PUSH';
  balanceChange?: number;
}

export interface BlackjackState {
  phase: 'ready' | 'insurance' | 'player-turn' | 'dealer-turn' | 'resolved';
  deck: PlayingCard[];
  playerHands: BlackjackHandState[];
  activeHandIndex: number;
  dealerHand: PlayingCard[];
  insuranceBet: number;
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

const cloneHand = (hand: BlackjackHandState): BlackjackHandState => ({
  ...hand,
  cards: [...hand.cards]
});

const cloneState = (state: BlackjackState): BlackjackState => ({
  ...state,
  deck: [...state.deck],
  playerHands: state.playerHands.map(cloneHand),
  dealerHand: [...state.dealerHand],
  resolution: null
});

const createPlayerHand = (cards: PlayingCard[], betAmount: number, fromSplit = false, splitAces = false): BlackjackHandState => ({
  cards,
  betAmount,
  doubledDown: false,
  stood: false,
  busted: false,
  finished: false,
  fromSplit,
  splitAces
});

const getTotalCommitted = (state: BlackjackState): number =>
  state.playerHands.reduce((sum, hand) => sum + hand.betAmount, 0) + state.insuranceBet;

const getBaseBet = (state: BlackjackState): number => state.playerHands[0]?.betAmount || 0;

const getActiveHand = (state: BlackjackState): BlackjackHandState | null => state.playerHands[state.activeHandIndex] || null;

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

const dealerShowsAce = (state: BlackjackState): boolean => state.dealerHand[1]?.rank === 'A';

const canSplitHand = (hand: BlackjackHandState | null): boolean =>
  Boolean(hand && hand.cards.length === 2 && hand.cards[0]?.rank === hand.cards[1]?.rank && !hand.doubledDown);

const overallResultLabel = (hands: BlackjackHandState[], balanceChange: number): string => {
  if (hands.length === 1 && hands[0]?.outcome === 'BLACKJACK') {
    return 'BLACKJACK';
  }

  const distinctOutcomes = new Set(hands.map((hand) => hand.outcome).filter(Boolean));

  if (distinctOutcomes.size > 1) {
    return 'MIXED';
  }

  if (balanceChange > 0) {
    return 'WIN';
  }

  if (balanceChange < 0) {
    return 'LOSS';
  }

  return 'PUSH';
};

const overallMessage = (state: BlackjackState, dealerScore: number): string => {
  const outcomes = state.playerHands.map((hand) => hand.outcome);
  const insuranceCopy =
    state.insuranceBet > 0
      ? dealerScore === 21
        ? ' Insurance paid out.'
        : ' Insurance lost.'
      : '';

  if (state.playerHands.length > 1) {
    return `Split hands resolved.${insuranceCopy}`;
  }

  if (outcomes[0] === 'BLACKJACK') {
    return `Blackjack. You win with a 3:2 payout.${insuranceCopy}`;
  }

  if (outcomes[0] === 'WIN') {
    return `You beat the dealer.${insuranceCopy}`;
  }

  if (outcomes[0] === 'LOSS') {
    return dealerScore > 21 ? `Dealer busts, but your hand was already dead.${insuranceCopy}` : `Dealer wins this round.${insuranceCopy}`;
  }

  return `Push. Your balance stays the same.${insuranceCopy}`;
};

const settleAgainstDealer = (state: BlackjackState) => {
  state.phase = 'dealer-turn';

  while (getHandScore(state.dealerHand) < 17) {
    state.dealerHand.push(drawCard(state.deck));
  }

  const dealerScore = getHandScore(state.dealerHand);
  let totalBalanceChange = state.insuranceBet > 0 ? -state.insuranceBet : 0;

  for (const hand of state.playerHands) {
    const playerScore = getHandScore(hand.cards);
    let outcome: BlackjackHandState['outcome'];
    let balanceChange = 0;

    if (hand.busted || playerScore > 21) {
      outcome = 'LOSS';
      balanceChange = -hand.betAmount;
    } else if (!hand.fromSplit && hasBlackjack(hand.cards)) {
      outcome = 'BLACKJACK';
      balanceChange = Math.floor(hand.betAmount * 1.5);
    } else if (dealerScore > 21 || playerScore > dealerScore) {
      outcome = 'WIN';
      balanceChange = hand.betAmount;
    } else if (playerScore < dealerScore) {
      outcome = 'LOSS';
      balanceChange = -hand.betAmount;
    } else {
      outcome = 'PUSH';
      balanceChange = 0;
    }

    hand.finished = true;
    hand.outcome = outcome;
    hand.balanceChange = balanceChange;
    totalBalanceChange += balanceChange;
  }

  return resolveRound(
    state,
    getTotalCommitted(state),
    overallResultLabel(state.playerHands, totalBalanceChange),
    totalBalanceChange,
    overallMessage(state, dealerScore)
  );
};

const moveToNextHandOrDealer = (state: BlackjackState) => {
  const nextIndex = state.playerHands.findIndex((hand, index) => index > state.activeHandIndex && !hand.finished);

  if (nextIndex >= 0) {
    state.activeHandIndex = nextIndex;
    state.phase = 'player-turn';
    state.message = `Hand ${nextIndex + 1} is live.`;

    return {
      state,
      currentBet: getTotalCommitted(state),
      status: GameSessionStatus.WAITING_ACTION
    };
  }

  return settleAgainstDealer(state);
};

const resolveInsuranceDecision = (state: BlackjackState, takeInsurance: boolean) => {
  const baseBet = getBaseBet(state);

  if (takeInsurance) {
    state.insuranceBet = Math.floor(baseBet / 2);
  }

  if (hasBlackjack(state.dealerHand)) {
    const insurancePayout = takeInsurance ? state.insuranceBet * 2 : 0;
    const netBalanceChange = insurancePayout - baseBet;

    return resolveRound(
      state,
      getTotalCommitted(state),
      takeInsurance ? 'INSURED' : 'LOSS',
      netBalanceChange,
      takeInsurance ? 'Dealer blackjack. Insurance covers the main loss.' : 'Dealer blackjack. Round lost.'
    );
  }

  state.phase = 'player-turn';
  state.message = takeInsurance ? 'Insurance placed. Choose hit, stand, double, or split.' : 'Choose hit, stand, double, or split.';

  return {
    state,
    currentBet: getTotalCommitted(state),
    status: GameSessionStatus.WAITING_ACTION
  };
};

export class BlackjackEngine implements GameEngine<BlackjackState> {
  readonly gameType = GameType.BLACKJACK;

  createInitialState(): BlackjackState {
    return {
      phase: 'ready',
      deck: [],
      playerHands: [],
      activeHandIndex: 0,
      dealerHand: [],
      insuranceBet: 0,
      message: 'Place a bet to start a blackjack round.',
      resolution: null
    };
  }

  handleBet(_context: EngineContext<BlackjackState>, request: BetRequest) {
    const deck = shuffleDeck(createDeck());
    const baseBet = request.amount;
    const firstHand = createPlayerHand([drawCard(deck), drawCard(deck)], baseBet);
    const state: BlackjackState = {
      phase: 'player-turn',
      deck,
      playerHands: [firstHand],
      activeHandIndex: 0,
      dealerHand: [drawCard(deck), drawCard(deck)],
      insuranceBet: 0,
      message: 'Choose hit, stand, double, or split.',
      resolution: null
    };

    const playerBlackjack = hasBlackjack(firstHand.cards);
    const dealerBlackjack = hasBlackjack(state.dealerHand);

    if (playerBlackjack && dealerBlackjack) {
      firstHand.outcome = 'PUSH';
      firstHand.balanceChange = 0;
      firstHand.finished = true;
      return resolveRound(state, baseBet, 'PUSH', 0, 'Both hands hit blackjack. Push.');
    }

    if (playerBlackjack) {
      firstHand.outcome = 'BLACKJACK';
      firstHand.balanceChange = Math.floor(baseBet * 1.5);
      firstHand.finished = true;
      return resolveRound(
        state,
        baseBet,
        'BLACKJACK',
        Math.floor(baseBet * 1.5),
        'Blackjack. You win with a 3:2 payout.'
      );
    }

    if (dealerShowsAce(state)) {
      state.phase = 'insurance';
      state.message = 'Dealer shows an ace. Take insurance or continue.';

      return {
        state,
        currentBet: baseBet,
        status: GameSessionStatus.WAITING_ACTION
      };
    }

    if (dealerBlackjack) {
      firstHand.outcome = 'LOSS';
      firstHand.balanceChange = -baseBet;
      firstHand.finished = true;
      return resolveRound(state, baseBet, 'LOSS', -baseBet, 'Dealer blackjack. Round lost.');
    }

    return {
      state,
      currentBet: baseBet,
      status: GameSessionStatus.WAITING_ACTION
    };
  }

  handleAction(context: EngineContext<BlackjackState>, request: ActionRequest) {
    if (context.currentBet <= 0 || context.state.phase === 'ready') {
      throw new HttpError(400, 'There is no active blackjack round.');
    }

    const action = request.action.toLowerCase();
    const state = cloneState(context.state);

    if (state.phase === 'insurance') {
      if (action === 'insurance' || action === 'take-insurance') {
        const insuranceBet = Math.floor(getBaseBet(state) / 2);

        if (context.user.balance < getTotalCommitted(state) + insuranceBet) {
          throw new HttpError(400, 'Not enough balance to take insurance.');
        }

        return resolveInsuranceDecision(state, true);
      }

      if (action === 'skip-insurance' || action === 'no-insurance') {
        return resolveInsuranceDecision(state, false);
      }

      throw new HttpError(400, 'Choose whether to take insurance before playing the hand.');
    }

    if (state.phase !== 'player-turn') {
      throw new HttpError(400, 'There is no active blackjack round.');
    }

    const hand = getActiveHand(state);

    if (!hand) {
      throw new HttpError(400, 'No active blackjack hand was found.');
    }

    if (action === 'hit') {
      hand.cards.push(drawCard(state.deck));

      if (getHandScore(hand.cards) > 21) {
        hand.busted = true;
        hand.finished = true;
        hand.outcome = 'LOSS';
        hand.balanceChange = -hand.betAmount;
        state.message = `Hand ${state.activeHandIndex + 1} busts.`;
        return moveToNextHandOrDealer(state);
      }

      state.message = 'You drew a card. Hit again or stand.';

      return {
        state,
        currentBet: getTotalCommitted(state),
        status: GameSessionStatus.WAITING_ACTION
      };
    }

    if (action === 'stand') {
      hand.stood = true;
      hand.finished = true;
      state.message = `Hand ${state.activeHandIndex + 1} stands.`;
      return moveToNextHandOrDealer(state);
    }

    if (action === 'double') {
      if (hand.doubledDown || hand.cards.length !== 2) {
        throw new HttpError(400, 'Double is only available on the first move of the active hand.');
      }

      if (context.user.balance < getTotalCommitted(state) + hand.betAmount) {
        throw new HttpError(400, 'Not enough balance to double this hand.');
      }

      hand.betAmount *= 2;
      hand.doubledDown = true;
      hand.cards.push(drawCard(state.deck));

      if (getHandScore(hand.cards) > 21) {
        hand.busted = true;
        hand.finished = true;
        hand.outcome = 'LOSS';
        hand.balanceChange = -hand.betAmount;
        state.message = `Hand ${state.activeHandIndex + 1} busts after doubling down.`;
        return moveToNextHandOrDealer(state);
      }

      hand.stood = true;
      hand.finished = true;
      state.message = `Hand ${state.activeHandIndex + 1} doubled down.`;
      return moveToNextHandOrDealer(state);
    }

    if (action === 'split') {
      if (!canSplitHand(hand) || state.playerHands.length !== 1) {
        throw new HttpError(400, 'Split is only available on your opening pair.');
      }

      if (context.user.balance < getTotalCommitted(state) + hand.betAmount) {
        throw new HttpError(400, 'Not enough balance to split this hand.');
      }

      const splitAces = hand.cards[0]?.rank === 'A';
      const leftHand = createPlayerHand([hand.cards[0], drawCard(state.deck)], hand.betAmount, true, splitAces);
      const rightHand = createPlayerHand([hand.cards[1], drawCard(state.deck)], hand.betAmount, true, splitAces);

      if (splitAces) {
        leftHand.stood = true;
        leftHand.finished = true;
        rightHand.stood = true;
        rightHand.finished = true;
      }

      state.playerHands = [leftHand, rightHand];
      state.activeHandIndex = 0;
      state.message = splitAces ? 'Aces split. Each hand receives one card.' : 'Hand split. Play the first hand.';

      if (splitAces) {
        return moveToNextHandOrDealer(state);
      }

      return {
        state,
        currentBet: getTotalCommitted(state),
        status: GameSessionStatus.WAITING_ACTION
      };
    }

    throw new HttpError(400, `Unsupported blackjack action: ${request.action}`);
  }

  calculateResult(state: BlackjackState): GameResolution | null {
    return state.resolution || null;
  }

  serializeState(state: BlackjackState) {
    const activeHand = getActiveHand(state);
    const hideDealerHoleCard = ['player-turn', 'insurance'].includes(state.phase) && state.dealerHand.length > 1;
    const visibleDealerHand = hideDealerHoleCard ? [{ hidden: true }, state.dealerHand[1]] : state.dealerHand;

    return {
      phase: state.phase,
      playerHand: activeHand?.cards || [],
      playerHands: state.playerHands.map((hand, index) => ({
        cards: hand.cards,
        score: getHandScore(hand.cards),
        betAmount: hand.betAmount,
        doubledDown: hand.doubledDown,
        finished: hand.finished,
        active: index === state.activeHandIndex && state.phase === 'player-turn',
        outcome: hand.outcome || null
      })),
      activeHandIndex: state.activeHandIndex,
      dealerHand: visibleDealerHand,
      playerScore: activeHand ? getHandScore(activeHand.cards) : 0,
      dealerScore: hideDealerHoleCard ? getBlackjackCardValue(state.dealerHand[1]) : getHandScore(state.dealerHand),
      doubledDown: activeHand?.doubledDown || false,
      canDouble: state.phase === 'player-turn' && Boolean(activeHand && activeHand.cards.length === 2 && !activeHand.doubledDown),
      canSplit: state.phase === 'player-turn' && state.playerHands.length === 1 && canSplitHand(activeHand),
      canInsurance: state.phase === 'insurance' && state.insuranceBet === 0,
      insuranceBet: state.insuranceBet,
      totalWager: getTotalCommitted(state),
      message: state.message,
      resolution: state.resolution || null
    };
  }
}
