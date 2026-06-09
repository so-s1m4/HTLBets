import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';

import { GameSocketService } from '../../../core/services/game-socket.service';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameShellComponent } from '../components/game-shell.component';
import { RouletteBoardComponent } from '../roulette/roulette-board.component';
import { RouletteWheelComponent } from '../roulette/roulette-wheel.component';

interface RouletteViewState {
  phase: 'betting' | 'spinning';
  roundId: number;
  bettingClosesAt: string;
  history: Array<{ number: number | '00'; color: string }>;
  bets: Array<{
    userId: string;
    playerLabel: string;
    amount: number;
    selection: { type: 'color' | 'number' | 'parity' | 'dozen' | 'range' | 'column'; value: string | number };
    placedAt: string;
  }>;
  aggregates: Array<{
    selectionType: 'color' | 'number' | 'parity' | 'dozen' | 'range' | 'column';
    value: string | number;
    totalAmount: number;
    playerCount: number;
  }>;
  lastSpin?: { number: number | '00'; color: string };
  lastRound?: {
    selection: { type: 'color' | 'number' | 'parity' | 'dozen' | 'range' | 'column'; value: string | number };
    spin: { number: number | '00'; color: string };
    payoutMultiplier: number;
    won: boolean;
  };
}

@Component({
  selector: 'app-roulette-page',
  standalone: true,
  imports: [
    AppCardComponent,
    AppInputComponent,
    CreditsPipe,
    GameShellComponent,
    RouletteBoardComponent,
    RouletteWheelComponent
  ],
  templateUrl: './roulette.page.html',
  styleUrl: './roulette.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoulettePageComponent {
  readonly socket = inject(GameSocketService);

  private readonly destroyRef = inject(DestroyRef);
  private hasHydratedState = false;
  private lastSpinSignature = '';
  private readonly spinDurationMs = 5200;
  private readonly revealVisibleMs = 10_000;
  private pendingRevealSignature: string | null = null;
  private revealTimer: number | null = null;
  private hideTimer: number | null = null;

  readonly betAmount = signal('25');
  readonly selectedChip = signal(25);
  readonly selectedType = signal<'color' | 'number' | 'parity' | 'dozen' | 'range' | 'column'>('color');
  readonly selectedValue = signal<string | number>('red');
  readonly wheelRotation = signal(0);
  readonly ballRotation = signal(0);
  readonly isSpinning = signal(false);
  readonly isFullscreen = signal(false);
  readonly countdownMs = signal(0);
  readonly revealedRound = signal<RouletteViewState['lastRound'] | null>(null);
  readonly chipValues = [10, 25, 100, 250];
  readonly chipOptions = [
    { value: 100, label: '100', asset: '/casino/chips/chip_3_1.png' },
    { value: 500, label: '500', asset: '/casino/chips/chip_1_5.png' },
    { value: 1000, label: '1K', asset: '/casino/chips/chip_2_5.png' },
    { value: 10000, label: '10K', asset: '/casino/chips/chip_3_5.png' },
    { value: 50000, label: '50K', asset: '/casino/chips/chip_4_5.png' },
    { value: 100000, label: '100K', asset: '/casino/chips/chip_1_1.png' },
  ] as const;

  readonly state = computed(() => this.socket.currentState());
  readonly viewState = computed(() => (this.state()?.state as unknown as RouletteViewState | null) || null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly outcome = computed(() => this.state()?.outcome || null);
  readonly revealedOutcome = signal<ReturnType<typeof this.outcome> | null>(null);
  readonly resultBanner = computed(() => {
    const outcome = this.revealedOutcome();

    if (!outcome) {
      return null;
    }

    return {
      tone: outcome.balanceChange < 0 ? 'loss' : outcome.balanceChange > 0 ? 'win' : 'push',
      title: outcome.balanceChange < 0 ? 'Spin lost' : outcome.balanceChange > 0 ? 'Spin won' : 'Push',
      amount: outcome.balanceChange
    };
  });
  readonly hasSidebarContent = computed(() => {
    const state = this.viewState();
    return Boolean(this.revealedOutcome() || state?.bets?.length || state?.history?.length);
  });
  readonly countdownLabel = computed(() => {
    if (this.isSpinning()) {
      return 'Spinning';
    }

    const totalSeconds = Math.max(0, Math.ceil(this.countdownMs() / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  });

  constructor() {
    this.socket.reset();
    this.socket.joinGame('roulette');
    this.destroyRef.onDestroy(() => {
      if (this.revealTimer !== null) {
        window.clearTimeout(this.revealTimer);
      }
      if (this.hideTimer !== null) {
        window.clearTimeout(this.hideTimer);
      }
      this.socket.leaveGame('roulette', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });

    effect(() => {
      const state = this.viewState();
      const round = state?.lastRound;
      const phase = state?.phase;
      const outcome = this.outcome();
      const signature = round ? `${round.spin.number}:${round.selection.type}:${round.selection.value}` : '';

      this.isSpinning.set(phase === 'spinning');

      if (!this.hasHydratedState) {
        if (!state) {
          return;
        }

        this.hasHydratedState = true;
        this.lastSpinSignature = signature;

        if (phase === 'spinning') {
          this.revealedRound.set(null);
          this.revealedOutcome.set(null);
        } else {
          this.revealedRound.set(null);
          this.revealedOutcome.set(null);
        }

        return;
      }

      if (phase === 'spinning') {
        this.revealedRound.set(null);
        this.revealedOutcome.set(null);
        return;
      }

      if (!round) {
        if (this.pendingRevealSignature === null) {
          this.revealedRound.set(null);
          this.revealedOutcome.set(outcome ?? null);
        }
        return;
      }

      if (signature === this.lastSpinSignature) {
        if (this.pendingRevealSignature === null && this.revealedRound()) {
          this.revealedRound.set(round);
          this.revealedOutcome.set(outcome ?? null);
        }
        return;
      }

      this.lastSpinSignature = signature;
      this.pendingRevealSignature = signature;
      this.revealedRound.set(null);
      this.revealedOutcome.set(null);

      const step = 360 / this.wheelOrder.length;
      const wheelIndex = this.wheelOrder.indexOf(round.spin.number);
      const randomPocketOffset = Math.floor(Math.random() * this.wheelOrder.length) * step;
      const targetRotation = 360 - (wheelIndex * step + step / 2) + randomPocketOffset;
      const nextWheel = this.wheelRotation() + 1800 + targetRotation - (this.wheelRotation() % 360);
      const normalizedBall = ((this.ballRotation() % 360) + 360) % 360;
      const nextBall = this.ballRotation() - 3240 - normalizedBall + randomPocketOffset;

      this.wheelRotation.set(nextWheel);
      this.ballRotation.set(nextBall);
      this.isSpinning.set(true);

      if (this.revealTimer !== null) {
        window.clearTimeout(this.revealTimer);
      }
      if (this.hideTimer !== null) {
        window.clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }

      this.revealTimer = window.setTimeout(() => {
        this.isSpinning.set(false);
        this.pendingRevealSignature = null;
        this.revealedRound.set(round);
        this.revealedOutcome.set(this.outcome());
        this.hideTimer = window.setTimeout(() => {
          this.revealedRound.set(null);
          this.revealedOutcome.set(null);
          this.hideTimer = null;
        }, this.revealVisibleMs);
        this.revealTimer = null;
      }, this.spinDurationMs);
    });

    const updateCountdown = () => {
      const closesAt = this.viewState()?.bettingClosesAt;

      if (!closesAt) {
        this.countdownMs.set(0);
        return;
      }

      this.countdownMs.set(new Date(closesAt).getTime() - Date.now());
    };

    updateCountdown();
    const countdownTimer = window.setInterval(updateCountdown, 1000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(countdownTimer);
    });
  }

  private readonly wheelOrder: Array<number | '00'> = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];

  selectColor(color: 'red' | 'black'): void {
    this.selectedType.set('color');
    this.selectedValue.set(color);
  }

  selectSelection(selectionType: 'color' | 'number' | 'parity' | 'dozen' | 'range' | 'column', value: string | number): void {
    this.selectedType.set(selectionType);
    this.selectedValue.set(value);
  }

  selectChip(chip: number): void {
    this.selectedChip.set(chip);
    this.betAmount.set(String(chip));
  }

  setFullscreen(value: boolean): void {
    this.isFullscreen.set(value);
  }

  placeBet(selectionType = this.selectedType(), value = this.selectedValue()): void {
    const amount = Number(this.betAmount());

    if (!amount || this.isSpinning()) {
      return;
    }

    this.selectedChip.set(amount);
    this.selectedType.set(selectionType);
    this.selectedValue.set(value);
    this.socket.placeBet('roulette', amount, { selectionType, value });
  }

  placeSelection(selection: { selectionType: 'color' | 'number' | 'parity' | 'dozen' | 'range' | 'column'; value: string | number }): void {
    this.selectSelection(selection.selectionType, selection.value);
    this.placeBet(selection.selectionType, selection.value);
  }
}
