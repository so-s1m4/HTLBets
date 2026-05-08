import { Component, DestroyRef, computed, inject, signal } from '@angular/core';

import type { LeaderboardEntry, LeaderboardSnapshot } from '../../../core/models/user.model';
import { LeaderboardService } from '../../../core/services/leaderboard.service';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { AppCardComponent } from '../../../shared/ui/app-card.component';

@Component({
  selector: 'app-leaderboard-page',
  standalone: true,
  imports: [AppCardComponent, CreditsPipe],
  templateUrl: './leaderboard.page.html',
  styleUrl: './leaderboard.page.scss'
})
export class LeaderboardPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly leaderboardService = inject(LeaderboardService);
  private readonly refreshIntervalMs = 5 * 60 * 1000;

  readonly leaderboard = signal<LeaderboardSnapshot | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedLeaderboard = signal<'richest' | 'mostLosses' | 'biggestWin'>('richest');
  readonly selectedEntries = computed(() => {
    const leaderboard = this.leaderboard();

    if (!leaderboard) {
      return [];
    }

    return leaderboard[this.selectedLeaderboard()] || [];
  });
  readonly leaderboardTitle = computed(() => {
    switch (this.selectedLeaderboard()) {
      case 'mostLosses':
        return 'Most Losses';
      case 'biggestWin':
        return 'Biggest Win';
      default:
        return 'Most Money';
    }
  });

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
      this.loading.set(true);
    }

    this.error.set('');

    try {
      this.leaderboard.set(await this.leaderboardService.getLeaderboard());
    } catch {
      this.error.set('Could not load the leaderboard right now.');
    } finally {
      this.loading.set(false);
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
}
