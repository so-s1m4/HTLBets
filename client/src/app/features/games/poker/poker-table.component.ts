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
  templateUrl: './poker-table.component.html',
  styleUrl: './poker-table.component.scss'
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
