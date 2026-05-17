import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import type {
  AdminCardDeck,
  AdminGameCatalogEntry,
  AdminUserCardDeck,
  AdminUserDeckMutationResponse,
  GameHistoryRecord,
  User
} from '../models/user.model';
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

  setUserBanState(userId: string, banned: boolean): Promise<User> {
    return firstValueFrom(this.http.post<User>(`${this.config.apiUrl}/admin/users/${userId}/ban`, { banned }));
  }

  wipeUser(userId: string): Promise<User> {
    return firstValueFrom(this.http.post<User>(`${this.config.apiUrl}/admin/users/${userId}/wipe`, {}));
  }

  deleteUser(userId: string): Promise<{ deletedUserId: string }> {
    return firstValueFrom(this.http.delete<{ deletedUserId: string }>(`${this.config.apiUrl}/admin/users/${userId}`));
  }

  listUserCardDecks(userId: string): Promise<AdminUserCardDeck[]> {
    return firstValueFrom(this.http.get<AdminUserCardDeck[]>(`${this.config.apiUrl}/admin/users/${userId}/card-decks`));
  }

  grantCardDeck(userId: string, deckId: string, options?: { select?: boolean }): Promise<AdminUserDeckMutationResponse> {
    return firstValueFrom(
      this.http.post<AdminUserDeckMutationResponse>(`${this.config.apiUrl}/admin/users/${userId}/card-decks/${deckId}/grant`, {
        select: Boolean(options?.select)
      })
    );
  }

  listCardDecks(): Promise<AdminCardDeck[]> {
    return firstValueFrom(this.http.get<AdminCardDeck[]>(`${this.config.apiUrl}/admin/card-decks`));
  }

  listGames(): Promise<AdminGameCatalogEntry[]> {
    return firstValueFrom(this.http.get<AdminGameCatalogEntry[]>(`${this.config.apiUrl}/admin/games`));
  }

  setGameEnabled(gameId: string, enabled: boolean): Promise<AdminGameCatalogEntry> {
    return firstValueFrom(this.http.patch<AdminGameCatalogEntry>(`${this.config.apiUrl}/admin/games/${gameId}`, { enabled }));
  }

  importCardDeck(input: {
    id: string;
    name: string;
    price: number;
    backImageUrl: string;
    faceImageTemplate: string;
    enabled: boolean;
  }): Promise<AdminCardDeck> {
    return firstValueFrom(this.http.post<AdminCardDeck>(`${this.config.apiUrl}/admin/card-decks/import`, input));
  }

  setDefaultCardDeck(deckId: string): Promise<AdminCardDeck> {
    return firstValueFrom(this.http.post<AdminCardDeck>(`${this.config.apiUrl}/admin/card-decks/${deckId}/default`, {}));
  }
}
