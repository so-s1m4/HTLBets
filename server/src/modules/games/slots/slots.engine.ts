import { randomInt } from 'node:crypto';

import { GameSessionStatus, GameType } from '../../../../generated/prisma';

import type { ActionRequest, BetRequest, EngineContext, GameEngine, GameResolution } from '../core/game-engine.interface';
import { HttpError } from '../../../utils/http-error';

type SlotSymbol = 'cherry' | 'lemon' | 'bell' | 'bar' | 'seven' | 'diamond' | 'star' | 'clover';

interface SlotMachineConfig {
  id: string;
  name: string;
  accent: string;
  volatility: 'low' | 'medium' | 'high';
  description: string;
  strip: SlotSymbol[];
  payouts: Partial<Record<SlotSymbol, number>>;
}

interface SlotsState {
  phase: 'ready' | 'resolved';
  selectedMachineId: string;
  visibleGrid: SlotSymbol[][];
  winLines: number[];
  payoutMultiplier: number;
  history: Array<{
    machineId: string;
    result: string;
    payoutMultiplier: number;
  }>;
  message: string;
  resolution?: GameResolution | null;
}

const MACHINES: SlotMachineConfig[] = [
  {
    id: 'classic-fruit',
    name: 'Classic Fruit',
    accent: '#ff8a65',
    volatility: 'low',
    description: 'Reliable fruit reels with smaller but frequent hits.',
    strip: ['cherry', 'lemon', 'bell', 'cherry', 'bar', 'lemon', 'cherry', 'diamond', 'bell', 'lemon', 'bar', 'star'],
    payouts: { cherry: 2, lemon: 3, bell: 4, bar: 6, diamond: 10, star: 14 }
  },
  {
    id: 'neon-sevens',
    name: 'Neon Sevens',
    accent: '#ff5ea8',
    volatility: 'high',
    description: 'Sparse sevens and bars with sharper jackpot spikes.',
    strip: ['bar', 'lemon', 'seven', 'star', 'bar', 'diamond', 'seven', 'clover', 'bar', 'cherry', 'seven', 'bell'],
    payouts: { bar: 4, seven: 18, diamond: 10, star: 8, clover: 12 }
  },
  {
    id: 'emerald-mine',
    name: 'Emerald Mine',
    accent: '#57d49b',
    volatility: 'medium',
    description: 'Mine-themed reels with clovers and diamonds leading the way.',
    strip: ['clover', 'diamond', 'bar', 'bell', 'clover', 'lemon', 'diamond', 'star', 'clover', 'cherry', 'diamond', 'bar'],
    payouts: { clover: 5, diamond: 12, star: 8, bar: 6 }
  },
  {
    id: 'lucky-cat',
    name: 'Lucky Cat',
    accent: '#ffd166',
    volatility: 'low',
    description: 'Balanced reels tuned for steady line hits.',
    strip: ['bell', 'cherry', 'clover', 'bell', 'lemon', 'star', 'bell', 'diamond', 'clover', 'bar', 'bell', 'lemon'],
    payouts: { bell: 4, clover: 5, diamond: 10, star: 7, bar: 8 }
  },
  {
    id: 'cyber-spin',
    name: 'Cyber Spin',
    accent: '#61dafb',
    volatility: 'medium',
    description: 'Fast digital reels with dense stars and diamonds.',
    strip: ['star', 'diamond', 'bar', 'seven', 'star', 'lemon', 'diamond', 'bar', 'star', 'clover', 'diamond', 'cherry'],
    payouts: { star: 6, diamond: 9, seven: 16, bar: 7, clover: 10 }
  },
  {
    id: 'royal-heist',
    name: 'Royal Heist',
    accent: '#b392f0',
    volatility: 'high',
    description: 'Riskier strip with larger top-end diamond and seven payouts.',
    strip: ['diamond', 'bar', 'seven', 'diamond', 'star', 'bar', 'seven', 'diamond', 'clover', 'bar', 'diamond', 'lemon'],
    payouts: { diamond: 14, seven: 20, bar: 8, star: 6, clover: 9 }
  },
  {
    id: 'candy-cloud',
    name: 'Candy Cloud',
    accent: '#ff9ecb',
    volatility: 'low',
    description: 'Soft variance machine with many cherries, lemons, and bells.',
    strip: ['cherry', 'bell', 'lemon', 'cherry', 'bell', 'star', 'lemon', 'cherry', 'bell', 'clover', 'lemon', 'diamond'],
    payouts: { cherry: 2, bell: 4, lemon: 3, star: 6, clover: 7, diamond: 9 }
  },
  {
    id: 'volcano-gold',
    name: 'Volcano Gold',
    accent: '#ff7b39',
    volatility: 'high',
    description: 'Explosive reel weighting with bars and diamonds stacked for bigger swings.',
    strip: ['bar', 'diamond', 'bar', 'seven', 'diamond', 'star', 'bar', 'diamond', 'clover', 'bar', 'seven', 'diamond'],
    payouts: { bar: 7, diamond: 15, seven: 22, star: 8, clover: 10 }
  }
];

