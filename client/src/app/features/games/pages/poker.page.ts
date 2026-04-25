import { Component, DestroyRef, computed, inject, signal } from '@angular/core';

import { GameSocketService } from '../../../core/services/game-socket.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameShellComponent } from '../components/game-shell.component';
import { PokerTableComponent } from '../poker/poker-table.component';

interface PokerViewState {
  phase: 'ready' | 'turn' | 'river' | 'showdown' | 'resolved';
  playerHand: Array<Record<string, string | boolean>>;
  opponentHand: Array<Record<string, string | boolean>>;
  communityCards: Array<Record<string, string | boolean>>;
  notes: string;
  playerEvaluation: { label: string } | null;
  opponentEvaluation: { label: string } | null;
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
            [playerHand]="viewState()?.playerHand || []"
            [opponentHand]="viewState()?.opponentHand || []"
            [communityCards]="viewState()?.communityCards || []"
            [playerEvaluation]="viewState()?.playerEvaluation || null"
            [opponentEvaluation]="viewState()?.opponentEvaluation || null"
          />

          <app-card tone="muted">
            <div class="page-stack">
              <div class="utility-row">
                <span class="pill">Table stage</span>
                <span class="pill">{{ viewState()?.phase || 'ready' }}</span>
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
              <strong class="glass-stat__value">Demo heads-up</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Mode</span>
              <strong class="glass-stat__value">{{ viewState()?.phase || 'ready' }}</strong>
            </div>
          </div>

          <app-input
            label="Bet amount"
            inputMode="numeric"
            [value]="betAmount()"
            (valueChange)="betAmount.set($event.replace(/\\D/g, ''))"
          />

          @if (!viewState() || viewState()?.phase === 'ready' || viewState()?.phase === 'resolved') {
            <app-button block (click)="deal()">Start demo hand</app-button>
          } @else {
            <div class="page-stack">
              <app-button block (click)="action('draw-turn')">Draw turn</app-button>
              <app-button variant="secondary" block (click)="action('draw-river')">Draw river</app-button>
              <app-button variant="ghost" block (click)="action('showdown')">Showdown</app-button>
              <app-button variant="ghost" block (click)="action('fold')">Fold</app-button>
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
  readonly state = computed(() => this.socket.currentState());
  readonly viewState = computed(() => (this.state()?.state as unknown as PokerViewState | null) || null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);

  constructor() {
    this.socket.reset();
    this.socket.joinGame('poker');
    this.destroyRef.onDestroy(() => {
      this.socket.leaveGame('poker', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });
  }

  deal(): void {
    const amount = Number(this.betAmount());

    if (!amount) {
      return;
    }

    this.socket.placeBet('poker', amount);
  }

  action(action: 'draw-turn' | 'draw-river' | 'showdown' | 'fold'): void {
    this.socket.sendAction('poker', action);
  }
}
