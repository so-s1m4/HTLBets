import { Component, Input } from '@angular/core';

interface DisplayCard {
  hidden?: boolean;
  rank?: string;
  suit?: string;
}

@Component({
  selector: 'app-poker-table',
  standalone: true,
  template: `
    <div class="poker-table">
      <section class="poker-row">
        <div class="utility-row">
          <h3>Opponent</h3>
          @if (opponentEvaluation) {
            <span class="pill">{{ opponentEvaluation.label }}</span>
          }
        </div>

        <div class="poker-cards">
          @for (card of opponentHand; track $index) {
            <div class="poker-card" [class.hidden]="card.hidden">
              @if (card.hidden) {
                <span>??</span>
              } @else {
                <strong>{{ card.rank }}</strong>
                <span>{{ symbol(card.suit) }}</span>
              }
            </div>
          }
        </div>
      </section>

      <section class="poker-row poker-row--community">
        <div class="utility-row">
          <h3>Community</h3>
          <span class="pill">{{ communityCards.length }}/5 cards</span>
        </div>

        <div class="poker-cards">
          @for (card of communityCards; track $index) {
            <div class="poker-card">
              <strong>{{ card.rank }}</strong>
              <span>{{ symbol(card.suit) }}</span>
            </div>
          }
        </div>
      </section>

      <section class="poker-row">
        <div class="utility-row">
          <h3>Player</h3>
          @if (playerEvaluation) {
            <span class="pill">{{ playerEvaluation.label }}</span>
          }
        </div>

        <div class="poker-cards">
          @for (card of playerHand; track $index) {
            <div class="poker-card">
              <strong>{{ card.rank }}</strong>
              <span>{{ symbol(card.suit) }}</span>
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    .poker-table {
      display: grid;
      gap: 1rem;
      padding: 1rem;
      border-radius: var(--radius-xl);
      background:
        radial-gradient(circle at center, rgba(93, 168, 255, 0.08), transparent 30%),
        linear-gradient(180deg, rgba(24, 60, 49, 0.92), rgba(7, 27, 24, 0.98));
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        inset 0 -24px 38px rgba(0, 0, 0, 0.28);
    }

    .poker-row {
      display: grid;
      gap: 0.7rem;
    }

    .poker-row h3 {
      margin: 0;
    }

    .poker-row--community {
      padding: 1rem;
      border-radius: var(--radius-md);
      border: 1px dashed rgba(149, 171, 211, 0.2);
      background: rgba(255, 255, 255, 0.04);
      box-shadow: 0 0 32px rgba(93, 168, 255, 0.06);
    }

    .poker-cards {
      display: flex;
      gap: 0.7rem;
      flex-wrap: wrap;
    }

    .poker-card {
      width: 70px;
      height: 96px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(247, 250, 255, 0.98), rgba(211, 228, 246, 0.94));
      color: #08203b;
      display: grid;
      align-content: space-between;
      padding: 0.75rem;
      animation: poker-card-in 420ms cubic-bezier(0.18, 0.8, 0.24, 1);
    }

    .poker-card.hidden {
      background: linear-gradient(180deg, rgba(72, 163, 255, 0.24), rgba(10, 29, 47, 0.98));
      color: var(--text);
      place-content: center;
    }

    @keyframes poker-card-in {
      0% {
        transform: translate3d(1rem, 0.7rem, 0) rotate(2deg) scale(0.96);
        opacity: 0;
      }
      100% {
        transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
        opacity: 1;
      }
    }
  `]
})
export class PokerTableComponent {
  @Input() playerHand: DisplayCard[] = [];
  @Input() opponentHand: DisplayCard[] = [];
  @Input() communityCards: DisplayCard[] = [];
  @Input() playerEvaluation: { label: string } | null = null;
  @Input() opponentEvaluation: { label: string } | null = null;

  symbol(suit: string | undefined): string {
    switch (suit) {
      case 'hearts':
        return '♥';
      case 'diamonds':
        return '♦';
      case 'clubs':
        return '♣';
      case 'spades':
        return '♠';
      default:
        return '?';
    }
  }
}
