import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';
import { NgClass } from '@angular/common';

interface DisplayCard {
  hidden?: boolean;
  rank?: string;
  suit?: string;
}

@Component({
  selector: 'app-blackjack-hand',
  imports: [NgClass],
  standalone: true,
  templateUrl: './blackjack-hand.component.html',
  styleUrl: './blackjack-hand.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlackjackHandComponent {
  @Input() label = '';
  @Input() score = 0;
  @Input() cards: DisplayCard[] = [];
  @Input() caption = '';
  @HostBinding('class.hidden')
  @Input() hidden = false;

  @Input() isDealer = false;
  @HostBinding('class.active')
  @Input() active = false;

  isHidden(card: DisplayCard): boolean {
    return Boolean(card.hidden);
  }

  trackCard(index: number, card: DisplayCard): string {
    return `${index}:${card.rank || '?'}:${card.suit || '?'}:${card.hidden ? 'hidden' : 'visible'}`;
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
        return 'red';
      case 'clubs':
      case 'spades':
        return 'black';
      default:
        return 'black';
    }
  }
}
