import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';

import type { MinerCellView, MinerViewState } from '../../../core/models/game.model';
import { GameSocketService } from '../../../core/services/game-socket.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameShellComponent } from '../components/game-shell.component';

interface MinerCellUi {
  index: number;
  view: MinerCellView;
  tone: 'hidden' | 'safe' | 'mine';
}

@Component({
  selector: 'app-miner-page',
  standalone: true,
  imports: [AppButtonComponent, AppCardComponent, AppInputComponent, CreditsPipe, GameShellComponent],
  templateUrl: './miner.page.html',
  styleUrl: './miner.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MinerPageComponent {
  readonly socket = inject(GameSocketService);

  private readonly destroyRef = inject(DestroyRef);

  readonly betAmount = signal('50');
  readonly mineCount = signal('3');
  readonly isFullscreen = signal(false);
  readonly state = computed(() => this.socket.currentState());
  readonly viewState = computed(() => (this.state()?.state as unknown as MinerViewState | null) || null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly outcome = computed(() => this.state()?.outcome || null);
  readonly isRoundActive = computed(() => this.viewState()?.phase === 'playing');
  readonly resultBanner = computed(() => {
    const outcome = this.outcome();
    if (!outcome) {
      return null;
    }

    return {
      tone: outcome.balanceChange < 0 ? 'loss' : outcome.balanceChange > 0 ? 'win' : 'push',
      title: outcome.balanceChange < 0 ? 'Mine hit' : outcome.result === 'CLEARED' ? 'Board cleared' : 'Cash out',
      amount: outcome.balanceChange
    };
  });
  readonly cellViews = computed<MinerCellUi[]>(() => {
    const state = this.viewState();
    const cells = state?.cells || Array.from({ length: 25 }, () => 'hidden' as const);
    return cells.map((view, index) => ({
      index,
      view,
      tone: view === 'hidden' ? 'hidden' : view === 'mine' ? 'mine' : 'safe'
    }));
  });
  readonly safeRemaining = computed(() => {
    const state = this.viewState();
    if (!state) {
      return 25 - Number(this.mineCount() || 3);
    }
    return state.gridSize - state.mineCount - state.revealedSafeCount;
  });

  constructor() {
    this.socket.reset();
    this.socket.joinGame('miner');

    this.destroyRef.onDestroy(() => {
      this.socket.leaveGame('miner', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });
  }

  startRound(): void {
    const amount = Number(this.betAmount());
    const mineCount = Number(this.mineCount());

    if (!amount || !mineCount) {
      return;
    }

    this.socket.placeBet('miner', amount, { mineCount });
  }

  setFullscreen(value: boolean): void {
    this.isFullscreen.set(value);
  }

  revealCell(index: number): void {
    if (!this.isRoundActive()) {
      return;
    }

    this.socket.sendAction('miner', 'reveal-cell', { index });
  }

  cashOut(): void {
    if (!this.isRoundActive()) {
      return;
    }

    this.socket.sendAction('miner', 'cash-out');
  }
}
