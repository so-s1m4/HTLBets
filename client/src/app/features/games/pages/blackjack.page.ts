import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';

import { AuthService } from '../../../core/services/auth.service';
import { CardDeckService } from '../../../core/services/card-deck.service';
import { GameSocketService } from '../../../core/services/game-socket.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameShellComponent } from '../components/game-shell.component';
import { BlackjackHandComponent } from '../blackjack/blackjack-hand.component';

interface BlackjackHandViewState {
  cards: Array<Record<string, string | boolean>>;
  score: number;
  betAmount: number;
  doubledDown: boolean;
  finished: boolean;
  active: boolean;
  outcome: string | null;
}

interface BlackjackViewState {
  phase: 'ready' | 'insurance' | 'player-turn' | 'dealer-turn' | 'resolved';
  playerHand: Array<Record<string, string | boolean>>;
  playerHands?: BlackjackHandViewState[];
  activeHandIndex: number;
  dealerHand: Array<Record<string, string | boolean>>;
  playerScore: number;
  dealerScore: number;
  doubledDown: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canInsurance: boolean;
  insuranceBet: number;
  totalWager: number;
  message: string;
}

interface DisplayCard {
  hidden?: boolean;
  rank?: string;
  suit?: string;
}

interface DisplayPlayerHand {
  cards: DisplayCard[];
  score: number;
  betAmount: number;
  active: boolean;
  outcome: string | null;
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
  styleUrl: './blackjack.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlackjackPageComponent {
  readonly socket = inject(GameSocketService);
  readonly auth = inject(AuthService);

  private readonly destroyRef = inject(DestroyRef);
  private readonly cardDeckService = inject(CardDeckService);
  private readonly animationTimers = new Set<number>();
  private shouldAnimateInitialDeal = false;
  private shouldAnimateNextStateChange = false;
  private hasHydratedState = false;
  private loadedDeckId: string | null = null;

