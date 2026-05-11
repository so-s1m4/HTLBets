import { randomInt } from 'node:crypto';

import { GameSessionStatus, GameType } from '../../../../generated/prisma';

import type { ActionRequest, BetRequest, EngineContext, GameEngine, GameResolution } from '../core/game-engine.interface';
import { HttpError } from '../../../utils/http-error';

type MinerPhase = 'ready' | 'playing' | 'resolved';
type MinerCellView = 'hidden' | 'safe' | 'mine';

interface MinerCellState {
  hasMine: boolean;
  revealed: boolean;
}

export interface MinerState {
  phase: MinerPhase;
  gridSize: number;
  mineCount: number;
  cells: MinerCellState[];
  revealedSafeCount: number;
  payoutMultiplier: number;
  message: string;
  resolution?: GameResolution | null;
}

const GRID_SIZE = 25;
const MIN_MINES = 1;
const MAX_MINES = 24;
const HOUSE_EDGE = 0.96;

const cloneState = (state: MinerState): MinerState => ({
  ...state,
  cells: state.cells.map((cell) => ({ ...cell })),
  resolution: state.resolution ? { ...state.resolution } : null
});

const createHiddenCells = (): MinerCellState[] =>
  Array.from({ length: GRID_SIZE }, () => ({
    hasMine: false,
    revealed: false
  }));

const createMineIndices = (mineCount: number): Set<number> => {
  const mines = new Set<number>();
  while (mines.size < mineCount) {
    mines.add(randomInt(0, GRID_SIZE));
  }
  return mines;
};

const normalizeMineCount = (value: unknown): number => {
  const mineCount = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(mineCount) || mineCount < MIN_MINES || mineCount > MAX_MINES) {
    throw new HttpError(400, `Mine count must be between ${MIN_MINES} and ${MAX_MINES}.`);
  }
  return mineCount;
};

const calculateNextMultiplier = (revealedSafeCount: number, mineCount: number): number => {
  let multiplier = 1;
  for (let step = 0; step < revealedSafeCount; step += 1) {
    multiplier *= (GRID_SIZE - step) / (GRID_SIZE - mineCount - step);
  }
  return Number((multiplier * HOUSE_EDGE).toFixed(2));
};

const revealAllMines = (cells: MinerCellState[]): MinerCellState[] =>
  cells.map((cell) => (cell.hasMine ? { ...cell, revealed: true } : cell));

const resolveRound = (state: MinerState, betAmount: number, result: string, balanceChange: number, message: string) => {
  const resolved: MinerState = {
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
    state: resolved,
    currentBet: 0,
    status: GameSessionStatus.COMPLETED,
    resolution: resolved.resolution || undefined
  };
};

export class MinerEngine implements GameEngine<MinerState> {
  readonly gameType = GameType.MINER;

  createInitialState(): MinerState {
    return {
      phase: 'ready',
      gridSize: GRID_SIZE,
      mineCount: 3,
      cells: createHiddenCells(),
      revealedSafeCount: 0,
      payoutMultiplier: 1,
      message: 'Choose a stake, set the mine count, and start uncovering tiles.',
      resolution: null
    };
  }

  handleBet(_context: EngineContext<MinerState>, request: BetRequest) {
    const mineCount = normalizeMineCount(request.payload?.mineCount ?? 3);
    const mineIndices = createMineIndices(mineCount);
    const cells = createHiddenCells().map((cell, index) => ({
      ...cell,
      hasMine: mineIndices.has(index)
    }));

    const state: MinerState = {
        phase: 'playing',
        gridSize: GRID_SIZE,
        mineCount,
        cells,
        revealedSafeCount: 0,
        payoutMultiplier: 1,
        message: 'Round live. Reveal safe tiles or cash out before you hit a mine.',
        resolution: null
      };

    return {
      state,
      currentBet: request.amount,
      status: GameSessionStatus.WAITING_ACTION
    };
  }

  handleAction(context: EngineContext<MinerState>, request: ActionRequest) {
    const state = cloneState(context.state);

    if (state.phase !== 'playing') {
      throw new HttpError(400, 'Start a miner round before performing an action.');
    }

    if (request.action === 'cash-out') {
      if (state.revealedSafeCount === 0) {
        throw new HttpError(400, 'Reveal at least one safe tile before cashing out.');
      }

      const balanceChange = Math.max(1, Math.floor(context.currentBet * (state.payoutMultiplier - 1)));
      return resolveRound(
        state,
        context.currentBet,
        'CASH_OUT',
        balanceChange,
        `Cashed out at x${state.payoutMultiplier.toFixed(2)} after ${state.revealedSafeCount} safe picks.`
      );
    }

    if (request.action !== 'reveal-cell') {
      throw new HttpError(400, `Unsupported miner action: ${request.action}`);
    }

    const index = Number(request.payload?.index);
    if (!Number.isInteger(index) || index < 0 || index >= GRID_SIZE) {
      throw new HttpError(400, 'Cell index is out of range.');
    }

    const cell = state.cells[index];
    if (cell.revealed) {
      throw new HttpError(400, 'That tile is already revealed.');
    }

    cell.revealed = true;

    if (cell.hasMine) {
      state.cells = revealAllMines(state.cells);
      return resolveRound(
        state,
        context.currentBet,
        'BUST',
        -context.currentBet,
        'You hit a mine. Round lost.'
      );
    }

    state.revealedSafeCount += 1;
    state.payoutMultiplier = calculateNextMultiplier(state.revealedSafeCount, state.mineCount);

    const safeCells = GRID_SIZE - state.mineCount;
    if (state.revealedSafeCount >= safeCells) {
      const balanceChange = Math.max(1, Math.floor(context.currentBet * (state.payoutMultiplier - 1)));
      state.cells = revealAllMines(state.cells);
      return resolveRound(
        state,
        context.currentBet,
        'CLEARED',
        balanceChange,
        `Perfect run. All safe tiles cleared at x${state.payoutMultiplier.toFixed(2)}.`
      );
    }

    state.message = `Safe pick ${state.revealedSafeCount}. Cash out now at x${state.payoutMultiplier.toFixed(2)} or keep digging.`;

    return {
      state,
      currentBet: context.currentBet,
      status: GameSessionStatus.WAITING_ACTION
    };
  }

  calculateResult(state: MinerState): GameResolution | null {
    return state.resolution || null;
  }

  serializeState(state: MinerState): Record<string, unknown> {
    const cellViews: MinerCellView[] = state.cells.map((cell) => {
      if (!cell.revealed) {
        return 'hidden';
      }
      return cell.hasMine ? 'mine' : 'safe';
    });

    return {
      phase: state.phase,
      gridSize: state.gridSize,
      mineCount: state.mineCount,
      revealedSafeCount: state.revealedSafeCount,
      payoutMultiplier: state.payoutMultiplier,
      message: state.message,
      cells: cellViews
    };
  }
}
