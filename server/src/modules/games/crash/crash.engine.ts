import { randomInt } from 'node:crypto';

import { GameSessionStatus, GameType } from '../../../../generated/prisma';

import type { ActionRequest, BetRequest, EngineContext, GameEngine, GameResolution } from '../core/game-engine.interface';
import { HttpError } from '../../../utils/http-error';

type CrashPhase = 'ready' | 'live' | 'resolved';

export interface CrashState {
  phase: CrashPhase;
  startTime: string | null;
  crashPoint: number;
  crashDurationMs: number;
  lastSettledMultiplier: number;
  history: Array<{
    result: string;
    multiplier: number;
  }>;
  message: string;
  resolution?: GameResolution | null;
}

const ROUND_GROWTH_RATE = 0.00008;
const MIN_CRASH_POINT = Number(Math.exp(ROUND_GROWTH_RATE * 1800).toFixed(2));
const MAX_CRASH_POINT = 25;
const HOUSE_EDGE = 0.97;

const appendHistory = (
  history: CrashState['history'],
  result: string,
  multiplier: number
): CrashState['history'] => [{ result, multiplier }, ...history].slice(0, 8);

const createInitialState = (): CrashState => ({
  phase: 'ready',
  startTime: null,
  crashPoint: MIN_CRASH_POINT,
  crashDurationMs: 0,
  lastSettledMultiplier: 1,
  history: [],
  message: 'Set a stake and cash out before the multiplier crashes.',
  resolution: null
});

const generateCrashPoint = (): number => {
  const roll = randomInt(1, 10_000) / 10_000;
  return Number(Math.min(MAX_CRASH_POINT, Math.max(MIN_CRASH_POINT, HOUSE_EDGE / (1 - roll))).toFixed(2));
};

const computeCrashDurationMs = (crashPoint: number): number =>
  Math.ceil(Math.log(crashPoint) / ROUND_GROWTH_RATE);

const computeLiveMultiplier = (elapsedMs: number): number =>
  Number(Math.max(1, Math.exp(ROUND_GROWTH_RATE * Math.max(0, elapsedMs))).toFixed(2));

const readStartTimeMs = (state: CrashState): number => {
  const startTimeMs = Date.parse(state.startTime || '');
  if (!Number.isFinite(startTimeMs)) {
    throw new HttpError(500, 'Crash round is missing a valid start time.');
  }
  return startTimeMs;
};

const hasCrashed = (state: CrashState, now = Date.now()): boolean =>
  now >= readStartTimeMs(state) + state.crashDurationMs;

const resolveCrash = (state: CrashState, betAmount: number) => {
  const resolved: CrashState = {
    ...state,
    phase: 'resolved',
    lastSettledMultiplier: state.crashPoint,
    history: appendHistory(state.history, 'BUST', state.crashPoint),
    message: `Crashed at x${state.crashPoint.toFixed(2)}. Round lost.`,
    resolution: {
      result: 'BUST',
      balanceChange: -betAmount,
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

const resolveCashOut = (state: CrashState, betAmount: number, multiplier: number) => {
  const balanceChange = Math.max(1, Math.floor(betAmount * (multiplier - 1)));
  const result = multiplier >= 10 ? 'MEGA_CASH_OUT' : multiplier >= 5 ? 'BIG_CASH_OUT' : 'CASH_OUT';
  const resolved: CrashState = {
    ...state,
    phase: 'resolved',
    lastSettledMultiplier: multiplier,
    history: appendHistory(state.history, result, multiplier),
    message: `Cashed out at x${multiplier.toFixed(2)}.`,
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

export class CrashEngine implements GameEngine<CrashState> {
  readonly gameType = GameType.CRASH;

  createInitialState(): CrashState {
    return createInitialState();
  }

  synchronize(context: EngineContext<CrashState>) {
    if (context.state.phase !== 'live') {
      return null;
    }

    if (!hasCrashed(context.state)) {
      return null;
    }

    return resolveCrash(context.state, context.currentBet);
  }

  getAutoResolveAt(state: CrashState): number | null {
    if (state.phase !== 'live') {
      return null;
    }

    return readStartTimeMs(state) + state.crashDurationMs;
  }

  handleBet(context: EngineContext<CrashState>, request: BetRequest) {
    if (context.state.phase === 'live') {
      throw new HttpError(400, 'Crash round already live. Cash out or wait for the crash.');
    }

    const crashPoint = generateCrashPoint();
    const state: CrashState = {
      phase: 'live',
      startTime: new Date().toISOString(),
      crashPoint,
      crashDurationMs: computeCrashDurationMs(crashPoint),
      lastSettledMultiplier: 1,
      history: [...context.state.history],
      message: 'Round live. Ride the climb and cash out before the crash.',
      resolution: null
    };

    return {
      state,
      currentBet: request.amount,
      status: GameSessionStatus.WAITING_ACTION
    };
  }

  handleAction(context: EngineContext<CrashState>, request: ActionRequest) {
    if (request.action !== 'cash-out') {
      throw new HttpError(400, `Unsupported crash action: ${request.action}`);
    }

    if (context.state.phase !== 'live') {
      throw new HttpError(400, 'Start a crash round before cashing out.');
    }

    if (hasCrashed(context.state)) {
      return resolveCrash(context.state, context.currentBet);
    }

    const elapsedMs = Date.now() - readStartTimeMs(context.state);
    const multiplier = Math.min(context.state.crashPoint, computeLiveMultiplier(elapsedMs));
    return resolveCashOut(context.state, context.currentBet, multiplier);
  }

  calculateResult(state: CrashState): GameResolution | null {
    return state.resolution || null;
  }

  serializeState(state: CrashState): Record<string, unknown> {
    return {
      phase: state.phase,
      startTime: state.startTime,
      lastSettledMultiplier: state.lastSettledMultiplier,
      history: state.history,
      message: state.message
    };
  }
}
