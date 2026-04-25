import { GameSessionStatus, GameType } from '@prisma/client';

import type {
  ActionRequest,
  BetRequest,
  EngineContext,
  GameEngine,
  GameResolution
} from '../core/game-engine.interface';
import { HttpError } from '../../../utils/http-error';

type RouletteColor = 'red' | 'black' | 'green';

interface RouletteSelection {
  type: 'color' | 'number';
  value: RouletteColor | number;
}

interface RouletteSpinResult {
  number: number;
  color: RouletteColor;
}

export interface RouletteState {
  phase: 'ready' | 'resolved';
  history: RouletteSpinResult[];
  lastRound?: {
    selection: RouletteSelection;
    spin: RouletteSpinResult;
    payoutMultiplier: number;
    won: boolean;
  };
  resolution?: GameResolution | null;
}

const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const getColorForNumber = (number: number): RouletteColor => {
  if (number === 0) {
    return 'green';
  }

  return redNumbers.has(number) ? 'red' : 'black';
};

const getSelection = (request: BetRequest): RouletteSelection => {
  const type = request.payload?.selectionType;
  const value = request.payload?.value;

  if (type === 'color' && (value === 'red' || value === 'black')) {
    return {
      type,
      value
    };
  }

  if (type === 'number' && Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 36) {
    return {
      type,
      value: Number(value)
    };
  }

  throw new HttpError(400, 'Roulette bet must target a color or a number between 0 and 36.');
};

export class RouletteEngine implements GameEngine<RouletteState> {
  readonly gameType = GameType.ROULETTE;

  createInitialState(): RouletteState {
    return {
      phase: 'ready',
      history: [],
      resolution: null
    };
  }

  handleBet(_context: EngineContext<RouletteState>, request: BetRequest) {
    const selection = getSelection(request);
    const resultNumber = Math.floor(Math.random() * 37);
    const spin = {
      number: resultNumber,
      color: getColorForNumber(resultNumber)
    } satisfies RouletteSpinResult;

    const won =
      selection.type === 'color'
        ? selection.value === spin.color
        : Number(selection.value) === spin.number;

    const payoutMultiplier = selection.type === 'color' ? 2 : 36;
    const balanceChange = won ? request.amount * (payoutMultiplier - 1) : -request.amount;

    const state: RouletteState = {
      phase: 'resolved',
      history: [spin, ...(_context.state.history || [])].slice(0, 12),
      lastRound: {
        selection,
        spin,
        payoutMultiplier,
        won
      },
      resolution: {
        result: won ? 'WIN' : 'LOSS',
        balanceChange,
        betAmount: request.amount
      }
    };

    return {
      state,
      currentBet: 0,
      status: GameSessionStatus.COMPLETED,
      resolution: state.resolution || undefined
    };
  }

  handleAction(_context: EngineContext<RouletteState>, _request: ActionRequest): never {
    throw new HttpError(400, 'Roulette resolves immediately after placing a bet.');
  }

  calculateResult(state: RouletteState): GameResolution | null {
    return state.resolution || null;
  }

  serializeState(state: RouletteState) {
    return {
      ...state
    };
  }
}
