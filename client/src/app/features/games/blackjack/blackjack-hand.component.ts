import { Component, Input } from '@angular/core';

interface DisplayCard {
  hidden?: boolean;
  rank?: string;
  suit?: string;
}

@Component({
  selector: 'app-blackjack-hand',
  standalone: true,
  template: `
    <div class="hand">
      <div class="hand__header">
        <h3>{{ label }}</h3>
        <span class="pill">Score: {{ score }}</span>
      </div>

      <div class="hand__cards">
        @for (card of cards; track $index) {
          <div class="card" [class.hidden]="isHidden(card)">
            @if (isHidden(card)) {
              <span>??</span>
            } @else {
              <strong>{{ card.rank }}</strong>
              <span>{{ symbol(card.suit) }}</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .hand {
      display: grid;
      gap: 0.8rem;
      padding: 1rem;
      border-radius: var(--radius-lg);
      border: 1px solid rgba(149, 171, 211, 0.12);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(15, 22, 34, 0.96), rgba(9, 14, 22, 0.98));
    }

    .hand__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .hand__header h3 {
      margin: 0;
    }

    .hand__cards {
      display: flex;
      gap: 0.7rem;
      flex-wrap: wrap;
    }

    .card {
      width: 70px;
      height: 96px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(252, 254, 255, 0.98), rgba(223, 233, 247, 0.94));
      color: #08203b;
      display: grid;
      align-content: space-between;
      padding: 0.75rem;
      box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
      animation: deal-in 420ms cubic-bezier(0.18, 0.8, 0.24, 1);
    }

    .card.hidden {
      background: linear-gradient(180deg, rgba(72, 163, 255, 0.24), rgba(10, 29, 47, 0.98));
      color: var(--text);
      place-content: center;
    }

    @keyframes deal-in {
      0% {
        transform: translate3d(1.4rem, 1rem, 0) rotate(4deg) scale(0.96);
        opacity: 0;
      }
      100% {
        transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
        opacity: 1;
      }
    }
  `]
})
export class BlackjackHandComponent {
  @Input() label = '';
  @Input() score = 0;
  @Input() cards: DisplayCard[] = [];

  isHidden(card: DisplayCard): boolean {
    return Boolean(card.hidden);
  }

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
