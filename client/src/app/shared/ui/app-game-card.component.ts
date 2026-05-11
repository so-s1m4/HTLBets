import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppCardComponent } from './app-card.component';
import { AppButtonComponent } from './app-button.component';

@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [RouterLink, AppCardComponent, AppButtonComponent],
  templateUrl: './app-game-card.component.html',
  styleUrl: './app-game-card.component.scss'
})
export class AppGameCardComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() route = '/lobby';
  @Input() badge = 'Demo';
  @Input() availability = 'Available now';
  @Input() theme: 'roulette' | 'blackjack' | 'poker' | 'miner' | 'slots' | 'leaderboard' = 'roulette';
}
