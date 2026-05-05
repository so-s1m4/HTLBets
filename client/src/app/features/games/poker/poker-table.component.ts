import { Component, Input } from '@angular/core';

import type { PokerDisplayCard, PokerSeatView, PokerWinnerView } from '../../../core/models/game.model';

interface PositionedSeat {
  seat: PokerSeatView;
  left: number;
  top: number;
}

const orbitLayouts: Record<number, Array<{ left: number; top: number }>> = {
  1: [{ left: 50, top: 10 }],
  2: [
    { left: 26, top: 16 },
    { left: 74, top: 16 }
  ],
  3: [
    { left: 20, top: 22 },
    { left: 50, top: 8 },
    { left: 80, top: 22 }
  ],
  4: [
    { left: 18, top: 28 },
    { left: 33, top: 10 },
    { left: 67, top: 10 },
    { left: 82, top: 28 }
  ],
  5: [
    { left: 15, top: 34 },
    { left: 26, top: 14 },
    { left: 50, top: 7 },
    { left: 74, top: 14 },
    { left: 85, top: 34 }
  ],
  6: [
    { left: 13, top: 40 },
    { left: 22, top: 18 },
    { left: 40, top: 8 },
    { left: 60, top: 8 },
    { left: 78, top: 18 },
    { left: 87, top: 40 }
  ],
  7: [
    { left: 12, top: 46 },
    { left: 18, top: 22 },
    { left: 34, top: 9 },
    { left: 50, top: 5 },
    { left: 66, top: 9 },
    { left: 82, top: 22 },
    { left: 88, top: 46 }
  ]
};

@Component({
  selector: 'app-poker-table',
  standalone: true,
  templateUrl: './poker-table.component.html',
  styleUrl: './poker-table.component.scss'
})
export class PokerTableComponent {
  @Input() tableName = 'Realtime poker';
  @Input() phase = 'waiting';
  @Input() pot = 0;
  @Input() currentBet = 0;
  @Input() actingUserId: string | null = null;
  @Input() seats: PokerSeatView[] = [];
  @Input() communityCards: PokerDisplayCard[] = [];
  @Input() winners: PokerWinnerView[] | null = null;

  animationDelay(index: number, base = 0): string {
    return `${base + index * 90}ms`;
  }

  selfSeat(): PokerSeatView | null {
    return this.seats.find((seat) => seat.isSelf) || null;
  }

  orbitSeats(): PositionedSeat[] {
    const others = this.seats.filter((seat) => !seat.isSelf);
    const layout = orbitLayouts[others.length] || orbitLayouts[7];

    return others.map((seat, index) => ({
      seat,
      left: layout[index]?.left || 50,
      top: layout[index]?.top || 12
    }));
  }

  displayBoardCards(): PokerDisplayCard[] {
    const cards = [...this.communityCards];
    while (cards.length < 5) {
      cards.push({ hidden: true });
    }

    return cards;
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

  color(suit: string | undefined): string {
    switch (suit) {
      case 'hearts':
      case 'diamonds':
        return '#d25674';
      case 'clubs':
      case 'spades':
        return '#0b2038';
      default:
        return '#0b2038';
    }
  }
}
