import { Component, Input } from '@angular/core';

interface DisplayCard {
  hidden?: boolean;
  rank?: string;
  suit?: string;
}

interface PokerSeatView {
  userId: string;
  playerLabel: string;
  ante: number;
  stackRemaining: number;
  totalContribution: number;
  streetContribution: number;
  status: 'waiting' | 'active' | 'folded' | 'all-in';
  seatIndex: number;
  isSelf: boolean;
  cards: DisplayCard[];
  evaluation?: { label: string } | null;
  lastAction?: string;
}

@Component({
  selector: 'app-poker-table',
  standalone: true,
  template: `
    <div class="poker-table">
      <div class="poker-table__ambient poker-table__ambient--left"></div>
      <div class="poker-table__ambient poker-table__ambient--right"></div>

      <div class="poker-table__header">
        <div class="page-heading">
          <span class="page-heading__eyebrow">Main Table</span>
          <h2>Realtime multiplayer poker</h2>
        </div>

        <div class="poker-table__pot">
          <span class="glass-stat__label">{{ phase === 'waiting' ? 'Committed' : 'Pot' }}</span>
          <strong>{{ pot }} cr</strong>
        </div>
      </div>

      <div class="poker-table__ring">
        @for (seat of seats; track seat.userId) {
          <section
            class="poker-seat"
            [class.active]="seat.status === 'active'"
            [class.self]="seat.isSelf"
            [class.acting]="actingUserId === seat.userId"
            [style.--seat-index]="seat.seatIndex"
          >
            <div class="poker-seat__meta">
              <strong>{{ seat.playerLabel }}</strong>
              <span class="pill">{{ seat.status }}</span>
            </div>

            <div class="poker-seat__info">
              <span>{{ seat.stackRemaining }} cr behind</span>
              <span>{{ seat.totalContribution }} cr {{ phase === 'waiting' ? 'buy-in' : 'in' }}</span>
            </div>

            <div class="poker-seat__info">
              <span>{{ seat.streetContribution }} cr street</span>
              <span>{{ seat.lastAction || 'Waiting' }}</span>
            </div>

            <div class="poker-seat__cards">
              @for (card of seat.cards; track $index) {
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

            @if (seat.evaluation) {
              <span class="poker-seat__eval">{{ seat.evaluation.label }}</span>
            }
          </section>
        }

        <section class="poker-board">
          <div class="poker-board__core">
            <div class="poker-board__status">
              <span class="pill">Phase: {{ phase }}</span>
              <span class="pill">Street bet: {{ currentBet }} cr</span>
            </div>
            <div class="poker-board__cards">
              @for (card of communityCards; track $index) {
                <div class="poker-card poker-card--board">
                  <strong>{{ card.rank }}</strong>
                  <span>{{ symbol(card.suit) }}</span>
                </div>
              }
            </div>

            @if (winners?.length) {
              <div class="poker-board__winners">
                @for (winner of winners; track winner.userId) {
                  <span class="pill">{{ winner.playerLabel }} · {{ winner.hand }}</span>
                }
              </div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .poker-table {
      position: relative;
      display: grid;
      gap: 1rem;
      padding: 1rem;
      border-radius: var(--radius-xl);
      overflow: hidden;
      background:
        radial-gradient(circle at 50% 50%, rgba(72, 188, 149, 0.18), transparent 32%),
        radial-gradient(circle at 18% 20%, rgba(93, 168, 255, 0.14), transparent 24%),
        radial-gradient(circle at 84% 18%, rgba(136, 123, 255, 0.14), transparent 20%),
        linear-gradient(180deg, rgba(18, 66, 59, 0.96), rgba(7, 28, 27, 0.99));
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.06),
        inset 0 -34px 42px rgba(0, 0, 0, 0.24),
        0 24px 48px rgba(5, 9, 20, 0.26);
    }

    .poker-table__ambient {
      position: absolute;
      border-radius: 999px;
      filter: blur(16px);
      opacity: 0.6;
      pointer-events: none;
      animation: poker-drift 14s ease-in-out infinite alternate;
    }

    .poker-table__ambient--left {
      inset: auto auto -1rem -1rem;
      width: 6rem;
      height: 6rem;
      background: rgba(93, 168, 255, 0.22);
    }

    .poker-table__ambient--right {
      inset: -1.5rem -0.5rem auto auto;
      width: 7rem;
      height: 7rem;
      background: rgba(136, 123, 255, 0.18);
      animation-duration: 18s;
    }

    .poker-table__header {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .poker-table__header h2 {
      margin: 0;
    }

    .poker-table__pot {
      display: grid;
      gap: 0.3rem;
      min-width: 8rem;
      padding: 0.9rem 1rem;
      border-radius: 22px;
      border: 1px solid rgba(149, 171, 211, 0.16);
      background: rgba(8, 16, 27, 0.34);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .poker-table__pot strong {
      font-size: 1.5rem;
      line-height: 1;
      letter-spacing: -0.05em;
    }

    .poker-table__ring {
      position: relative;
      display: grid;
      gap: 0.9rem;
    }

    .poker-seat,
    .poker-board {
      position: relative;
      border-radius: 24px;
      border: 1px solid rgba(149, 171, 211, 0.14);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
        rgba(8, 18, 24, 0.42);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 18px 28px rgba(5, 9, 20, 0.14);
      overflow: hidden;
    }

    .poker-seat {
      display: grid;
      gap: 0.65rem;
      padding: 0.85rem;
    }

    .poker-seat.active {
      border-color: rgba(125, 227, 255, 0.24);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 0 28px rgba(125, 227, 255, 0.1),
        0 18px 28px rgba(5, 9, 20, 0.18);
    }

    .poker-seat.self {
      border-color: rgba(93, 168, 255, 0.28);
    }

    .poker-seat.acting {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 0 0 1px rgba(125, 227, 255, 0.18),
        0 0 34px rgba(125, 227, 255, 0.14),
        0 18px 28px rgba(5, 9, 20, 0.18);
    }

    .poker-seat__meta,
    .poker-seat__info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.55rem;
      flex-wrap: wrap;
    }

    .poker-seat__meta strong {
      letter-spacing: -0.03em;
    }

    .poker-seat__info {
      color: var(--text-soft);
      font-size: 0.82rem;
    }

    .poker-seat__cards,
    .poker-board__cards {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .poker-seat__eval {
      color: var(--accent-cyan);
      font-size: 0.78rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-family: 'SF Mono', 'IBM Plex Mono', ui-monospace, monospace;
    }

    .poker-board {
      padding: 1rem;
      min-height: 13rem;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 50% 45%, rgba(108, 243, 186, 0.08), transparent 28%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
        rgba(5, 31, 31, 0.52);
    }

    .poker-board__core {
      display: grid;
      gap: 0.9rem;
      justify-items: center;
    }

    .poker-board__status {
      display: flex;
      gap: 0.55rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .poker-board__winners {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .poker-card {
      width: 3.7rem;
      height: 5rem;
      border-radius: 18px;
      border: 1px solid rgba(149, 171, 211, 0.16);
      background:
        linear-gradient(180deg, rgba(249, 252, 255, 0.98), rgba(216, 228, 243, 0.94));
      color: #08203b;
      display: grid;
      align-content: space-between;
      padding: 0.58rem;
      animation: poker-card-in 420ms cubic-bezier(0.18, 0.8, 0.24, 1);
    }

    .poker-card.hidden {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(68, 133, 218, 0.42), rgba(7, 22, 36, 0.98));
      color: var(--text);
      place-content: center;
    }

    .poker-card--board {
      animation-delay: calc(var(--seat-index, 0) * 40ms);
    }

    @keyframes poker-card-in {
      0% {
        transform: translate3d(0.7rem, 0.5rem, 0) rotate(2deg) scale(0.96);
        opacity: 0;
      }
      100% {
        transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
        opacity: 1;
      }
    }

    @keyframes poker-drift {
      0% {
        transform: translate3d(0, 0, 0) scale(1);
      }
      100% {
        transform: translate3d(8px, -10px, 0) scale(1.06);
      }
    }

    @media (min-width: 960px) {
      .poker-table__ring {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .poker-board {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 640px) {
      .poker-table {
        padding: 0.85rem;
      }

      .poker-card {
        width: 3.15rem;
        height: 4.35rem;
        border-radius: 15px;
        padding: 0.48rem;
      }
    }
  `]
})
export class PokerTableComponent {
  @Input() phase = 'waiting';
  @Input() pot = 0;
  @Input() currentBet = 0;
  @Input() actingUserId: string | null = null;
  @Input() seats: PokerSeatView[] = [];
  @Input() communityCards: DisplayCard[] = [];
  @Input() winners: Array<{ userId: string; playerLabel: string; hand: string }> | null = null;

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
