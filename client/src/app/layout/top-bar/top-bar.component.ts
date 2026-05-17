import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { GameCatalogService } from '../../core/services/game-catalog.service';
import { CreditsPipe } from '../../shared/pipes/credits.pipe';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, CreditsPipe],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopBarComponent {
  readonly auth = inject(AuthService);
  private readonly gameCatalog = inject(GameCatalogService);
  private readonly gameNavItems = [
    { label: 'Roulette', route: '/games/roulette', exact: false, gameId: 'roulette' },
    { label: 'Blackjack', route: '/games/blackjack', exact: false, gameId: 'blackjack' },
    { label: 'Poker', route: '/games/poker', exact: false, gameId: 'poker' },
    { label: 'Mafia', route: '/games/mafia', exact: false, gameId: 'mafia' }
  ] as const;

  readonly navItems = computed(() => [
    { label: 'Lobby', route: '/lobby', exact: true },
    ...this.gameCatalog.visibleItems([...this.gameNavItems])
  ]);

  readonly displayName = computed(() => this.auth.currentUser()?.username || this.auth.currentUser()?.email?.split('@')[0] || 'player');
  readonly initials = computed(() => this.initialsFor(this.displayName()));

  constructor() {
    void this.gameCatalog.ensureLoaded();
  }

  initialsFor(value: string): string {
    return value
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'HB';
  }
}
