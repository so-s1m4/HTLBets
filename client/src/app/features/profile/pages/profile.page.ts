import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { GameSocketService } from '../../../core/services/game-socket.service';
import { HistoryService } from '../../../core/services/history.service';
import type { GameHistoryRecord } from '../../../core/models/user.model';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameLabelPipe } from '../../../shared/pipes/game-label.pipe';
import { ProfileSummaryComponent } from '../components/profile-summary.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    AppButtonComponent,
    AppCardComponent,
    CreditsPipe,
    DatePipe,
    GameLabelPipe,
    ProfileSummaryComponent
  ],
  template: `
    <div class="page-stack">
      <app-profile-summary
        [email]="auth.currentUser()?.email || 'Unknown user'"
        [balance]="auth.currentUser()?.balance || 0"
      />

      <app-card tone="muted">
        <div class="page-stack">
          <div class="utility-row">
            <div class="page-heading">
              <span class="page-heading__eyebrow">History</span>
              <h2>Session history</h2>
            </div>

            <app-button variant="secondary" (click)="refresh()">Refresh</app-button>
          </div>

          @if (loading()) {
            <p class="status-copy">Loading history...</p>
          } @else if (history().length === 0) {
            <p class="status-copy">No rounds recorded yet. Jump into the lobby and play a demo game.</p>
          } @else {
            <div class="history-list">
              @for (entry of history(); track entry.id) {
                <div class="history-list__item">
                  <div class="history-list__meta">
                    <strong>{{ entry.gameType | gameLabel }}</strong>
                    <p class="status-copy">{{ entry.createdAt | date: 'medium' }}</p>
                  </div>

                  <div class="history-list__numbers">
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

      <app-button variant="ghost" block (click)="logout()">Logout</app-button>
    </div>
  `,
  styles: [`
    .history-list {
      display: grid;
      gap: 0.85rem;
    }

    .history-list__item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border-radius: var(--radius-md);
      border: 1px solid rgba(149, 171, 211, 0.12);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(16, 23, 36, 0.98), rgba(11, 17, 27, 0.98));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .history-list__item strong,
    .history-list__item p {
      margin: 0;
    }

    .history-list__meta {
      display: grid;
      gap: 0.25rem;
    }

    .history-list__numbers {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
  `]
})
export class ProfilePageComponent {
  readonly auth = inject(AuthService);

  private readonly router = inject(Router);
  private readonly historyService = inject(HistoryService);
  private readonly socket = inject(GameSocketService);

  readonly history = signal<GameHistoryRecord[]>([]);
  readonly loading = signal(true);

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);

    try {
      this.history.set(await this.historyService.getHistory());
    } finally {
      this.loading.set(false);
    }
  }

  async logout(): Promise<void> {
    this.socket.disconnect();
    this.auth.logout();
    await this.router.navigate(['/auth/email']);
  }
}
