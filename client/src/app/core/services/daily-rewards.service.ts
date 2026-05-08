import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import type { DailyTask, DailyTaskClaimResponse } from '../models/user.model';
import { AppConfigService } from './app-config.service';

@Injectable({
  providedIn: 'root'
})
export class DailyRewardsService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  async getTasks(): Promise<DailyTask[]> {
    return firstValueFrom(this.http.get<DailyTask[]>(`${this.config.apiUrl}/me/dailies`));
  }

  async claimTask(taskKey: string): Promise<DailyTaskClaimResponse> {
    return firstValueFrom(this.http.post<DailyTaskClaimResponse>(`${this.config.apiUrl}/me/dailies/${taskKey}/claim`, {}));
  }
}
