import { Component, computed, inject } from '@angular/core';

import { AuthService } from '../../../core/services/auth.service';
import { AppGameCardComponent } from '../../../shared/ui/app-game-card.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppBalanceBadgeComponent } from '../../../shared/ui/app-balance-badge.component';
import { ComingSoonComponent } from '../components/coming-soon.component';

@Component({
  selector: 'app-lobby-page',
  standalone: true,
  imports: [AppGameCardComponent, AppCardComponent, AppBalanceBadgeComponent, ComingSoonComponent],
  templateUrl: './lobby.page.html',
  styleUrl: './lobby.page.scss'
})
export class LobbyPageComponent {
  private readonly auth = inject(AuthService);

  readonly balance = computed(() => this.auth.currentUser()?.balance || 0);
  readonly email = computed(() => this.auth.currentUser()?.email || 'guest');

  readonly games = [
    {
      title: 'Roulette',
      description: 'Choose a color or a specific number and watch the wheel spin to see if luck is on your side.',
      route: '/games/roulette',
      badge: 'Live',
      availability: 'Rounds every 40s',
      theme: 'roulette' as const
    },
    {
      title: 'Blackjack',
      description: 'Classic hit, stand, and double actions. Compete against the dealer to reach 21 without going bust.',
      route: '/games/blackjack',
      badge: 'Live',
      availability: 'Table ready',
      theme: 'blackjack' as const
    },
    {
      title: 'Poker',
      description: 'Texas Hold\'em style poker where you can bet, raise, or fold against other players. May the best hand win!',
      route: '/games/poker',
      badge: 'Live',
      availability: 'Join the Table',
      theme: 'poker' as const
    }
  ];
}
