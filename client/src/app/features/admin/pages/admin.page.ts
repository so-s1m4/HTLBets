import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';

import { AdminService } from '../../../core/services/admin.service';
import type { GameHistoryRecord, User } from '../../../core/models/user.model';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameLabelPipe } from '../../../shared/pipes/game-label.pipe';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [AppButtonComponent, AppCardComponent, AppInputComponent, CreditsPipe, DatePipe, GameLabelPipe],
  templateUrl: './admin.page.html',
  styleUrl: './admin.page.scss'
})
export class AdminPageComponent {
  private readonly adminService = inject(AdminService);

  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly historyLoading = signal(false);
  readonly error = signal('');
  readonly query = signal('');
  readonly savingUserId = signal<string | null>(null);
  readonly selectedUser = signal<User | null>(null);
  readonly selectedHistory = signal<GameHistoryRecord[]>([]);
  readonly balanceDrafts = signal<Record<string, string>>({});

  readonly filteredUsers = computed(() => {
    const query = this.query().trim().toLowerCase();

    if (!query) {
      return this.users();
    }

    return this.users().filter((user) =>
      [user.email, user.username || ''].some((value) => value.toLowerCase().includes(query))
    );
  });
  readonly totalBalance = computed(() => this.users().reduce((sum, user) => sum + user.balance, 0));
  readonly adminCount = computed(() => this.users().filter((user) => user.isAdmin).length);

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const users = await this.adminService.listUsers();
      this.users.set(users);
      this.balanceDrafts.set(Object.fromEntries(users.map((user) => [user.id, String(user.balance)])));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to load admin users.');
    } finally {
      this.loading.set(false);
    }
  }

  draftBalance(userId: string): string {
    return this.balanceDrafts()[userId] || '';
  }

  setDraftBalance(userId: string, value: string): void {
    this.balanceDrafts.update((drafts) => ({
      ...drafts,
      [userId]: value
    }));
  }

  async saveBalance(user: User): Promise<void> {
    const nextBalance = Number(this.draftBalance(user.id));

    if (!Number.isInteger(nextBalance) || nextBalance < 0) {
      this.error.set('Balance must be a non-negative whole number.');
      return;
    }

    this.savingUserId.set(user.id);
    this.error.set('');

    try {
      const updated = await this.adminService.setBalance(user.id, nextBalance);
      this.users.update((users) => users.map((entry) => (entry.id === user.id ? updated : entry)));

      if (this.selectedUser()?.id === user.id) {
        this.selectedUser.set(updated);
        await this.refreshSelectedUserHistory(user.id);
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to update user balance.');
    } finally {
      this.savingUserId.set(null);
    }
  }

  async selectUser(user: User): Promise<void> {
    this.selectedUser.set(user);
    await this.refreshSelectedUserHistory(user.id);
  }

  private async refreshSelectedUserHistory(userId: string): Promise<void> {
    this.historyLoading.set(true);
    this.error.set('');

    try {
      this.selectedHistory.set(await this.adminService.getUserHistory(userId));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to load user history.');
    } finally {
      this.historyLoading.set(false);
    }
  }

  isAdminAdjustment(entry: GameHistoryRecord): boolean {
    return entry.gameType === 'ADMIN' || entry.result === 'ADMIN_ADJUSTMENT';
  }
}
