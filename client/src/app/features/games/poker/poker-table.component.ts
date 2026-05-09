import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import type { PokerDisplayCard, PokerSeatView, PokerWinnerView } from '../../../core/models/game.model';

interface PositionedSeat {
  seat: PokerSeatView;
  left: number;
  top: number;
}

const orbitLayouts: Record<number, Array<{ left: number; top: number }>> = {
  1: [{ left: 50, top: 20 }],
  2: [
    { left: 30, top: 20 },
    { left: 70, top: 20 },
  ],
  3: [
    { left: 10, top: 48 },
    { left: 50, top: 20 },
    { left: 90, top: 48 },
  ],
  4: [
    { left: 20, top: 77 },
    { left: 30, top: 20 },
    { left: 70, top: 20 },
    { left: 80, top: 77 }
  ],
  5: [
    { left: 10, top: 48 },
    { left: 30, top: 20 },
    { left: 50, top: 25 },
    { left: 70, top: 20 },
    { left: 90, top: 48 },
  ],
  6: [
    { left: 20, top: 77 },
    { left: 10, top: 48 },
    { left: 30, top: 20 },
    { left: 70, top: 20 },
    { left: 90, top: 48 },
    { left: 80, top: 77 }
  ],
  7: [
    { left: 20, top: 77 },
    { left: 10, top: 48 },
    { left: 30, top: 20 },
    { left: 50, top: 25 },
    { left: 70, top: 20 },
    { left: 90, top: 48 },
    { left: 80, top: 77 }
  ],
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
  @Input() tableCardBackAsset = '/cards/back_dark.png';
  @Input() tableCardFaceTemplate = '/cards/{suit}_{rank}.png';
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

  cardAsset(card: PokerDisplayCard, template = '/cards/{suit}_{rank}.png'): string {
    const rank = card.rank || '';
    const suit = card.suit || '';
    const suitShort = this.suitShort(suit);

    return template
      .replaceAll('{rank}', rank)
      .replaceAll('{suit}', suit)
      .replaceAll('{suitShort}', suitShort);
  }

  private suitShort(suit: string): string {
    switch (suit) {
      case 'clubs':
        return 'C';
      case 'spades':
        return 'S';
      case 'hearts':
        return 'H';
      case 'diamonds':
        return 'D';
      default:
        return '';
    }
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
