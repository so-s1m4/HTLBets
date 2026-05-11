import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';

import type { CrashViewState } from '../../../core/models/game.model';
import { GameSocketService } from '../../../core/services/game-socket.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameShellComponent } from '../components/game-shell.component';

const CRASH_GROWTH_RATE = 0.00008;

const computeLiveMultiplier = (elapsedMs: number): number =>
  Number(Math.max(1, Math.exp(CRASH_GROWTH_RATE * Math.max(0, elapsedMs))).toFixed(2));

@Component({
  selector: 'app-crash-page',
  standalone: true,
  imports: [AppButtonComponent, AppCardComponent, AppInputComponent, CreditsPipe, GameShellComponent],
  templateUrl: './crash.page.html',
  styleUrl: './crash.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CrashPageComponent {
  readonly socket = inject(GameSocketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tickRateMs = 50;
  private tickTimer: number | null = null;

  readonly betAmount = signal('50');
  readonly clock = signal(Date.now());
  readonly state = computed(() => this.socket.currentState());
  readonly viewState = computed(() => (this.state()?.state as unknown as CrashViewState | null) || null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly outcome = computed(() => this.state()?.outcome || null);
  readonly isRoundActive = computed(() => this.viewState()?.phase === 'live');
  readonly startTimeMs = computed(() => {
    const startTime = this.viewState()?.startTime;
    if (!startTime) {
      return 0;
    }
    const parsed = Date.parse(startTime);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  readonly elapsedMs = computed(() => (this.isRoundActive() ? Math.max(0, this.clock() - this.startTimeMs()) : 0));
  readonly liveMultiplier = computed(() => {
    const state = this.viewState();
    if (!state) {
      return 1;
    }

    if (state.phase === 'live') {
      return computeLiveMultiplier(this.elapsedMs());
    }

    return state.lastSettledMultiplier || 1;
  });
  readonly crashProgress = computed(() => Math.min(1, Math.log(this.liveMultiplier()) / Math.log(12)));
  readonly phaseLabel = computed(() => {
    const state = this.viewState();
    if (!state) {
      return 'Awaiting launch';
    }
    if (state.phase === 'live') {
      return 'Round live';
    }
    if (this.outcome()?.result === 'BUST') {
      return 'Crashed out';
    }
    return state.phase === 'resolved' ? 'Cashed out' : 'Awaiting launch';
  });
  readonly bars = computed(() =>
    Array.from({ length: 12 }, (_, index) => {
      const ratio = (index + 1) / 12;
      return {
        index,
        height: 18 + ratio * 72,
        active: this.crashProgress() >= ratio * 0.82
      };
    })
  );
  readonly resultBanner = computed(() => {
    const outcome = this.outcome();
    if (!outcome) {
      return null;
    }

    return {
      tone: outcome.balanceChange < 0 ? 'loss' : outcome.balanceChange > 0 ? 'win' : 'push',
      title: outcome.result === 'BUST' ? 'Round crashed' : 'Cash out locked',
      amount: outcome.balanceChange
    };
  });
  readonly history = computed(() => this.viewState()?.history || []);

  constructor() {
    this.socket.reset();
    this.socket.joinGame('crash');

    effect(() => {
      const state = this.viewState();

      this.clearLiveTimers();

      if (!state || state.phase !== 'live' || !state.startTime) {
        return;
      }

      this.clock.set(Date.now());
      this.tickTimer = window.setInterval(() => {
        this.clock.set(Date.now());
      }, this.tickRateMs);
    });

    this.destroyRef.onDestroy(() => {
      this.clearLiveTimers();
      this.socket.leaveGame('crash', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });
  }

  startRound(): void {
    const amount = Number(this.betAmount());
    if (!amount || this.isRoundActive()) {
      return;
    }

    this.socket.placeBet('crash', amount);
  }

  cashOut(): void {
    if (!this.isRoundActive()) {
      return;
    }

    this.socket.sendAction('crash', 'cash-out');
  }

  private clearLiveTimers(): void {
    if (this.tickTimer !== null) {
      window.clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}
