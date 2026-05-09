import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { CardDeckService } from '../../../core/services/card-deck.service';
import { DailyRewardsService } from '../../../core/services/daily-rewards.service';
import { GameSocketService } from '../../../core/services/game-socket.service';
import { HistoryService } from '../../../core/services/history.service';
import type { CardDeck, DailyTask, GameHistoryRecord, LeaderboardEntry, LeaderboardSnapshot, ProfileLeaderboardTag } from '../../../core/models/user.model';

import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameLabelPipe } from '../../../shared/pipes/game-label.pipe';
import { ProfileSummaryComponent } from '../components/profile-summary.component';
import { LeaderboardService } from '../../../core/services/leaderboard.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    AppButtonComponent,
    AppCardComponent,
    AppInputComponent,
    CreditsPipe,
    DatePipe,
    GameLabelPipe,
    ProfileSummaryComponent,
    RouterLink
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss'
})
export class ProfilePageComponent {
  readonly auth = inject(AuthService);

  private readonly router = inject(Router);
  private readonly cardDeckService = inject(CardDeckService);
  private readonly dailyRewardsService = inject(DailyRewardsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly historyService = inject(HistoryService);
  private readonly leaderboardService = inject(LeaderboardService);
  private readonly socket = inject(GameSocketService);
  private readonly refreshIntervalMs = 5 * 60 * 1000;

  readonly history = signal<GameHistoryRecord[]>([]);
  readonly dailyTasks = signal<DailyTask[]>([]);
  readonly cardDecks = signal<CardDeck[]>([]);
  readonly leaderboard = signal<LeaderboardSnapshot | null>(null);
  readonly loading = signal(true);
  readonly loadingDailies = signal(true);
  readonly loadingDecks = signal(true);
  readonly dailyTasksCollapsed = signal(false);
  readonly historyCollapsed = signal(false);
  readonly claimingTaskKey = signal<string | null>(null);
  readonly dailyError = signal('');
  readonly dailyNotice = signal('');
  readonly savingUsername = signal(false);
  readonly savingAvatar = signal(false);
  readonly profileError = signal('');
  readonly profileNotice = signal('');
  readonly deckNotice = signal('');
  readonly deckError = signal('');
  readonly deckActionId = signal<string | null>(null);
  readonly usernameDraft = signal('');
  readonly avatarUrlDraft = signal('');
  readonly usernameDirty = signal(false);
  readonly avatarDirty = signal(false);
  readonly currentPage = signal(1);
  readonly pageSize = 10;
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.history().length / this.pageSize)));
  readonly paginatedHistory = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.history().slice(start, start + this.pageSize);
  });
  readonly canPreviousPage = computed(() => this.currentPage() > 1);
  readonly canNextPage = computed(() => this.currentPage() < this.totalPages());
  readonly leaderboardTags = computed<ProfileLeaderboardTag[]>(() => {
    const userId = this.auth.currentUser()?.id;
    const leaderboard = this.leaderboard();

    if (!userId || !leaderboard) {
      return [];
    }

    return [
      this.buildLeaderboardTag('richest', 'Most Money', leaderboard.richest, userId),
      this.buildLeaderboardTag('mostLosses', 'Most Losses', leaderboard.mostLosses, userId),
      this.buildLeaderboardTag('biggestWin', 'Biggest Win', leaderboard.biggestWin, userId)
    ].filter((tag): tag is ProfileLeaderboardTag => tag !== null);
  });
  private lastSyncedUsername = '';
  private lastSyncedAvatarUrl = '';

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      const nextUsername = user?.username || '';
      const nextAvatarUrl = user?.avatarUrl || '';

      if (nextUsername !== this.lastSyncedUsername && !this.usernameDirty()) {
        this.lastSyncedUsername = nextUsername;
        this.usernameDraft.set(nextUsername);
      }

      if (nextAvatarUrl !== this.lastSyncedAvatarUrl && !this.avatarDirty()) {
        this.lastSyncedAvatarUrl = nextAvatarUrl;
        this.avatarUrlDraft.set(nextAvatarUrl);
      }
    });
    void this.refresh();

    const refreshTimer = window.setInterval(() => {
      void this.refreshLeaderboard();
    }, this.refreshIntervalMs);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(refreshTimer);
    });
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.loadingDailies.set(true);
    this.loadingDecks.set(true);

    try {
      const [history, dailyTasks, cardDecks] = await Promise.all([
        this.historyService.getHistory(),
        this.dailyRewardsService.getTasks(),
        this.cardDeckService.listMine()
      ]);
      this.history.set(history);
      this.dailyTasks.set(dailyTasks);
      this.cardDecks.set(cardDecks);
      this.currentPage.set(1);
    } finally {
      this.loading.set(false);
      this.loadingDailies.set(false);
      this.loadingDecks.set(false);
    }
  }

  async claimDailyTask(taskKey: string): Promise<void> {
    this.claimingTaskKey.set(taskKey);
    this.dailyError.set('');
    this.dailyNotice.set('');

    try {
      const response = await this.dailyRewardsService.claimTask(taskKey);
      this.auth.updateBalance(response.user.balance);
      this.dailyTasks.update((tasks) =>
        tasks.map((task) => (task.key === taskKey ? { ...task, claimed: true } : task))
      );
      this.dailyNotice.set(`Claimed ${response.task.reward} credits.`);
    } catch (error) {
      this.dailyError.set(error instanceof Error ? error.message : 'Failed to claim daily reward.');
    } finally {
      this.claimingTaskKey.set(null);
    }
  }

  async refreshLeaderboard(): Promise<void> {
    try {
      this.leaderboard.set(await this.leaderboardService.getLeaderboard());
    } catch {
      // Keep the existing snapshot or empty state. Profile tags are non-critical UI.
    }
  }

  async logout(): Promise<void> {
    this.socket.disconnect();
    this.auth.logout();
    await this.router.navigate(['/auth/email']);
  }

  async saveUsername(): Promise<void> {
    this.savingUsername.set(true);
    this.profileError.set('');
    this.profileNotice.set('');

    try {
      const user = await this.auth.updateProfile({
        username: this.usernameDraft()
      });
      const savedUsername = user.username || '';
      this.lastSyncedUsername = savedUsername;
      this.usernameDraft.set(savedUsername);
      this.usernameDirty.set(false);
      this.profileNotice.set('Username updated.');
    } catch (error) {
      this.profileError.set(error instanceof Error ? error.message : 'Failed to update username.');
    } finally {
      this.savingUsername.set(false);
    }
  }

  async saveAvatar(): Promise<void> {
    this.savingAvatar.set(true);
    this.profileError.set('');
    this.profileNotice.set('');

    try {
      const user = await this.auth.updateProfile({
        avatarUrl: this.avatarUrlDraft().trim() || null
      });
      const savedAvatarUrl = user.avatarUrl || '';
      this.lastSyncedAvatarUrl = savedAvatarUrl;
      this.avatarUrlDraft.set(savedAvatarUrl);
      this.avatarDirty.set(false);
      this.profileNotice.set('Profile picture updated.');
    } catch (error) {
      this.profileError.set(error instanceof Error ? error.message : 'Failed to update profile picture.');
    } finally {
      this.savingAvatar.set(false);
    }
  }

  async clearAvatar(): Promise<void> {
    this.avatarUrlDraft.set('');
    this.avatarDirty.set(true);
    await this.saveAvatar();
  }

  setUsernameDraft(value: string): void {
    this.usernameDirty.set(true);
    this.usernameDraft.set(value);
  }

  setAvatarUrlDraft(value: string): void {
    this.avatarDirty.set(true);
    this.avatarUrlDraft.set(value);
  }

  async purchaseDeck(deckId: string): Promise<void> {
    this.deckActionId.set(deckId);
    this.deckError.set('');
    this.deckNotice.set('');

    try {
      const response = await this.cardDeckService.purchase(deckId);
      this.cardDecks.set(response.decks);
      this.auth.updateBalance(response.user.balance);
      await this.auth.loadCurrentUser();
      this.deckNotice.set('Card deck purchased.');
    } catch (error) {
      this.deckError.set(error instanceof Error ? error.message : 'Failed to buy card deck.');
    } finally {
      this.deckActionId.set(null);
    }
  }

  async selectDeck(deckId: string): Promise<void> {
    this.deckActionId.set(deckId);
    this.deckError.set('');
    this.deckNotice.set('');

    try {
      const response = await this.cardDeckService.select(deckId);
      this.cardDecks.set(response.decks);
      this.auth.updateBalance(response.user.balance);
      await this.auth.loadCurrentUser();
      this.deckNotice.set('Card deck selected.');
    } catch (error) {
      this.deckError.set(error instanceof Error ? error.message : 'Failed to select card deck.');
    } finally {
      this.deckActionId.set(null);
    }
  }

  goToPreviousPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1));
  }

  goToNextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1));
  }

  toggleDailyTasksCollapsed(): void {
    this.dailyTasksCollapsed.update((value) => !value);
  }

  toggleHistoryCollapsed(): void {
    this.historyCollapsed.update((value) => !value);
  }

  isAdminAdjustment(entry: GameHistoryRecord): boolean {
    return entry.gameType === 'ADMIN' || entry.result === 'ADMIN_ADJUSTMENT';
  }

  private buildLeaderboardTag(
    _kind: 'richest' | 'mostLosses' | 'biggestWin',
    label: string,
    entries: LeaderboardEntry[],
    userId: string
  ): ProfileLeaderboardTag | null {
    const rank = entries.findIndex((entry) => entry.userId === userId);

    if (rank === -1 || rank >= 10) {
      return null;
    }

    const placement = rank + 1;

    return {
      label: `#${placement} ${label}`,
      tier: this.rankTier(placement)
    };
  }

  private rankTier(rank: number): ProfileLeaderboardTag['tier'] {
    if (rank === 1) {
      return 'champion';
    }

    if (rank <= 5) {
      return 'elite';
    }

    return 'contender';
  }
}
