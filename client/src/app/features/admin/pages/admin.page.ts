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
  template: `
    <div class="page-stack">
      <app-card tone="accent">
        <div class="admin-hero">
          <div class="page-heading">
            <span class="page-heading__eyebrow">Admin Control</span>
            <h1>Balance and user operations</h1>
            <p class="status-copy">
              Manage demo balances, inspect user accounts, and review recent game history from one protected control panel.
            </p>
          </div>

          <div class="glass-stat-grid">
            <div class="glass-stat">
              <span class="glass-stat__label">Users</span>
              <strong class="glass-stat__value">{{ filteredUsers().length }}</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Total credits</span>
              <strong class="glass-stat__value">{{ totalBalance() | credits }}</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Admins</span>
              <strong class="glass-stat__value">{{ adminCount() }}</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">History view</span>
              <strong class="glass-stat__value">{{ selectedUser()?.email || 'None' }}</strong>
            </div>
          </div>
        </div>
      </app-card>

      <app-card tone="muted">
        <div class="admin-toolbar">
          <app-input
            label="Search users"
            helper="Filter by email or username."
            [value]="query()"
            (valueChange)="query.set($event)"
          />
          <app-button variant="secondary" (click)="refresh()" [disabled]="loading()">Refresh</app-button>
        </div>
      </app-card>

      @if (error()) {
        <app-card tone="muted">
          <p class="status-copy text-danger">{{ error() }}</p>
        </app-card>
      }

      <div class="admin-grid">
        <div class="page-stack">
          @if (loading()) {
            <app-card tone="muted">
              <p class="status-copy">Loading users...</p>
            </app-card>
          } @else {
            @for (user of filteredUsers(); track user.id) {
              <app-card>
                <div class="admin-user-card">
                  <div class="admin-user-card__header">
                    <div class="page-heading">
                      <span class="page-heading__eyebrow">{{ user.isAdmin ? 'Administrator' : 'Player' }}</span>
                      <h3>{{ user.email }}</h3>
                      <p class="status-copy">Created {{ user.createdAt | date: 'mediumDate' }}</p>
                    </div>
                    <span class="pill">{{ user.balance | credits }}</span>
                  </div>

                  <div class="admin-user-card__controls">
                    <app-input
                      label="Set balance"
                      inputMode="numeric"
                      [value]="draftBalance(user.id)"
                      (valueChange)="setDraftBalance(user.id, $event.replace(/\\D/g, ''))"
                    />

                    <div class="admin-user-card__actions">
                      <app-button variant="secondary" (click)="selectUser(user)">View history</app-button>
                      <app-button (click)="saveBalance(user)">
                        {{ savingUserId() === user.id ? 'Saving...' : 'Apply balance' }}
                      </app-button>
                    </div>
                  </div>
                </div>
              </app-card>
            }
          }
        </div>

        <app-card tone="muted">
          <div class="page-stack">
            <div class="utility-row">
              <div class="page-heading">
                <span class="page-heading__eyebrow">User History</span>
                <h2>{{ selectedUser()?.email || 'Select a user' }}</h2>
              </div>
              @if (selectedUser()) {
                <span class="pill">{{ selectedHistory().length }} entries</span>
              }
            </div>

            @if (historyLoading()) {
              <p class="status-copy">Loading history...</p>
            } @else if (!selectedUser()) {
              <p class="status-copy">Choose a user from the list to inspect recent rounds.</p>
            } @else if (selectedHistory().length === 0) {
              <p class="status-copy">No history recorded for this user yet.</p>
            } @else {
              <div class="admin-history">
                @for (entry of selectedHistory(); track entry.id) {
                  <div class="admin-history__item">
                    <div>
                      <strong>{{ entry.gameType | gameLabel }}</strong>
                      <p class="status-copy">{{ entry.createdAt | date: 'medium' }}</p>
                    </div>
                    <div class="admin-history__values">
                      <span class="pill">{{ entry.betAmount | credits }}</span>
                      <span [class]="entry.balanceChange >= 0 ? 'text-success' : 'text-danger'">
                        {{ entry.balanceChange | credits }}
                      </span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </app-card>
      </div>
    </div>
  `,
  styles: [`
    .admin-hero,
    .admin-toolbar,
    .admin-user-card,
    .admin-history {
      display: grid;
      gap: 1rem;
    }

    .admin-toolbar {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
    }

    .admin-grid {
      display: grid;
      gap: 1rem;
    }

    .admin-user-card__header,
    .admin-user-card__actions,
    .admin-history__item,
    .admin-history__values {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .admin-user-card__controls {
      display: grid;
      gap: 0.9rem;
    }

    .admin-history__item {
      padding: 0.95rem 1rem;
      border-radius: var(--radius-md);
      border: 1px solid rgba(149, 171, 211, 0.12);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(16, 23, 36, 0.98), rgba(11, 17, 27, 0.98));
    }

    .admin-history__item strong,
    .admin-history__item p {
      margin: 0;
    }

    @media (min-width: 980px) {
      .admin-grid {
        grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.9fr);
        align-items: start;
      }
    }

    @media (max-width: 640px) {
      .admin-toolbar {
        grid-template-columns: 1fr;
      }

      .admin-user-card__actions {
        flex-direction: column;
      }
    }
  `]
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
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to update user balance.');
    } finally {
      this.savingUserId.set(null);
    }
  }

  async selectUser(user: User): Promise<void> {
    this.selectedUser.set(user);
    this.historyLoading.set(true);
    this.error.set('');

    try {
      this.selectedHistory.set(await this.adminService.getUserHistory(user.id));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to load user history.');
    } finally {
      this.historyLoading.set(false);
    }
  }
}
