import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

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
  styleUrl: './poker-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PokerTableComponent {
  private seatsValue: PokerSeatView[] = [];
  private selfSeatValue: PokerSeatView | null = null;
  private orbitSeatValues: PositionedSeat[] = [];
  private communityCardsValue: PokerDisplayCard[] = [];
  private displayBoardCardsValue: PokerDisplayCard[] = [];

  @Input() tableName = 'Realtime poker';
  @Input() phase = 'waiting';
  @Input() pot = 0;
  @Input() currentBet = 0;
  @Input() actingUserId: string | null = null;
  @Input() actingCountdownMs = 0;
  @Input() actingTurnDurationMs = 20_000;
  @Input()
  set seats(value: PokerSeatView[]) {
    this.seatsValue = value || [];
    this.selfSeatValue = this.seatsValue.find((seat) => seat.isSelf) || null;

    const others = this.seatsValue.filter((seat) => !seat.isSelf);
    const layout = orbitLayouts[others.length] || orbitLayouts[7];
    this.orbitSeatValues = others.map((seat, index) => ({
      seat,
      left: layout[index]?.left || 50,
      top: layout[index]?.top || 12
    }));
  }

  get seats(): PokerSeatView[] {
    return this.seatsValue;
  }

  @Input()
  set communityCards(value: PokerDisplayCard[]) {
    this.communityCardsValue = value || [];
    this.displayBoardCardsValue = [...this.communityCardsValue];
    while (this.displayBoardCardsValue.length < 5) {
      this.displayBoardCardsValue.push({ hidden: true });
    }
  }

  get communityCards(): PokerDisplayCard[] {
    return this.communityCardsValue;
  }

  @Input() winners: PokerWinnerView[] | null = null;

  animationDelay(index: number, base = 0): string {
    return `${base + index * 90}ms`;
  }

  selfSeat(): PokerSeatView | null {
    return this.selfSeatValue;
  }

  orbitSeats(): PositionedSeat[] {
    return this.orbitSeatValues;
  }

  displayBoardCards(): PokerDisplayCard[] {
    return this.displayBoardCardsValue;
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

  avatarInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || 'P';
  }

  turnProgressFor(userId: string): number {
    if (this.actingUserId !== userId || this.actingTurnDurationMs <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(1, this.actingCountdownMs / this.actingTurnDurationMs));
  }

  turnRingStyle(userId: string): string | null {
    if (this.actingUserId !== userId) {
      return null;
    }

    const progress = this.turnProgressFor(userId);
    const degrees = `${Math.round(progress * 360)}deg`;
    return `conic-gradient(from -90deg, rgba(108, 255, 176, 0.98) 0deg ${degrees}, rgba(108, 255, 176, 0.18) ${degrees} 360deg)`;
  }
}
