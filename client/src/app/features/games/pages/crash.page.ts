import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';

import type { CrashPlayerView, CrashViewState } from '../../../core/models/game.model';
import { GameSocketService } from '../../../core/services/game-socket.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameShellComponent } from '../components/game-shell.component';

const CRASH_GROWTH_RATE = 0.00008;
const CRASH_CHART_CAP = 20;
const CRASH_AXIS_MARKERS = [1, 2, 3, 5, 10, 20] as const;

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
  readonly isBetting = computed(() => this.viewState()?.phase === 'betting');
  readonly isRoundActive = computed(() => this.viewState()?.phase === 'live');
  readonly bettingClosesAtMs = computed(() => {
    const bettingClosesAt = this.viewState()?.bettingClosesAt;
    if (!bettingClosesAt) {
      return 0;
    }
    const parsed = Date.parse(bettingClosesAt);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  readonly startTimeMs = computed(() => {
    const startTime = this.viewState()?.startTime;
    if (!startTime) {
      return 0;
    }
    const parsed = Date.parse(startTime);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  readonly bettingCountdownMs = computed(() => (this.isBetting() ? Math.max(0, this.bettingClosesAtMs() - this.clock()) : 0));
  readonly elapsedMs = computed(() => (this.isRoundActive() ? Math.max(0, this.clock() - this.startTimeMs()) : 0));
  readonly hasJoinedRound = computed(() => this.currentBet() > 0);
  readonly canPlaceBet = computed(() => this.isBetting() && !this.hasJoinedRound());
  readonly canCashOut = computed(() => this.isRoundActive() && this.hasJoinedRound());
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
  readonly flightProgress = computed(() =>
    Math.min(0.985, Math.log(Math.max(1, this.liveMultiplier())) / Math.log(CRASH_CHART_CAP))
  );
  readonly flightElevation = computed(() => Math.min(0.86, 0.1 + Math.pow(this.flightProgress(), 0.58) * 0.78));
  readonly phaseLabel = computed(() => {
    const state = this.viewState();
    if (!state) {
      return 'Awaiting launch';
    }
    if (state.phase === 'betting') {
      return this.hasJoinedRound() ? 'Locked for launch' : 'Betting open';
    }
    if (state.phase === 'live') {
      return this.hasJoinedRound() ? 'You are live' : 'Round live';
    }
    if (this.outcome()?.result === 'BUST') {
      return 'Crashed out';
    }
    return state.phase === 'resolved' ? 'Cashed out' : 'Awaiting launch';
  });
  readonly chartMarkers = computed(() =>
    CRASH_AXIS_MARKERS.map((value) => ({
      value,
      offset: value === 1 ? 6 : Math.min(94, (Math.log(value) / Math.log(CRASH_CHART_CAP)) * 100)
    }))
  );
  private buildCurvePoints(progress: number): string[] {
    const steps = 28;
    const points: string[] = [];

    for (let index = 0; index <= steps; index += 1) {
      const t = (progress * index) / steps;
      const x = 6 + t * 88;
      const y = 92 - Math.pow(Math.max(0, t), 0.58) * 74;
      points.push(`${x} ${y}`);
    }

    return points;
  }
  readonly fullCurvePath = computed(() => `M ${this.buildCurvePoints(1).join(' L ')}`);
  readonly curvePath = computed(() => {
    const progress = Math.max(0.03, this.flightProgress());
    return `M ${this.buildCurvePoints(progress).join(' L ')}`;
  });
  readonly areaPath = computed(() => {
    const progress = Math.max(0.03, this.flightProgress());
    const points = this.buildCurvePoints(progress).join(' L ');
    const endX = 6 + progress * 88;
    return `M 6 92 L ${points} L ${endX} 92 Z`;
  });
  readonly livePoint = computed(() => ({
    x: `${6 + this.flightProgress() * 88}%`,
    y: `${92 - this.flightElevation() * 74}%`
  }));
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
  readonly players = computed(() => this.viewState()?.players || []);
  readonly playerColumns = computed(() => {
    const players = [...this.players()];
    const left: CrashPlayerView[] = [];
    const right: CrashPlayerView[] = [];

    players.forEach((player, index) => {
      if (index % 2 === 0) {
        left.push(player);
      } else {
        right.push(player);
      }
    });

    return { left, right };
  });
  readonly recentBursts = computed(() =>
    this.history().slice(0, 8).map((entry, index) => ({
      ...entry,
      index,
      tone: entry.multiplier >= 8 ? 'jackpot' : entry.multiplier >= 3 ? 'win' : entry.multiplier < 1.6 ? 'loss' : 'cool'
    }))
  );
  readonly visibleMultiplierLabel = computed(() => `x${this.liveMultiplier().toFixed(2)}`);
  readonly lastSettledLabel = computed(() => `x${(this.viewState()?.lastSettledMultiplier || 1).toFixed(2)}`);
  readonly lastCrashLabel = computed(() => `x${(this.viewState()?.lastCrashMultiplier || 1).toFixed(2)}`);
  readonly trackedRoundsLabel = computed(() => `${this.history().length}`);
  readonly totalPot = computed(() => this.viewState()?.totalPot || 0);
  readonly launchActionLabel = computed(() =>
    this.canCashOut()
      ? `Cash out at ${this.visibleMultiplierLabel()}`
      : this.canPlaceBet()
        ? 'Join next round'
        : this.isBetting()
          ? 'Locked for launch'
          : 'Awaiting reset'
  );
  readonly launchCountdownLabel = computed(() => {
    if (!this.isBetting()) {
      return '';
    }

    const seconds = (this.bettingCountdownMs() / 1000).toFixed(1);
    return this.hasJoinedRound() ? `Launch in ${seconds}s` : `Open for ${seconds}s`;
  });
  readonly participantSummary = computed(() => {
    const state = this.viewState();
    if (!state) {
      return 'No players locked in yet.';
    }

    const total = state.players.length;

    if (state.phase === 'betting') {
      return total === 0 ? 'No players locked in yet.' : `${total} players queued for launch.`;
    }

    if (state.phase === 'live') {
      return `${state.liveCount} live, ${state.cashedOutCount} cashed out, ${total} total in round.`;
    }

    return `${state.bustedCount} busted, ${state.cashedOutCount} cashed out, ${total} players were in the round.`;
  });
  readonly statusTone = computed(() => {
    if (this.outcome()?.result === 'BUST') {
      return 'loss';
    }
    if (this.isBetting() && this.hasJoinedRound()) {
      return 'win';
    }
    if (this.isRoundActive()) {
      return 'live';
    }
    if (this.outcome() && (this.outcome()?.balanceChange || 0) > 0) {
      return 'win';
    }
    return 'idle';
  });

  constructor() {
    this.socket.reset();
    this.socket.joinGame('crash');

    effect(() => {
      const state = this.viewState();

      this.clearLiveTimers();

      if (!state) {
        return;
      }

      if ((state.phase === 'live' && state.startTime) || (state.phase === 'betting' && state.bettingClosesAt)) {
        this.clock.set(Date.now());
        this.tickTimer = window.setInterval(() => {
          this.clock.set(Date.now());
        }, this.tickRateMs);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.clearLiveTimers();
      this.socket.leaveGame('crash', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });
  }

  startRound(): void {
    const amount = Number(this.betAmount());
    if (!amount || !this.canPlaceBet()) {
      return;
    }

    this.socket.placeBet('crash', amount);
  }

  cashOut(): void {
    if (!this.canCashOut()) {
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