  readonly betAmount = signal('50');
  readonly selectedBackImageUrl = signal('/cards/back_dark.png');
  readonly selectedFaceImageTemplate = signal('/cards/{suit}_{rank}.png');
  readonly isFullscreen = signal(false);
  readonly state = computed(() => this.socket.currentState());
  readonly viewState = computed(() => (this.state()?.state as unknown as BlackjackViewState | null) || null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly outcome = computed(() => this.socket.currentState()?.outcome || null);
  readonly revealedOutcome = signal<ReturnType<typeof this.outcome> | null>(null);
  readonly displayedPlayerHands = signal<DisplayPlayerHand[]>([]);
  readonly displayedDealerHand = signal<DisplayCard[]>([]);
  readonly isDealing = signal(false);
  readonly hasPlayerHands = computed(() => this.displayedPlayerHands().length > 0);
  readonly isSplitView = computed(() => this.displayedPlayerHands().length > 1);
  readonly dealerHandHidden = computed(() => this.displayedDealerHand().length === 0 && !this.isRoundActive());
  readonly playerHandsHidden = computed(() => !this.hasPlayerHands() && !this.isRoundActive());
  readonly canTakeInsurance = computed(() => Boolean(this.viewState()?.canInsurance));
  readonly canDouble = computed(() => Boolean(this.viewState()?.canDouble));
  readonly canSplit = computed(() => Boolean(this.viewState()?.canSplit));
  readonly statusMessage = computed(() => this.viewState()?.message || 'Place a bet to begin.');
  readonly isInsuranceDecision = computed(() => this.viewState()?.phase === 'insurance' && !this.isDealing());
  readonly isRoundActive = computed(() => this.viewState()?.phase === 'player-turn' && !this.isDealing());
  readonly statusLabel = computed(() => {
    if (this.isDealing()) {
      return 'Dealing';
    }

    const phase = this.viewState()?.phase;
    if (phase === 'insurance') {
      return 'Insurance';
    }

    if (phase === 'dealer-turn') {
      return 'Dealer turn';
    }

    return phase === 'player-turn' ? 'Player turn' : 'Ready';
  });
  readonly displayedDealerScore = computed(() => this.scoreHand(this.displayedDealerHand()));
  readonly resultBanner = computed(() => {
    const outcome = this.revealedOutcome();

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
    void this.syncSelectedDeck();
    effect(() => {
      const nextView = this.viewState();
      this.syncDisplayedHands(nextView);
    });
    effect(() => {
      const selectedDeckId = this.auth.currentUser()?.selectedCardDeckId || null;

      if (!selectedDeckId || selectedDeckId === this.loadedDeckId) {
        return;
      }

      void this.syncSelectedDeck();
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
    this.revealedOutcome.set(null);
    this.displayedPlayerHands.set([]);
    this.displayedDealerHand.set([]);
    this.isDealing.set(true);
    this.socket.placeBet('blackjack', amount);
  }

  setFullscreen(value: boolean): void {
    this.isFullscreen.set(value);
  }

  action(action: 'hit' | 'stand' | 'double' | 'split' | 'insurance' | 'skip-insurance'): void {
    if (this.isDealing()) {
      return;
    }

    this.shouldAnimateNextStateChange = true;
    this.socket.sendAction('blackjack', action);
  }

  playerHandLabel(index: number): string {
    return this.displayedPlayerHands().length > 1 ? `Hand ${index + 1}` : 'Player';
  }

  playerHandCaption(hand: DisplayPlayerHand): string {
    const parts = [`Bet ${hand.betAmount} cr`];

    if (hand.outcome) {
      parts.push(hand.outcome);
    } else if (hand.active && this.viewState()?.phase === 'player-turn') {
      parts.push('Active');
    }

    return parts.join(' · ');
  }

  private syncDisplayedHands(nextView: BlackjackViewState | null): void {
    const nextOutcome = this.outcome();

    if (!nextView) {
      this.clearAnimationTimers();
      this.displayedPlayerHands.set([]);
      this.displayedDealerHand.set([]);
      this.isDealing.set(false);
      this.revealedOutcome.set(null);
      this.hasHydratedState = false;
      this.shouldAnimateInitialDeal = false;
      this.shouldAnimateNextStateChange = false;
      return;
    }

    const targetPlayerHands = this.normalizePlayerHands(nextView);
    const targetDealer = nextView.dealerHand as DisplayCard[];
    const currentPlayerHands = untracked(() => this.displayedPlayerHands());
    const currentDealer = untracked(() => this.displayedDealerHand());

    if (nextView.phase === 'ready' && targetPlayerHands.length === 0 && targetDealer.length === 0) {
      this.clearAnimationTimers();
      this.displayedPlayerHands.set([]);
      this.displayedDealerHand.set([]);
      this.isDealing.set(false);
      this.revealedOutcome.set(null);
      this.shouldAnimateInitialDeal = false;
      this.shouldAnimateNextStateChange = false;
      return;
    }

    if (!this.hasHydratedState) {
      this.hasHydratedState = true;
      this.applyHandsImmediately(targetPlayerHands, targetDealer);
      this.revealedOutcome.set(nextOutcome);
      this.shouldAnimateInitialDeal = false;
      this.shouldAnimateNextStateChange = false;
      return;
    }

    const isInitialDeal =
      this.shouldAnimateInitialDeal &&
      currentPlayerHands.length === 0 &&
      targetPlayerHands.length === 1 &&
      targetPlayerHands[0]?.cards.length === 2 &&
      currentDealer.length === 0 &&
      targetDealer.length === 2 &&
      nextView.phase !== 'ready';

    if (isInitialDeal) {
      this.runInitialDealSequence(targetPlayerHands[0], targetDealer, nextOutcome);
      return;
    }

    if (this.handsEqual(currentPlayerHands, targetPlayerHands) && this.cardsEqual(currentDealer, targetDealer)) {
      if (this.shouldAnimateNextStateChange && nextOutcome) {
        this.clearAnimationTimers();
        this.isDealing.set(true);
        this.revealedOutcome.set(null);
        this.shouldAnimateNextStateChange = false;
        this.queueAnimation(1200, () => {
          this.isDealing.set(false);
          this.revealedOutcome.set(this.outcome());
        });
        return;
      }

      this.isDealing.set(false);
      this.revealedOutcome.set(nextOutcome);
      this.shouldAnimateNextStateChange = false;
      return;
    }

    const canUseRevealAnimation =
      this.shouldAnimateNextStateChange &&
      currentPlayerHands.length > 0 &&
      currentPlayerHands.length === targetPlayerHands.length;

    if (canUseRevealAnimation) {
      this.runHandSetReveal(targetPlayerHands, targetDealer);
      return;
    }

    this.applyHandsImmediately(targetPlayerHands, targetDealer);
    this.revealedOutcome.set(nextOutcome);
    this.shouldAnimateInitialDeal = false;
    this.shouldAnimateNextStateChange = false;
  }

  private async syncSelectedDeck(): Promise<void> {
    try {
      const selectedDeckId = this.auth.currentUser()?.selectedCardDeckId || null;
      const decks = await this.cardDeckService.listMine();
      const selected = decks.find((deck) => deck.selected) || decks.find((deck) => deck.id === selectedDeckId) || null;

      if (!selected) {
        this.selectedBackImageUrl.set('/cards/back_dark.png');
        this.selectedFaceImageTemplate.set('/cards/{suit}_{rank}.png');
        this.loadedDeckId = null;
        return;
      }

      this.selectedBackImageUrl.set(selected.backImageUrl);
      this.selectedFaceImageTemplate.set(selected.faceImageTemplate);
      this.loadedDeckId = selected.id;
    } catch {
      this.selectedBackImageUrl.set('/cards/back_dark.png');
      this.selectedFaceImageTemplate.set('/cards/{suit}_{rank}.png');
      this.loadedDeckId = null;
    }
  }

  private runInitialDealSequence(
    targetPlayerHand: DisplayPlayerHand,
    targetDealer: DisplayCard[],
    nextOutcome: ReturnType<typeof this.outcome>
  ): void {
    this.clearAnimationTimers();
    this.isDealing.set(true);
    this.revealedOutcome.set(null);
    this.displayedPlayerHands.set([]);
    this.displayedDealerHand.set([]);
    this.shouldAnimateInitialDeal = false;

    this.queueAnimation(260, () => {
      this.displayedPlayerHands.set([{ ...targetPlayerHand, cards: [targetPlayerHand.cards[0]] }]);
    });
    this.queueAnimation(1460, () => {
      this.displayedDealerHand.set([targetDealer[0]]);
    });
    this.queueAnimation(2660, () => {
      this.displayedPlayerHands.set([{ ...targetPlayerHand, cards: [targetPlayerHand.cards[0], targetPlayerHand.cards[1]] }]);
    });
    this.queueAnimation(3860, () => {
      this.displayedDealerHand.set([targetDealer[0], targetDealer[1]]);
    });
    this.queueAnimation(5260, () => {
      this.isDealing.set(false);
      this.revealedOutcome.set(nextOutcome ?? this.outcome());
      this.shouldAnimateNextStateChange = false;
    });
  }

  private runHandSetReveal(targetPlayerHands: DisplayPlayerHand[], targetDealer: DisplayCard[]): void {
    this.clearAnimationTimers();
    this.isDealing.set(true);
    this.revealedOutcome.set(null);
    this.shouldAnimateNextStateChange = false;

    let delayMs = 260;
    const currentPlayerHands = untracked(() => this.displayedPlayerHands());
    let workingPlayerHands = currentPlayerHands.map((hand, index) => ({
      ...targetPlayerHands[index],
      cards: [...hand.cards]
    }));
    let workingDealer = [...untracked(() => this.displayedDealerHand())];
    let hasCardChanges = false;

    this.displayedPlayerHands.set(workingPlayerHands);

    const queueCardUpdates = (currentCards: DisplayCard[], targetCards: DisplayCard[], apply: (cards: DisplayCard[]) => void) => {
      for (let index = 0; index < targetCards.length; index += 1) {
        const currentCard = currentCards[index];
        const nextCard = targetCards[index];

        if (this.cardSignature(currentCard) === this.cardSignature(nextCard)) {
          continue;
        }

        hasCardChanges = true;
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

    workingPlayerHands.forEach((hand, handIndex) => {
      queueCardUpdates(hand.cards, targetPlayerHands[handIndex].cards, (cards) => {
        workingPlayerHands = workingPlayerHands.map((entry, index) =>
          index === handIndex ? { ...targetPlayerHands[handIndex], cards } : entry
        );
        this.displayedPlayerHands.set(workingPlayerHands);
      });
    });

    queueCardUpdates(workingDealer, targetDealer, (cards) => {
      workingDealer = cards;
      this.displayedDealerHand.set(cards);
    });

    this.queueAnimation((hasCardChanges ? delayMs : 260) + 180, () => {
      this.displayedPlayerHands.set(targetPlayerHands);
      this.displayedDealerHand.set(targetDealer);
      this.isDealing.set(false);
      this.revealedOutcome.set(this.outcome());
    });
  }

  private normalizePlayerHands(view: BlackjackViewState): DisplayPlayerHand[] {
    const hands = Array.isArray(view.playerHands) && view.playerHands.length
      ? view.playerHands
      : [
          {
            cards: view.playerHand,
            score: view.playerScore,
            betAmount: view.totalWager || this.currentBet(),
            doubledDown: view.doubledDown,
            finished: view.phase === 'resolved',
            active: true,
            outcome: this.outcome()?.result || null
          }
        ];

    return hands.map((hand) => ({
      cards: (hand.cards || []) as DisplayCard[],
      score: hand.score,
      betAmount: hand.betAmount,
      active: hand.active,
      outcome: hand.outcome
    }));
  }

  private applyHandsImmediately(targetPlayerHands: DisplayPlayerHand[], targetDealer: DisplayCard[]): void {
    this.clearAnimationTimers();
    this.displayedPlayerHands.set(targetPlayerHands.map((hand) => ({ ...hand, cards: [...hand.cards] })));
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

  private handsEqual(left: DisplayPlayerHand[], right: DisplayPlayerHand[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((hand, index) => this.handEqual(hand, right[index]));
  }

  private handEqual(left: DisplayPlayerHand | undefined, right: DisplayPlayerHand | undefined): boolean {
    if (!left || !right) {
      return false;
    }

    return this.handMetaEqual(left, right) && this.cardsEqual(left.cards, right.cards);
  }

  private handMetaEqual(left: DisplayPlayerHand, right: DisplayPlayerHand): boolean {
    return (
      left.score === right.score &&
      left.betAmount === right.betAmount &&
      left.active === right.active &&
      left.outcome === right.outcome
    );
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
