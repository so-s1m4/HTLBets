import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import type { ApiMessage, VerifyCodeResponse } from '../models/auth.model';
import type { User } from '../models/user.model';
import { AppConfigService } from './app-config.service';

const tokenStorageKey = 'htl-bets.access-token';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  readonly token = signal<string | null>(this.readStoredToken());
  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => Boolean(this.token()));

  constructor() {
    if (this.token()) {
      void this.loadCurrentUser();
    }
  }

  async requestCode(email: string): Promise<ApiMessage> {
    return firstValueFrom(
      this.http.post<ApiMessage>(`${this.config.apiUrl}/auth/request-code`, { email })
    );
  }

  async verifyCode(email: string, code: string): Promise<VerifyCodeResponse> {
    const response = await firstValueFrom(
      this.http.post<VerifyCodeResponse>(`${this.config.apiUrl}/auth/verify-code`, {
        email,
        code
      })
    );

    this.setSession(response.accessToken, response.user);
    return response;
  }

  async loadCurrentUser(): Promise<User | null> {
    if (!this.token()) {
      return null;
    }

    try {
      const user = await firstValueFrom(this.http.get<User>(`${this.config.apiUrl}/me`));
      this.currentUser.set(user);
      return user;
    } catch {
      this.clearSession();
      return null;
    }
  }

  updateBalance(balance: number): void {
    this.currentUser.update((user) => (user ? { ...user, balance } : user));
  }

  logout(): void {
    this.clearSession();
  }

  private readStoredToken(): string | null {
    return localStorage.getItem(tokenStorageKey);
  }

  private setSession(token: string, user: User): void {
    localStorage.setItem(tokenStorageKey, token);
    this.token.set(token);
    this.currentUser.set(user);
  }

  private clearSession(): void {
    localStorage.removeItem(tokenStorageKey);
    this.token.set(null);
    this.currentUser.set(null);
  }
}
