import { Component, DestroyRef, computed, inject, signal } from '@angular/core';

import { AuthService } from '../../../core/services/auth.service';
import type { LeaderboardEntry, LeaderboardSnapshot } from '../../../core/models/user.model';
import { LeaderboardService } from '../../../core/services/leaderboard.service';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { AppGameCardComponent } from '../../../shared/ui/app-game-card.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { ComingSoonComponent } from '../components/coming-soon.component';

@Component({
  selector: 'app-lobby-page',
  standalone: true,
  imports: [AppGameCardComponent, AppCardComponent, ComingSoonComponent, CreditsPipe],
  templateUrl: './lobby.page.html',
  styleUrl: './lobby.page.scss'
})
export class LobbyPageComponent {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly leaderboardService = inject(LeaderboardService);
  private readonly refreshIntervalMs = 5 * 60 * 1000;

  readonly balance = computed(() => this.auth.currentUser()?.balance || 0);
  readonly email = computed(() => this.auth.currentUser()?.email || 'guest');
  readonly leaderboard = signal<LeaderboardSnapshot | null>(null);
  readonly loadingLeaderboard = signal(true);
  readonly leaderboardError = signal('');

  readonly games = [
    {
      title: 'Roulette',
      description: 'Make a choice watch the wheel spin to see if luck is on your side.',
      route: '/games/roulette',
      badge: 'Live',
      availability: 'Rounds every 40s',
      theme: 'roulette' as const
    },
    {
      title: 'Blackjack',
      description: 'Compete against the dealer to reach 21 without going bust.',
      route: '/games/blackjack',
      badge: 'Live',
      availability: 'Table ready',
      theme: 'blackjack' as const
    },
    {
      title: 'Poker',
      description: 'Texas Hold\'em. May the best hand win!',
      route: '/games/poker',
      badge: 'Live',
      availability: 'Join the Table',
      theme: 'poker' as const
    },
    {
      title: 'Miner',
      description: 'Uncover safe tiles, dodge the hidden mines, and cash out before greed blows up the round.',
      route: '/games/miner',
      badge: 'Live',
      availability: '25-tile board',
      theme: 'miner' as const
    },
    {
      title: 'Crash',
      description: 'Watch the multiplier climb in real time and bail out before the line snaps and wipes the round.',
      route: '/games/crash',
      badge: 'Live',
      availability: 'Time-based cashout',
      theme: 'crash' as const
    },
    {
      title: 'Slots',
      description: 'Eight different slot automats.',
      route: '/games/slots',
      badge: 'Live',
      availability: '8 automats',
      theme: 'slots' as const
    },
    {
      title: 'Ochko',
      description: 'Five-round hidden-card room battles for 2-5 players with spell cards, shifting score caps, and last-card mind games.',
      route: '/games/ochko',
      badge: 'New',
      availability: '2-5 room match',
      theme: 'ochko' as const
    }
  ];

  constructor() {
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

  leaderboardName(entry: LeaderboardEntry | null): string {
    if (!entry) {
      return 'No player yet';
    }

    return entry.username || entry.email;
  }

  leaderboardInitials(entry: LeaderboardEntry | null): string {
    const source = this.leaderboardName(entry);

    return source
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'HB';
  }

  topEntry(kind: 'richest' | 'mostLosses' | 'biggestWin'): LeaderboardEntry | null {
    const leaderboard = this.leaderboard();
    return leaderboard?.[kind]?.[0] || null;
  }
}
