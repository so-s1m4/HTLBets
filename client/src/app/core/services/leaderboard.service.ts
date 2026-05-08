import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import type { LeaderboardSnapshot } from '../models/user.model';
import { AppConfigService } from './app-config.service';

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  async getLeaderboard(): Promise<LeaderboardSnapshot> {
    return firstValueFrom(this.http.get<LeaderboardSnapshot>(`${this.config.apiUrl}/leaderboard`));
  }
}
