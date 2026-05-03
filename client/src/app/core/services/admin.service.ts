import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import type { GameHistoryRecord, User } from '../models/user.model';
import { AppConfigService } from './app-config.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  listUsers(): Promise<User[]> {
    return firstValueFrom(this.http.get<User[]>(`${this.config.apiUrl}/admin/users`));
  }

  getUserHistory(userId: string): Promise<GameHistoryRecord[]> {
    return firstValueFrom(this.http.get<GameHistoryRecord[]>(`${this.config.apiUrl}/admin/users/${userId}/history`));
  }

  setBalance(userId: string, balance: number): Promise<User> {
    return firstValueFrom(this.http.patch<User>(`${this.config.apiUrl}/admin/users/${userId}/balance`, { balance }));
  }
}
