import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';
import { NgClass } from '@angular/common';

interface DisplayCard {
  hidden?: boolean;
  rank?: string;
  suit?: string;
}

interface RenderCard extends DisplayCard {
  asset: string;
  key: string;
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
  private cardsValue: DisplayCard[] = [];
  renderCardViews: RenderCard[] = [];
  private backImageUrlValue = '/cards/back_dark.png';
  private faceImageTemplateValue = '/cards/{suit}_{rank}.png';

  @Input() label = '';
  @Input() score = 0;
  @Input()
  set cards(value: DisplayCard[]) {
    this.cardsValue = value || [];
    this.rebuildRenderCards();
  }

  get cards(): DisplayCard[] {
    return this.cardsValue;
  }
  @Input() caption = '';
  @Input()
  set backImageUrl(value: string) {
    this.backImageUrlValue = value || '/cards/back_dark.png';
  }

  get backImageUrl(): string {
    return this.backImageUrlValue;
  }

  @Input()
  set faceImageTemplate(value: string) {
    this.faceImageTemplateValue = value || '/cards/{suit}_{rank}.png';
    this.rebuildRenderCards();
  }

  get faceImageTemplate(): string {
    return this.faceImageTemplateValue;
  }
  @HostBinding('class.hidden')
  @Input() hidden = false;

  @Input() isDealer = false;
  @HostBinding('class.active')
  @Input() active = false;

  private cardAsset(card: DisplayCard): string {
    const rank = card.rank || '';
    const suit = card.suit || '';
    const suitShort = this.suitShort(suit);

    return this.faceImageTemplateValue
      .replaceAll('{rank}', rank)
      .replaceAll('{suit}', suit)
      .replaceAll('{suitShort}', suitShort);
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

  private rebuildRenderCards(): void {
    this.renderCardViews = this.cardsValue.map((card, index) => ({
      ...card,
      asset: this.cardAsset(card),
      key: `${index}:${card.rank || '?'}:${card.suit || '?'}:${card.hidden ? 'hidden' : 'visible'}`
    }));
  }
}
