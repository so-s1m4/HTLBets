import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';

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

interface DisplayCard {
  hidden?: boolean;
  rank?: string;
  suit?: string;
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
  private readonly animationTimers = new Set<number>();
  private previousPhase: BlackjackViewState['phase'] | null = null;
  private shouldAnimateInitialDeal = false;
  private shouldAnimateNextStateChange = false;
  private hasHydratedState = false;

  readonly betAmount = signal('50');
  readonly state = computed(() => this.socket.currentState());
  readonly viewState = computed(() => (this.state()?.state as unknown as BlackjackViewState | null) || null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly outcome = computed(() => this.socket.currentState()?.outcome || null);
  readonly displayedPlayerHand = signal<DisplayCard[]>([]);
  readonly displayedDealerHand = signal<DisplayCard[]>([]);
  readonly isDealing = signal(false);
  readonly isRoundActive = computed(() => this.viewState()?.phase === 'player-turn' && !this.isDealing());
  readonly statusLabel = computed(() => {
    if (this.isDealing()) {
      return 'Dealing';
    }

    return this.viewState()?.phase === 'player-turn' ? 'Player turn' : 'Ready';
  });
  readonly displayedPlayerScore = computed(() => this.scoreHand(this.displayedPlayerHand()));
  readonly displayedDealerScore = computed(() => this.scoreHand(this.displayedDealerHand()));
  readonly resultBanner = computed(() => {
    const outcome = this.outcome();

    if (!outcome) {
      return null;
    }

    return {
      tone: outcome.balanceChange < 0 ? 'loss' : outcome.balanceChange > 0 ? 'win' : 'push',
      title: outcome.balanceChange < 0 ? 'Round lost' : outcome.balanceChange > 0 ? 'Round won' : 'Push',
      amount: outcome.balanceChange
    };
  });

  constructor() {
    this.socket.reset();
    this.socket.joinGame('blackjack');
    effect(() => {
      const nextView = this.viewState();
      this.syncDisplayedHands(nextView);
    });
    this.destroyRef.onDestroy(() => {
      this.clearAnimationTimers();
      this.socket.leaveGame('blackjack', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });
  }

  deal(): void {
    const amount = Number(this.betAmount());

    if (!amount) {
      return;
    }

    this.shouldAnimateInitialDeal = true;
    this.shouldAnimateNextStateChange = false;
    this.clearAnimationTimers();
    this.displayedPlayerHand.set([]);
    this.displayedDealerHand.set([]);
    this.isDealing.set(true);
    this.socket.placeBet('blackjack', amount);
  }

  action(action: 'hit' | 'stand' | 'double'): void {
    if (this.isDealing()) {
      return;
    }

    this.shouldAnimateNextStateChange = true;
    this.socket.sendAction('blackjack', action);
  }

  private syncDisplayedHands(nextView: BlackjackViewState | null): void {
    const previousPhase = this.previousPhase;
    this.previousPhase = nextView?.phase ?? null;

    if (!nextView) {
      this.clearAnimationTimers();
      this.displayedPlayerHand.set([]);
      this.displayedDealerHand.set([]);
      this.isDealing.set(false);
      this.hasHydratedState = false;
      this.shouldAnimateInitialDeal = false;
      this.shouldAnimateNextStateChange = false;
      return;
    }

    const targetPlayer = nextView.playerHand as DisplayCard[];
    const targetDealer = nextView.dealerHand as DisplayCard[];
    const currentPlayer = untracked(() => this.displayedPlayerHand());
    const currentDealer = untracked(() => this.displayedDealerHand());

    if (nextView.phase === 'ready' && targetPlayer.length === 0 && targetDealer.length === 0) {
      this.clearAnimationTimers();
      this.displayedPlayerHand.set([]);
      this.displayedDealerHand.set([]);
      this.isDealing.set(false);
      this.shouldAnimateInitialDeal = false;
      this.shouldAnimateNextStateChange = false;
      return;
    }

    if (!this.hasHydratedState) {
      this.hasHydratedState = true;
      this.applyHandsImmediately(targetPlayer, targetDealer);
      this.shouldAnimateInitialDeal = false;
      this.shouldAnimateNextStateChange = false;
      return;
    }

    const isInitialDeal =
      nextView.phase === 'player-turn' &&
      previousPhase !== 'player-turn' &&
      targetPlayer.length === 2 &&
      targetDealer.length === 2;

    if (isInitialDeal) {
      if (!this.shouldAnimateInitialDeal) {
        this.applyHandsImmediately(targetPlayer, targetDealer);
        this.shouldAnimateNextStateChange = false;
        return;
      }

      this.runInitialDealSequence(targetPlayer, targetDealer);
      return;
    }

    if (this.cardsEqual(currentPlayer, targetPlayer) && this.cardsEqual(currentDealer, targetDealer)) {
      this.isDealing.set(false);
      return;
    }

    if (!this.shouldAnimateNextStateChange) {
      this.applyHandsImmediately(targetPlayer, targetDealer);
      return;
    }

    this.runIncrementalReveal(targetPlayer, targetDealer);
  }

  private runInitialDealSequence(targetPlayer: DisplayCard[], targetDealer: DisplayCard[]): void {
    this.clearAnimationTimers();
    this.isDealing.set(true);
    this.displayedPlayerHand.set([]);
    this.displayedDealerHand.set([]);
    this.shouldAnimateInitialDeal = false;

    this.queueAnimation(260, () => {
      this.displayedPlayerHand.set([targetPlayer[0]]);
    });
    this.queueAnimation(1460, () => {
      this.displayedDealerHand.set([targetDealer[0]]);
    });
    this.queueAnimation(2660, () => {
      this.displayedPlayerHand.set([targetPlayer[0], targetPlayer[1]]);
    });
    this.queueAnimation(3860, () => {
      this.displayedDealerHand.set([targetDealer[0], targetDealer[1]]);
    });
    this.queueAnimation(5260, () => {
      this.isDealing.set(false);
      this.shouldAnimateNextStateChange = false;
    });
  }

  private runIncrementalReveal(targetPlayer: DisplayCard[], targetDealer: DisplayCard[]): void {
    this.clearAnimationTimers();
    this.isDealing.set(true);
    this.shouldAnimateNextStateChange = false;

    let delayMs = 260;
    let workingPlayer = [...untracked(() => this.displayedPlayerHand())];
    let workingDealer = [...untracked(() => this.displayedDealerHand())];

    const queueCardUpdates = (currentCards: DisplayCard[], targetCards: DisplayCard[], apply: (cards: DisplayCard[]) => void) => {
      for (let index = 0; index < targetCards.length; index += 1) {
        const currentCard = currentCards[index];
        const nextCard = targetCards[index];

        if (currentCard && this.cardSignature(currentCard) === this.cardSignature(nextCard)) {
          continue;
        }

        const nextCards = [...currentCards];
        nextCards[index] = nextCard;
        currentCards = nextCards;
        const scheduledCards = nextCards;

        this.queueAnimation(delayMs, () => {
          apply(scheduledCards);
        });
        delayMs += 1200;
      }
    };

    queueCardUpdates(workingPlayer, targetPlayer, (cards) => {
      workingPlayer = cards;
      this.displayedPlayerHand.set(cards);
    });
    queueCardUpdates(workingDealer, targetDealer, (cards) => {
      workingDealer = cards;
      this.displayedDealerHand.set(cards);
    });

    this.queueAnimation(delayMs + 180, () => {
      this.isDealing.set(false);
    });
  }

  private applyHandsImmediately(targetPlayer: DisplayCard[], targetDealer: DisplayCard[]): void {
    this.clearAnimationTimers();
    this.displayedPlayerHand.set([...targetPlayer]);
    this.displayedDealerHand.set([...targetDealer]);
    this.isDealing.set(false);
  }

  private clearAnimationTimers(): void {
    for (const timer of this.animationTimers) {
      window.clearTimeout(timer);
    }

    this.animationTimers.clear();
  }

  private queueAnimation(delayMs: number, callback: () => void): void {
    const timer = window.setTimeout(() => {
      this.animationTimers.delete(timer);
      callback();
    }, delayMs);

    this.animationTimers.add(timer);
  }

  private cardsEqual(left: DisplayCard[], right: DisplayCard[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((card, index) => this.cardSignature(card) === this.cardSignature(right[index]));
  }

  private cardSignature(card: DisplayCard | undefined): string {
    if (!card) {
      return 'missing';
    }

    return `${card.rank || '?'}:${card.suit || '?'}:${card.hidden ? 'hidden' : 'visible'}`;
  }

  private scoreHand(cards: DisplayCard[]): number {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
      if (card.hidden || !card.rank) {
        continue;
      }

      if (card.rank === 'A') {
        total += 11;
        aces += 1;
        continue;
      }

      if (['K', 'Q', 'J'].includes(card.rank)) {
        total += 10;
        continue;
      }

      total += Number(card.rank) || 0;
    }

    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }

    return total;
  }
}
