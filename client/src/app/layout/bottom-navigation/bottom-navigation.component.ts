import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { GameCatalogService } from '../../core/services/game-catalog.service';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './bottom-navigation.component.html',
  styleUrl: './bottom-navigation.component.scss'
})
export class BottomNavigationComponent {
  private readonly auth = inject(AuthService);
  private readonly gameCatalog = inject(GameCatalogService);

  readonly items = computed(() => {
    const isAdmin = Boolean(this.auth.currentUser()?.isAdmin);
    const visibleGames = this.gameCatalog.visibleItems([
      { label: 'Roulette', route: '/games/roulette', icon: '◎', exact: false, featured: false, gameId: 'roulette' as const },
      { label: 'Mafia', route: '/games/mafia', icon: '◉', exact: false, featured: false, gameId: 'mafia' as const }
    ]);
    const rouletteItem = visibleGames.find((item) => item.gameId === 'roulette') || null;
    const mafiaItem = visibleGames.find((item) => item.gameId === 'mafia') || null;

    return [
      { label: 'Lobby', route: '/lobby', icon: '⌂', exact: true, featured: false },
      ...(rouletteItem ? [rouletteItem] : []),
      { label: 'Vault', route: '/games/leaderboard', icon: '◈', exact: false, featured: true },
      { label: 'Profile', route: '/profile', icon: '◌', exact: true, featured: false },
      isAdmin
        ? { label: 'Admin', route: '/admin', icon: '◍', exact: true, featured: false }
        : mafiaItem
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  });

  constructor() {
    void this.gameCatalog.ensureLoaded();
    effect(() => {
      document.documentElement.style.setProperty('--nav-count', String(this.items().length));
    });
  }
}
