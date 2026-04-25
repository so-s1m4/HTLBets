import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import type { GameHistoryRecord } from '../models/user.model';
import { AppConfigService } from './app-config.service';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  async getHistory(): Promise<GameHistoryRecord[]> {
    return firstValueFrom(this.http.get<GameHistoryRecord[]>(`${this.config.apiUrl}/history`));
  }
}
