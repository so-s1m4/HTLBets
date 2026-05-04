import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';

import { GameSocketService } from '../../../core/services/game-socket.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameShellComponent } from '../components/game-shell.component';
import { PokerTableComponent } from '../poker/poker-table.component';

interface PokerViewState {
  phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'resolved';
  pot: number;
  joinMinimum: number;
  currentBet: number;
  actingUserId?: string;
  minRaiseTo?: number;
  allowedActions?: Array<'check' | 'call' | 'raise' | 'all-in' | 'fold'>;
  players: Array<{
    userId: string;
    playerLabel: string;
    ante: number;
    stackRemaining: number;
    totalContribution: number;
    streetContribution: number;
    status: 'waiting' | 'active' | 'folded' | 'all-in';
    seatIndex: number;
    isSelf: boolean;
    cards: Array<Record<string, string | boolean>>;
    evaluation?: { label: string } | null;
    lastAction?: string;
  }>;
  communityCards: Array<Record<string, string | boolean>>;
  winners?: Array<{ userId: string; playerLabel: string; hand: string }>;
  dealStartsAt?: string;
  phaseEndsAt?: string;
  notes: string;
}

@Component({
  selector: 'app-poker-page',
  standalone: true,
  imports: [
    AppButtonComponent,
    AppCardComponent,
    AppInputComponent,
    CreditsPipe,
    GameShellComponent,
    PokerTableComponent
  ],
  templateUrl: './poker.page.html',
  styleUrl: './poker.page.scss'
})
export class PokerPageComponent {
  readonly socket = inject(GameSocketService);

  private readonly destroyRef = inject(DestroyRef);

  readonly betAmount = signal('75');
  readonly raiseAmount = signal('');
  readonly countdownMs = signal(0);
  readonly state = computed(() => this.socket.currentState());
  readonly viewState = computed(() => (this.state()?.state as unknown as PokerViewState | null) || null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly selfSeat = computed(() => this.viewState()?.players?.find((player) => player.isSelf) || null);
  readonly joinedThisHand = computed(() => Boolean(this.selfSeat()));
  readonly actingLabel = computed(() => {
    const state = this.viewState();
    const actor = state?.players?.find((player) => player.userId === state?.actingUserId);
    return actor?.playerLabel || (state?.phase === 'waiting' ? 'Join table' : 'Showdown');
  });
  readonly raiseTarget = computed(() => {
    const target = Number(this.raiseAmount());
    return Number.isFinite(target) && target > 0 ? target : 0;
  });
  readonly callAmount = computed(() => {
    const seat = this.selfSeat();
    const state = this.viewState();
    if (!seat || !state) {
      return 0;
    }

    return Math.max(0, state.currentBet - seat.streetContribution);
  });
  readonly timerLabel = computed(() => {
    const state = this.viewState();

    if (!state) {
      return 'Waiting';
    }

    const ms = this.countdownMs();
    if (ms <= 0) {
      return state.phase === 'waiting' ? 'Open table' : 'Live';
    }

    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  });

  constructor() {
    this.socket.reset();
    this.socket.joinGame('poker');
    this.destroyRef.onDestroy(() => {
      this.socket.leaveGame('poker', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });

    const interval = window.setInterval(() => {
      const state = this.viewState();
      const target = state?.phase === 'waiting' ? state.dealStartsAt : state?.phaseEndsAt;

      if (!target) {
        this.countdownMs.set(0);
        return;
      }

      this.countdownMs.set(Math.max(0, new Date(target).getTime() - Date.now()));
    }, 1000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(interval);
    });

    effect(() => {
      const state = this.viewState();

      if (!state || state.phase !== 'waiting' || this.joinedThisHand()) {
        return;
      }

      this.betAmount.set(String(state.joinMinimum || 100));
    });
  }

  joinHand(): void {
    if (this.joinedThisHand()) {
      return;
    }

    const amount = Number(this.betAmount());

    if (!amount) {
      return;
    }

    this.socket.placeBet('poker', amount);
  }

  can(action: 'check' | 'call' | 'raise' | 'all-in' | 'fold'): boolean {
    return Boolean(this.viewState()?.allowedActions?.includes(action));
  }

  raise(): void {
    const amount = this.raiseTarget();

    if (!amount) {
      return;
    }

    this.socket.sendAction('poker', 'raise', { amount });
  }

  action(action: 'check' | 'call' | 'all-in' | 'fold'): void {
    this.socket.sendAction('poker', action);
  }
}
