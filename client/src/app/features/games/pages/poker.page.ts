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
  template: `
    <app-game-shell
      title="Poker"
      subtitle="A dark premium poker table with staged actions, active zones, and expandable shared room state."
      [connectionState]="socket.connectionState()"
      [currentBet]="currentBet()"
      [error]="socket.lastError() || ''"
    >
      <app-card table>
        <div class="page-stack">
          <app-poker-table
            [phase]="viewState()?.phase || 'waiting'"
            [pot]="viewState()?.pot || 0"
            [currentBet]="viewState()?.currentBet || 0"
            [actingUserId]="viewState()?.actingUserId || null"
            [seats]="viewState()?.players || []"
            [communityCards]="viewState()?.communityCards || []"
            [winners]="viewState()?.winners || null"
          />

          <app-card tone="muted">
            <div class="page-stack">
              <div class="utility-row">
                <span class="pill">Table stage</span>
                <span class="pill">{{ viewState()?.phase || 'ready' }}</span>
                <span class="pill">{{ timerLabel() }}</span>
              </div>
              <p class="status-copy">{{ viewState()?.notes || 'Place a bet to start the demo hand.' }}</p>
            </div>
          </app-card>
        </div>
      </app-card>

      <app-card sidebar>
        <div class="page-stack">
          <div class="glass-stat-grid">
            <div class="glass-stat">
              <span class="glass-stat__label">Room</span>
              <strong class="glass-stat__value">Main online table</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Mode</span>
              <strong class="glass-stat__value">{{ viewState()?.phase || 'ready' }}</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Players</span>
              <strong class="glass-stat__value">{{ viewState()?.players?.length || 0 }}/6</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Pot</span>
              <strong class="glass-stat__value">{{ viewState()?.pot || 0 }} cr</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Buy-in now</span>
              <strong class="glass-stat__value">{{ viewState()?.joinMinimum || 0 }} cr</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Street bet</span>
              <strong class="glass-stat__value">{{ viewState()?.currentBet || 0 }} cr</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">To act</span>
              <strong class="glass-stat__value">{{ actingLabel() }}</strong>
            </div>
          </div>

          <app-input
            label="Ante amount"
            inputMode="numeric"
            [value]="betAmount()"
            (valueChange)="betAmount.set($event.replace(/\\D/g, ''))"
          />

          @if (viewState()?.phase === 'waiting') {
            <app-button block (click)="joinHand()">{{ joinedThisHand() ? 'Joined next hand' : 'Join next hand' }}</app-button>
          } @else {
            <div class="page-stack">
              @if (can('check')) {
                <app-button variant="secondary" block (click)="action('check')">Check</app-button>
              }

              @if (can('call')) {
                <app-button variant="secondary" block (click)="action('call')">Call {{ callAmount() }} cr</app-button>
              }

              @if (can('raise')) {
                <app-input
                  label="Raise to"
                  inputMode="numeric"
                  [value]="raiseAmount()"
                  (valueChange)="raiseAmount.set($event.replace(/\\D/g, ''))"
                />
                <app-button block (click)="raise()">Raise to {{ raiseTarget() || viewState()?.minRaiseTo || 0 }} cr</app-button>
              }

              @if (can('all-in')) {
                <app-button variant="secondary" block (click)="action('all-in')">All-in {{ selfSeat()?.stackRemaining || 0 }} cr</app-button>
              }

              @if (can('fold')) {
                <app-button variant="ghost" block (click)="action('fold')">Fold hand</app-button>
              }
            </div>
          }

          @if (socket.currentState()?.outcome; as result) {
            <div class="page-stack">
              <span class="pill">{{ result.result }}</span>
              <p [class]="result.balanceChange >= 0 ? 'text-success' : 'text-danger'">
                {{ result.balanceChange | credits }}
              </p>
            </div>
          }
        </div>
      </app-card>
    </app-game-shell>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
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
    return actor?.playerLabel || (state?.phase === 'waiting' ? 'Join window' : 'Showdown');
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