const MACHINE_MAP = new Map(MACHINES.map((machine) => [machine.id, machine]));
const PAYLINES = [0, 1, 2] as const;

const getMachine = (machineId: string): SlotMachineConfig => {
  const machine = MACHINE_MAP.get(machineId);
  if (!machine) {
    throw new HttpError(400, `Unknown slot machine: ${machineId}`);
  }
  return machine;
};

const createInitialGrid = (): SlotSymbol[][] => [
  ['cherry', 'lemon', 'bell'],
  ['bar', 'star', 'diamond'],
  ['clover', 'seven', 'cherry']
];

const cloneState = (state: SlotsState): SlotsState => ({
  ...state,
  visibleGrid: state.visibleGrid.map((row) => [...row]),
  history: [...state.history],
  resolution: state.resolution ? { ...state.resolution } : null
});

const evaluateSpin = (grid: SlotSymbol[][], machine: SlotMachineConfig) => {
  let bestMultiplier = 0;
  let result = 'LOSS';
  const winLines: number[] = [];

  for (const line of PAYLINES) {
    const row = grid[line];
    if (row[0] === row[1] && row[1] === row[2]) {
      const payout = machine.payouts[row[0]] || 0;
      if (payout > 0) {
        winLines.push(line);
        if (payout > bestMultiplier) {
          bestMultiplier = payout;
          result = payout >= 15 ? 'JACKPOT' : payout >= 8 ? 'BIG_WIN' : 'WIN';
        }
      }
    }
  }

  return {
    winLines,
    multiplier: bestMultiplier,
    result
  };
};

const spinGrid = (machine: SlotMachineConfig): SlotSymbol[][] => {
  const reels = Array.from({ length: 3 }, () => {
    const stop = randomInt(0, machine.strip.length);
    return [
      machine.strip[stop % machine.strip.length],
      machine.strip[(stop + 1) % machine.strip.length],
      machine.strip[(stop + 2) % machine.strip.length]
    ];
  });

  return [
    [reels[0][0], reels[1][0], reels[2][0]],
    [reels[0][1], reels[1][1], reels[2][1]],
    [reels[0][2], reels[1][2], reels[2][2]]
  ];
};

export class SlotsEngine implements GameEngine<SlotsState> {
  readonly gameType = GameType.SLOTS;

  createInitialState(): SlotsState {
    return {
      phase: 'ready',
      selectedMachineId: MACHINES[0].id,
      visibleGrid: createInitialGrid(),
      winLines: [],
      payoutMultiplier: 0,
      history: [],
      message: 'Pick one of eight slot machines and spin.',
      resolution: null
    };
  }

  handleBet(context: EngineContext<SlotsState>, request: BetRequest) {
    const machineId = String(request.payload?.machineId || context.state.selectedMachineId || MACHINES[0].id);
    const machine = getMachine(machineId);
    const grid = spinGrid(machine);
    const outcome = evaluateSpin(grid, machine);
    const balanceChange = outcome.multiplier > 0 ? request.amount * outcome.multiplier : -request.amount;
    const state: SlotsState = {
      phase: 'resolved',
      selectedMachineId: machine.id,
      visibleGrid: grid,
      winLines: outcome.winLines,
      payoutMultiplier: outcome.multiplier,
      history: [
        {
          machineId: machine.id,
          result: outcome.result,
          payoutMultiplier: outcome.multiplier
        },
        ...context.state.history
      ].slice(0, 8),
      message:
        outcome.multiplier > 0
          ? `${machine.name} paid x${outcome.multiplier}.`
          : `${machine.name} missed this spin. Try again.`,
      resolution: {
        result: outcome.result,
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

  handleAction(context: EngineContext<SlotsState>, request: ActionRequest) {
    if (request.action !== 'select-machine') {
      throw new HttpError(400, `Unsupported slots action: ${request.action}`);
    }

    const machineId = String(request.payload?.machineId || '');
    const machine = getMachine(machineId);
    const state = cloneState(context.state);
    state.selectedMachineId = machine.id;
    state.phase = 'ready';
    state.winLines = [];
    state.payoutMultiplier = 0;
    state.message = `${machine.name} selected. Place a stake and spin.`;
    state.resolution = null;

    return {
      state,
      currentBet: 0,
      status: GameSessionStatus.IDLE
    };
  }

  calculateResult(state: SlotsState): GameResolution | null {
    return state.resolution || null;
  }

  serializeState(state: SlotsState): Record<string, unknown> {
    return {
      phase: state.phase,
      selectedMachineId: state.selectedMachineId,
      visibleGrid: state.visibleGrid,
      winLines: state.winLines,
      payoutMultiplier: state.payoutMultiplier,
      history: state.history,
      message: state.message,
      machines: MACHINES.map((machine) => ({
        id: machine.id,
        name: machine.name,
        accent: machine.accent,
        volatility: machine.volatility,
        description: machine.description,
        topMultiplier: Math.max(...Object.values(machine.payouts))
      }))
    };
  }
}
