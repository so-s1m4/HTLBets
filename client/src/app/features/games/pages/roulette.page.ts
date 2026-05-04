import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';

import { GameSocketService } from '../../../core/services/game-socket.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
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
  history: Array<{ number: number; color: string }>;
  bets: Array<{
    userId: string;
    playerLabel: string;
    amount: number;
    selection: { type: 'color' | 'number'; value: string | number };
    placedAt: string;
  }>;
  aggregates: Array<{
    selectionType: 'color' | 'number';
    value: string | number;
    totalAmount: number;
    playerCount: number;
  }>;
  lastSpin?: { number: number; color: string };
  lastRound?: {
    selection: { type: 'color' | 'number'; value: string | number };
    spin: { number: number; color: string };
    payoutMultiplier: number;
    won: boolean;
  };
}

@Component({
  selector: 'app-roulette-page',
  standalone: true,
  imports: [
    AppButtonComponent,
    AppCardComponent,
    AppInputComponent,
    CreditsPipe,
    GameShellComponent,
    RouletteBoardComponent,
    RouletteWheelComponent
  ],
  templateUrl: './roulette.page.html',
  styleUrl: './roulette.page.scss'
})
export class RoulettePageComponent {
  readonly socket = inject(GameSocketService);

  private readonly destroyRef = inject(DestroyRef);
  private lastSpinSignature = '';

  readonly betAmount = signal('25');
  readonly selectedChip = signal(25);
  readonly selectedType = signal<'color' | 'number'>('color');
  readonly selectedValue = signal<string | number>('red');
  readonly wheelRotation = signal(0);
  readonly ballRotation = signal(0);
  readonly isSpinning = signal(false);
  readonly countdownMs = signal(0);
  readonly chipValues = [10, 25, 100, 250];

  readonly state = computed(() => this.socket.currentState());
  readonly viewState = computed(() => (this.state()?.state as unknown as RouletteViewState | null) || null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly outcome = computed(() => this.state()?.outcome || null);
  readonly hasSidebarContent = computed(() => {
    const state = this.viewState();
    return Boolean(this.outcome() || state?.bets?.length || state?.history?.length);
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
      this.socket.leaveGame('roulette', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });

    effect((onCleanup) => {
      const round = this.viewState()?.lastRound;
      const phase = this.viewState()?.phase;

      this.isSpinning.set(phase === 'spinning');

      if (!round) {
        return;
      }

      const signature = `${round.spin.number}:${round.selection.type}:${round.selection.value}`;

      if (signature === this.lastSpinSignature) {
        return;
      }

      this.lastSpinSignature = signature;

      const step = 360 / 37;
      const wheelIndex = this.wheelOrder.indexOf(round.spin.number);
      const targetRotation = 360 - wheelIndex * step;
      const nextWheel = this.wheelRotation() + 1800 + targetRotation - (this.wheelRotation() % 360);
      const nextBall = this.ballRotation() + 2520 - (this.ballRotation() % 360);

      this.wheelRotation.set(nextWheel);
      this.ballRotation.set(nextBall);
      this.isSpinning.set(true);

      const timer = window.setTimeout(() => {
        this.isSpinning.set(false);
      }, 4500);

      onCleanup(() => window.clearTimeout(timer));
    });

    const countdownTimer = window.setInterval(() => {
      const closesAt = this.viewState()?.bettingClosesAt;

      if (!closesAt) {
        this.countdownMs.set(0);
        return;
      }

      this.countdownMs.set(new Date(closesAt).getTime() - Date.now());
    }, 250);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(countdownTimer);
    });
  }

  private readonly wheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

  selectColor(color: 'red' | 'black'): void {
    this.selectedType.set('color');
    this.selectedValue.set(color);
  }

  selectNumber(number: number): void {
    this.selectedType.set('number');
    this.selectedValue.set(number);
  }

  selectChip(chip: number): void {
    this.selectedChip.set(chip);
    this.betAmount.set(String(chip));
  }

  placeBet(): void {
    const amount = Number(this.betAmount());

    if (!amount) {
      return;
    }

    this.selectedChip.set(amount);
    this.socket.placeBet('roulette', amount, {
      selectionType: this.selectedType(),
      value: this.selectedValue()
    });
  }
}
