import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';

import type { SlotsMachineSummary, SlotsViewState } from '../../../core/models/game.model';
import { GameSocketService } from '../../../core/services/game-socket.service';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameShellComponent } from '../components/game-shell.component';

interface SlotCellView {
  symbol: string;
  key: string;
}

const SYMBOL_LABELS: Record<string, string> = {
  cherry: '🍒',
  lemon: '🍋',
  bell: '🔔',
  bar: 'BAR',
  seven: '7',
  diamond: '♦',
  star: '★',
  clover: '☘'
};

@Component({
  selector: 'app-slots-page',
  standalone: true,
  imports: [AppCardComponent, AppInputComponent, CreditsPipe, GameShellComponent],
  templateUrl: './slots.page.html',
  styleUrl: './slots.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SlotsPageComponent {
  readonly socket = inject(GameSocketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly spinDurationMs = 1650;
  private readonly spinStepMs = 90;
  private spinInterval: number | null = null;
  private spinRevealTimer: number | null = null;
  private lastResolvedSignature = '';
  private pendingFinalGrid: string[][] | null = null;
  private pendingOutcome: ReturnType<typeof this.outcome> | null = null;

  readonly betAmount = signal('50');
  readonly selectedMachineId = signal('classic-fruit');
  readonly isSpinning = signal(false);
  readonly revealedOutcome = signal<ReturnType<typeof this.outcome> | null>(null);
  readonly displayedGrid = signal<string[][]>([
    ['🍒', '🍋', '🔔'],
    ['BAR', '★', '♦'],
    ['☘', '7', '🍒']
  ]);
  readonly state = computed(() => this.socket.currentState());
  readonly viewState = computed(() => (this.state()?.state as unknown as SlotsViewState | null) || null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly outcome = computed(() => this.state()?.outcome || null);
  readonly machines = computed<SlotsMachineSummary[]>(() => this.viewState()?.machines || []);
  readonly selectedMachine = computed<SlotsMachineSummary | null>(() => {
    const machines = this.machines();
    const selectedMachineId = this.viewState()?.selectedMachineId || null;
    return machines.find((machine) => machine.id === selectedMachineId) || machines[0] || null;
  });
  readonly resultBanner = computed(() => {
    const outcome = this.revealedOutcome();
    if (!outcome) {
      return null;
    }

    return {
      tone: outcome.balanceChange < 0 ? 'loss' : outcome.balanceChange > 0 ? 'win' : 'push',
      title: outcome.result === 'JACKPOT' ? 'Jackpot' : outcome.result === 'BIG_WIN' ? 'Big win' : outcome.balanceChange > 0 ? 'Win' : 'Spin lost',
      amount: outcome.balanceChange
    };
  });
  readonly grid = computed<SlotCellView[][]>(() =>
    this.displayedGrid().map((row, rowIndex) =>
      row.map((symbol, columnIndex) => ({
        symbol: SYMBOL_LABELS[symbol] || symbol,
        key: `${rowIndex}:${columnIndex}:${symbol}`
      }))
    )
  );
  readonly history = computed(() => this.viewState()?.history || []);

  constructor() {
    this.socket.reset();
    this.socket.joinGame('slots');

    effect(() => {
      const view = this.viewState();
      const outcome = this.outcome();

      if (!view) {
        return;
      }

      const signature = JSON.stringify({
        grid: view.visibleGrid,
        result: outcome?.result || null,
        amount: outcome?.balanceChange || 0,
        history: view.history[0] || null
      });

      if (!this.lastResolvedSignature) {
        this.lastResolvedSignature = signature;
        this.displayedGrid.set(view.visibleGrid);
        this.revealedOutcome.set(outcome);
        this.selectedMachineId.set(view.selectedMachineId);
        return;
      }

      if (signature === this.lastResolvedSignature) {
        return;
      }

      this.lastResolvedSignature = signature;
      this.selectedMachineId.set(view.selectedMachineId);

      if (this.isSpinning()) {
        this.queueSpinResult(view.visibleGrid, outcome);
        return;
      }

      this.displayedGrid.set(view.visibleGrid);
      this.revealedOutcome.set(outcome);
    });

    this.destroyRef.onDestroy(() => {
      this.clearSpinTimers();
      this.socket.leaveGame('slots', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });
  }

  chooseMachine(machineId: string): void {
    this.selectedMachineId.set(machineId);
    this.socket.sendAction('slots', 'select-machine', { machineId });
  }

  spin(): void {
    const amount = Number(this.betAmount());
    const machineId = this.selectedMachineId();
    if (!amount || !machineId || this.isSpinning()) {
      return;
    }

    this.startSpinAnimation();
    this.socket.placeBet('slots', amount, { machineId });
  }

  private startSpinAnimation(): void {
    this.clearSpinTimers();
    this.isSpinning.set(true);
    this.revealedOutcome.set(null);
    this.pendingFinalGrid = null;
    this.pendingOutcome = null;

    this.spinInterval = window.setInterval(() => {
      this.displayedGrid.set(this.randomGrid());
    }, this.spinStepMs);

    this.spinRevealTimer = window.setTimeout(() => {
      this.stopSpinAnimation();
    }, this.spinDurationMs);
  }

  private queueSpinResult(grid: string[][], outcome: ReturnType<typeof this.outcome>): void {
    this.pendingFinalGrid = grid;
    this.pendingOutcome = outcome;
  }

  private stopSpinAnimation(): void {
    if (this.spinInterval !== null) {
      window.clearInterval(this.spinInterval);
      this.spinInterval = null;
    }

    if (this.pendingFinalGrid) {
      this.displayedGrid.set(this.pendingFinalGrid);
    }
    this.revealedOutcome.set(this.pendingOutcome);
    this.isSpinning.set(false);
    this.spinRevealTimer = null;
  }

  private clearSpinTimers(): void {
    if (this.spinInterval !== null) {
      window.clearInterval(this.spinInterval);
      this.spinInterval = null;
    }
    if (this.spinRevealTimer !== null) {
      window.clearTimeout(this.spinRevealTimer);
      this.spinRevealTimer = null;
    }
    this.pendingFinalGrid = null;
    this.pendingOutcome = null;
    this.isSpinning.set(false);
  }

  private randomGrid(): string[][] {
    const symbols = Object.keys(SYMBOL_LABELS);
    return Array.from({ length: 3 }, () =>
      Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)])
    );
  }
}
