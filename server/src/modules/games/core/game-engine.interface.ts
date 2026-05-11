import type { GameSessionStatus, GameType } from '../../../../generated/prisma';

export interface GameResolution {
  result: string;
  balanceChange: number;
  betAmount: number;
}

export interface EngineContext<TState> {
  sessionId: string;
  user: {
    id: string;
    email: string;
    balance: number;
  };
  state: TState;
  currentBet: number;
}

export interface BetRequest {
  amount: number;
  payload?: Record<string, unknown>;
}

export interface ActionRequest {
  action: string;
  payload?: Record<string, unknown>;
}

export interface GameEngineResult<TState> {
  state: TState;
  currentBet: number;
  status: GameSessionStatus;
  resolution?: GameResolution;
}

export interface GameEngine<TState = Record<string, unknown>> {
  readonly gameType: GameType;
  createInitialState(): TState;
  synchronize?(context: EngineContext<TState>): GameEngineResult<TState> | null;
  getAutoResolveAt?(state: TState): number | null;
  handleBet(context: EngineContext<TState>, request: BetRequest): GameEngineResult<TState>;
  handleAction(context: EngineContext<TState>, request: ActionRequest): GameEngineResult<TState>;
  calculateResult(state: TState): GameResolution | null;
  serializeState(state: TState): Record<string, unknown>;
}
