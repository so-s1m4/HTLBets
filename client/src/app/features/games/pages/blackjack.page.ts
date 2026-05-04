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
  templateUrl: './blackjack.page.html',
  styleUrl: './blackjack.page.scss'
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
