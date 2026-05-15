import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import type { PokerDisplayCard, PokerSeatView, PokerWinnerView } from '../../../core/models/game.model';
import { MediaStreamDirective } from '../../../shared/directives/media-stream.directive';
import type { PokerSeatMediaView } from './poker-media.service';

interface PositionedSeat {
  seat: PokerSeatView;
  left: number;
  top: number;
  avatarInitial: string;
  turnRingStyle: string | null;
  cards: RenderCard[];
}

interface RenderCard extends PokerDisplayCard {
  asset: string;
  key: string;
  animationDelay: string;
}

interface SelfSeatView {
  seat: PokerSeatView;
  avatarInitial: string;
  turnRingStyle: string | null;
  cards: RenderCard[];
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
  imports: [MediaStreamDirective],
  templateUrl: './poker-table.component.html',
  styleUrl: './poker-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PokerTableComponent {
  private seatsValue: PokerSeatView[] = [];
  selfSeatView: SelfSeatView | null = null;
  orbitSeatViews: PositionedSeat[] = [];
  private communityCardsValue: PokerDisplayCard[] = [];
  boardCardViews: RenderCard[] = [];
  private actingUserIdValue: string | null = null;
  private actingCountdownMsValue = 0;
  private actingTurnDurationMsValue = 20_000;

  @Input() tableName = 'Realtime poker';
  @Input() phase = 'waiting';
  @Input() pot = 0;
  @Input() currentBet = 0;
  @Input() tableCardBackAsset = '/cards/back_dark.png';
  @Input() tableCardFaceTemplate = '/cards/{suit}_{rank}.png';
  @Input() seatMedia: Record<string, PokerSeatMediaView> = {};

  @Input()
  set actingUserId(value: string | null) {
    this.actingUserIdValue = value;
    this.rebuildSeatViews();
  }

  get actingUserId(): string | null {
    return this.actingUserIdValue;
  }

  @Input()
  set actingCountdownMs(value: number) {
    this.actingCountdownMsValue = value;
    this.rebuildSeatViews();
  }

  get actingCountdownMs(): number {
    return this.actingCountdownMsValue;
  }

  @Input()
  set actingTurnDurationMs(value: number) {
    this.actingTurnDurationMsValue = value;
    this.rebuildSeatViews();
  }

  get actingTurnDurationMs(): number {
    return this.actingTurnDurationMsValue;
  }

  @Input()
  set seats(value: PokerSeatView[]) {
    this.seatsValue = value || [];
    this.rebuildSeatViews();
  }

  get seats(): PokerSeatView[] {
    return this.seatsValue;
  }

  @Input()
  set communityCards(value: PokerDisplayCard[]) {
    this.communityCardsValue = value || [];
    this.rebuildBoardCards();
  }

  get communityCards(): PokerDisplayCard[] {
    return this.communityCardsValue;
  }

  @Input() winners: PokerWinnerView[] | null = null;

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

  mediaFor(userId: string): PokerSeatMediaView | null {
    return this.seatMedia[userId] || null;
  }

  hasLiveCamera(userId: string): boolean {
    return Boolean(this.mediaFor(userId)?.cameraEnabled);
  }

  hasLiveAudio(userId: string): boolean {
    return Boolean(this.mediaFor(userId)?.audioEnabled);
  }

  turnProgressFor(userId: string): number {
    if (this.actingUserIdValue !== userId || this.actingTurnDurationMsValue <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(1, this.actingCountdownMsValue / this.actingTurnDurationMsValue));
  }

  turnRingStyle(userId: string): string | null {
    if (this.actingUserIdValue !== userId) {
      return null;
    }

    const progress = this.turnProgressFor(userId);
    const degrees = `${Math.round(progress * 360)}deg`;
    return `conic-gradient(from -90deg, rgba(108, 255, 176, 0.98) 0deg ${degrees}, rgba(108, 255, 176, 0.18) ${degrees} 360deg)`;
  }

  private rebuildSeatViews(): void {
    const selfSeat = this.seatsValue.find((seat) => seat.isSelf) || null;
    this.selfSeatView = selfSeat
      ? {
          seat: selfSeat,
          avatarInitial: this.avatarInitial(selfSeat.playerLabel),
          turnRingStyle: this.turnRingStyle(selfSeat.userId),
          cards: this.buildRenderCards(selfSeat.cards, selfSeat.cardFaceTemplate, 240)
        }
      : null;

    const others = this.seatsValue.filter((seat) => !seat.isSelf);
    const layout = orbitLayouts[others.length] || orbitLayouts[7];
    this.orbitSeatViews = others.map((seat, index) => ({
      seat,
      left: layout[index]?.left || 50,
      top: layout[index]?.top || 12,
      avatarInitial: this.avatarInitial(seat.playerLabel),
      turnRingStyle: this.turnRingStyle(seat.userId),
      cards: this.buildRenderCards(seat.cards, seat.cardFaceTemplate, 180)
    }));
  }

  private rebuildBoardCards(): void {
    const cards = [...this.communityCardsValue];
    while (cards.length < 5) {
      cards.push({ hidden: true });
    }

    this.boardCardViews = this.buildRenderCards(cards, this.tableCardFaceTemplate, 100);
  }

  private buildRenderCards(cards: PokerDisplayCard[], template: string, baseDelay: number): RenderCard[] {
    return cards.map((card, index) => ({
      ...card,
      asset: this.resolveCardAsset(card, template),
      key: `${index}:${card.rank || '?'}:${card.suit || '?'}:${card.hidden ? 'hidden' : 'visible'}`,
      animationDelay: `${baseDelay + index * 90}ms`
    }));
  }

  private resolveCardAsset(card: PokerDisplayCard, template = '/cards/{suit}_{rank}.png'): string {
    const rank = card.rank || '';
    const suit = card.suit || '';
    const suitShort = this.suitShort(suit);

    return template
      .replaceAll('{rank}', rank)
      .replaceAll('{suit}', suit)
      .replaceAll('{suitShort}', suitShort);
  }
}
