import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { LeaderboardEntry, LeaderboardSnapshot } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { GameCatalogService } from '../../../core/services/game-catalog.service';
import { LeaderboardService } from '../../../core/services/leaderboard.service';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';

type LobbyTheme = 'roulette' | 'blackjack' | 'poker' | 'miner' | 'crash' | 'slots' | 'ochko' | 'mafia' | 'balatro';

interface LobbyGameCard {
  title: string;
  strapline: string;
  description: string;
  route: string;
  theme: LobbyTheme;
  players: number;
  queueCopy: string;
  badge: 'live' | 'new';
  previewImage?: string;
  desktopOnly?: boolean;
}

interface LobbyHighlightCard {
  key: 'richest' | 'mostLosses' | 'biggestWin';
  eyebrow: string;
  amount: number;
  icon: string;
}

@Component({
  selector: 'app-lobby-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CreditsPipe],
  templateUrl: './lobby.page.html',
  styleUrl: './lobby.page.scss'
})
export class LobbyPageComponent {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly leaderboardService = inject(LeaderboardService);
  private readonly gameCatalog = inject(GameCatalogService);
  private readonly refreshIntervalMs = 5 * 60 * 1000;

  readonly balance = computed(() => this.auth.currentUser()?.balance || 0);
  readonly currentUser = computed(() => this.auth.currentUser());
  readonly displayName = computed(() => this.currentUser()?.username || this.currentUser()?.email?.split('@')[0] || 'player');
  readonly userInitials = computed(() => this.initialsFor(this.displayName()));
  readonly leaderboard = signal<LeaderboardSnapshot | null>(null);
  readonly loadingLeaderboard = signal(true);
  readonly leaderboardError = signal('');
  readonly searchValue = signal('');

  readonly topNav = [
    { label: 'Lobby', route: '/lobby', exact: true },
    { label: 'Roulette', route: '/games/roulette', exact: false },
    { label: 'Blackjack', route: '/games/blackjack', exact: false },
    { label: 'Poker', route: '/games/poker', exact: false },
    { label: 'Mafia', route: '/games/mafia', exact: false }
  ] as const;

  readonly games: LobbyGameCard[] = [
    {
      title: 'Roulette',
      strapline: 'Round table · 408',
      description: 'Make a choice, watch the wheel spin, and see if luck lands on your side.',
      route: '/games/roulette',
      theme: 'roulette',
      players: 128,
      queueCopy: 'Starts in 00:15',
      badge: 'live',
      previewImage: '/lobby-icons/roulette.png'
    },
    {
      title: 'Blackjack',
      strapline: 'Table ready',
      description: 'Compete against the dealer to reach 21 without going over.',
      route: '/games/blackjack',
      theme: 'blackjack',
      players: 96,
      queueCopy: '96 in queue',
      badge: 'live',
      previewImage: '/lobby-icons/blackjack_cards.png'
    },
    {
      title: 'Poker',
      strapline: 'Join the table',
      description: "Texas Hold'em. May the best hand win.",
      route: '/games/poker',
      theme: 'poker',
      players: 256,
      queueCopy: '256 in queue',
      badge: 'live',
      previewImage: '/lobby-icons/poker_chip.png'
    },
    {
      title: 'Miner',
      strapline: '25-tile game',
      description: 'Uncover safe tiles, dodge the hidden mines, and cash out before the danger spikes.',
      route: '/games/miner',
      theme: 'miner',
      players: 75,
      queueCopy: 'Starts in 01:30',
      badge: 'live',
      previewImage: '/lobby-icons/miner.png'
    },
    {
      title: 'Crash',
      strapline: 'Fast game',
      description: 'Watch the multiplier climb in real time and bail out before it breaks.',
      route: '/games/crash',
      theme: 'crash',
      players: 200,
      queueCopy: 'Fast queue',
      badge: 'live',
      previewImage: '/lobby-icons/crash_chart.png'
    },
    {
      title: 'Slots',
      strapline: '3 reels',
      description: 'Spin and win in this neon slot room.',
      route: '/games/slots',
      theme: 'slots',
      players: 120,
      queueCopy: '3 reels live',
      badge: 'live',
      previewImage: '/lobby-icons/slots.png'
    },
    {
      title: 'Ochko',
      strapline: 'Card game',
      description: 'Five-card hidden-hand poker battle for 2-5 players with special wilds.',
      route: '/games/ochko',
      theme: 'ochko',
      players: 64,
      queueCopy: '2-5 seats'
      ,
      badge: 'new'
    },
    {
      title: 'Mafia',
      strapline: 'Social game',
      description: 'Deduction, deception, and persuasion. Find your allies and expose the mafia.',
      route: '/games/mafia',
      theme: 'mafia',
      players: 90,
      queueCopy: 'Private rooms',
      badge: 'new',
      previewImage: '/lobby-icons/mafia_hat.png'
    },
    {
      title: 'Balatro',
      strapline: 'Roguelike poker',
      description: 'Build impossible poker hands, stack wild jokers, and crush escalating blinds.',
      route: '/games/balatro',
      theme: 'balatro',
      players: 1,
      queueCopy: 'Solo run',
      badge: 'new',
      desktopOnly: true
    }
  ];

  readonly isPhone = signal(this.detectPhone());
  readonly visibleGames = computed(() => {
    const filtered = this.gameCatalog.visibleItems(this.games.map((game) => ({ ...game, gameId: game.theme })));
    const query = this.searchValue().trim().toLowerCase();

    if (!query) {
      return filtered;
    }

    return filtered.filter((game) =>
      [game.title, game.strapline, game.description].some((value) => value.toLowerCase().includes(query))
    );
  });
  readonly queueGames = computed(() => this.visibleGames().slice(0, 4));

  @HostListener('window:resize')
  onWindowResize(): void {
    this.isPhone.set(this.detectPhone());
  }

  isGameUnavailable(game: LobbyGameCard): boolean {
    return Boolean(game.desktopOnly && this.isPhone());
  }

  private detectPhone(): boolean {
    return typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) <= 600;
  }
  readonly topHighlights = computed<LobbyHighlightCard[]>(() => {
    const board = this.leaderboard();
    return [
      { key: 'richest', eyebrow: 'Most money', amount: board?.richest[0]?.metricValue || 0, icon: '◫' },
      { key: 'mostLosses', eyebrow: 'Most losses', amount: board?.mostLosses[0]?.metricValue || 0, icon: '⌁' },
      { key: 'biggestWin', eyebrow: 'Biggest win', amount: board?.biggestWin[0]?.metricValue || 0, icon: '◈' }
    ];
  });

  constructor() {
    void this.gameCatalog.ensureLoaded();
    void this.refreshLeaderboard();

    const refreshTimer = window.setInterval(() => {
      void this.refreshLeaderboard();
    }, this.refreshIntervalMs);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(refreshTimer);
    });
  }

  async refreshLeaderboard(): Promise<void> {
    if (!this.leaderboard()) {
      this.loadingLeaderboard.set(true);
    }

    this.leaderboardError.set('');

    try {
      this.leaderboard.set(await this.leaderboardService.getLeaderboard());
    } catch {
      this.leaderboardError.set('Could not load the leaderboard right now.');
    } finally {
      this.loadingLeaderboard.set(false);
    }
  }

  initialsFor(value: string): string {
    return value
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'HB';
  }

  compactNumber(value: number): string {
    return Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value || 0);
  }

  badgeLabel(game: LobbyGameCard): string {
    return game.badge === 'new' ? 'NEW' : 'LIVE';
  }
}
