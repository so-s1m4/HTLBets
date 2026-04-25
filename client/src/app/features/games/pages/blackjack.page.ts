import { Component, DestroyRef, computed, inject, signal } from '@angular/core';

import { GameSocketService } from '../../../core/services/game-socket.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameShellComponent } from '../components/game-shell.component';
import { BlackjackHandComponent } from '../blackjack/blackjack-hand.component';

interface BlackjackViewState {
  phase: 'ready' | 'player-turn' | 'dealer-turn' | 'resolved';
  playerHand: Array<Record<string, string | boolean>>;
  dealerHand: Array<Record<string, string | boolean>>;
  playerScore: number;
  dealerScore: number;
  doubledDown: boolean;
  canDouble: boolean;
  message: string;
}

@Component({
  selector: 'app-blackjack-page',
  standalone: true,
  imports: [
    AppButtonComponent,
    AppCardComponent,
    AppInputComponent,
    CreditsPipe,
    GameShellComponent,
    BlackjackHandComponent
  ],
  template: `
    <app-game-shell
      title="Blackjack"
      subtitle="A polished felt table with animated dealing and clear hit, stand, and double controls."
      [connectionState]="socket.connectionState()"
      [currentBet]="currentBet()"
      [error]="socket.lastError() || ''"
    >
      <app-card table>
        <div class="blackjack-table">
          <div class="blackjack-table__surface"></div>

          <div class="page-stack blackjack-table__content">
            <app-blackjack-hand
              label="Dealer"
              [cards]="viewState()?.dealerHand || []"
              [score]="viewState()?.dealerScore || 0"
            />

            <app-blackjack-hand
              label="Player"
              [cards]="viewState()?.playerHand || []"
              [score]="viewState()?.playerScore || 0"
            />

            <app-card tone="muted">
              <div class="page-stack">
                <div class="utility-row">
                  <span class="pill">Table note</span>
                  <span class="pill">{{ isRoundActive() ? 'Player turn' : 'Ready' }}</span>
                </div>
                <p class="status-copy">{{ viewState()?.message || 'Place a bet to begin.' }}</p>
              </div>
            </app-card>
          </div>
        </div>
      </app-card>

      <app-card sidebar>
        <div class="page-stack">
          <div class="glass-stat-grid">
            <div class="glass-stat">
              <span class="glass-stat__label">Phase</span>
              <strong class="glass-stat__value">{{ viewState()?.phase || 'ready' }}</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Table</span>
              <strong class="glass-stat__value">Single player</strong>
            </div>
          </div>

          <app-input
            label="Bet amount"
            inputMode="numeric"
            [value]="betAmount()"
            (valueChange)="betAmount.set($event.replace(/\\D/g, ''))"
          />

          @if (isRoundActive()) {
            <div class="page-stack">
              <app-button block (click)="action('hit')">Hit</app-button>
              <app-button variant="secondary" block (click)="action('stand')">Stand</app-button>
              <app-button
                variant="ghost"
                block
                [disabled]="!viewState()?.canDouble"
                (click)="action('double')"
              >
                Double
              </app-button>
            </div>
          } @else {
            <app-button block (click)="deal()">Deal cards</app-button>
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
  `
  ,
  styles: [`
    .blackjack-table {
      position: relative;
      min-height: 34rem;
      border-radius: var(--radius-xl);
      overflow: hidden;
    }

    .blackjack-table__surface {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at center, rgba(125, 227, 255, 0.08), transparent 28%),
        radial-gradient(circle at center, rgba(93, 168, 255, 0.08), transparent 54%),
        linear-gradient(180deg, rgba(14, 56, 47, 0.96), rgba(6, 26, 29, 0.98));
      border-radius: inherit;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        inset 0 -30px 50px rgba(0, 0, 0, 0.28);
    }

    .blackjack-table__surface::before {
      content: '';
      position: absolute;
      inset: 12% 10%;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.07);
      box-shadow: 0 0 42px rgba(93, 168, 255, 0.06);
    }

    .blackjack-table__content {
      position: relative;
      z-index: 1;
    }
  `]
})
export class BlackjackPageComponent {
  readonly socket = inject(GameSocketService);

  private readonly destroyRef = inject(DestroyRef);

  readonly betAmount = signal('50');
  readonly state = computed(() => this.socket.currentState());
  readonly viewState = computed(() => (this.state()?.state as unknown as BlackjackViewState | null) || null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly isRoundActive = computed(() => this.viewState()?.phase === 'player-turn');

  constructor() {
    this.socket.reset();
    this.socket.joinGame('blackjack');
    this.destroyRef.onDestroy(() => {
      this.socket.leaveGame('blackjack', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });
  }

  deal(): void {
    const amount = Number(this.betAmount());

    if (!amount) {
      return;
    }

    this.socket.placeBet('blackjack', amount);
  }

  action(action: 'hit' | 'stand' | 'double'): void {
    this.socket.sendAction('blackjack', action);
  }
}
