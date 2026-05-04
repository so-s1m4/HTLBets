import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';

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
    ProfileSummaryComponent,
    RouterLink
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss'
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
