import { GameSessionStatus, GameType } from '../../../../generated/prisma';

import type {
  ActionRequest,
  BetRequest,
  EngineContext,
  GameEngine,
  GameResolution
} from '../core/game-engine.interface';
import { HttpError } from '../../../utils/http-error';

type RouletteColor = 'red' | 'black' | 'green';
type RoulettePocket = number | '00';

interface RouletteSelection {
  type: 'color' | 'number' | 'parity' | 'dozen' | 'range' | 'column';
  value: RouletteColor | RoulettePocket | 'odd' | 'even' | '1st12' | '2nd12' | '3rd12' | '1-18' | '19-36' | 'top' | 'middle' | 'bottom';
}

interface RouletteSpinResult {
  number: RoulettePocket;
  color: RouletteColor;
}

const wheelOrder: RoulettePocket[] = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];

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

const getColorForNumber = (number: RoulettePocket): RouletteColor => {
  if (number === 0 || number === '00') {
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

  if (type === 'number' && value === '00') {
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

  if (type === 'parity' && (value === 'odd' || value === 'even')) {
    return { type, value };
  }

  if (type === 'dozen' && (value === '1st12' || value === '2nd12' || value === '3rd12')) {
    return { type, value };
  }

  if (type === 'range' && (value === '1-18' || value === '19-36')) {
    return { type, value };
  }

  if (type === 'column' && (value === 'top' || value === 'middle' || value === 'bottom')) {
    return { type, value };
  }

  throw new HttpError(400, 'Roulette bet must target a color or a number between 0 and 36.');
};

const evaluateSelection = (selection: RouletteSelection, spin: RouletteSpinResult): boolean => {
  switch (selection.type) {
    case 'color':
      return selection.value === spin.color;
    case 'number':
      return selection.value === spin.number;
    case 'parity':
      if (typeof spin.number !== 'number' || spin.number === 0) return false;
      return selection.value === (spin.number % 2 === 0 ? 'even' : 'odd');
    case 'dozen':
      if (typeof spin.number !== 'number' || spin.number === 0) return false;
      if (selection.value === '1st12') return spin.number >= 1 && spin.number <= 12;
      if (selection.value === '2nd12') return spin.number >= 13 && spin.number <= 24;
      return spin.number >= 25 && spin.number <= 36;
    case 'range':
      if (typeof spin.number !== 'number' || spin.number === 0) return false;
      return selection.value === '1-18' ? spin.number >= 1 && spin.number <= 18 : spin.number >= 19 && spin.number <= 36;
    case 'column':
      if (typeof spin.number !== 'number' || spin.number === 0) return false;
      if (selection.value === 'top') return spin.number % 3 === 0;
      if (selection.value === 'middle') return spin.number % 3 === 2;
      return spin.number % 3 === 1;
  }
};

const getPayoutMultiplier = (selection: RouletteSelection): number => {
  switch (selection.type) {
    case 'color':
    case 'parity':
    case 'range':
      return 2;
    case 'dozen':
    case 'column':
      return 3;
    case 'number':
      return 36;
  }
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
    const resultNumber = wheelOrder[Math.floor(Math.random() * wheelOrder.length)] ?? 0;
    const spin = {
      number: resultNumber,
      color: getColorForNumber(resultNumber)
    } satisfies RouletteSpinResult;

    const won = evaluateSelection(selection, spin);
    const payoutMultiplier = getPayoutMultiplier(selection);
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
