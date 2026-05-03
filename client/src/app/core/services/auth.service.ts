import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import type { ApiMessage, VerifyCodeResponse } from '../models/auth.model';
import type { User } from '../models/user.model';
import { AppConfigService } from './app-config.service';

const tokenStorageKey = 'htl-bets.access-token';
const userStorageKey = 'htl-bets.current-user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private restorePromise: Promise<User | null> | null = null;

  readonly token = signal<string | null>(this.readStoredToken());
  readonly currentUser = signal<User | null>(this.readStoredUser());
  readonly ready = signal(false);
  readonly isAuthenticated = computed(() => Boolean(this.token()));

  constructor() {
    if (this.token() && this.currentUser()) {
      this.ready.set(true);
      void this.loadCurrentUser();
    } else if (this.token()) {
      void this.restoreSession();
    } else {
      this.ready.set(true);
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
      this.ready.set(true);
      return null;
    }

    try {
      const user = await firstValueFrom(this.http.get<User>(`${this.config.apiUrl}/me`));
      this.persistUser(user);
      this.ready.set(true);
      return user;
    } catch (error) {
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        this.clearSession();
        return null;
      }

      if (this.currentUser()) {
        this.ready.set(true);
        return this.currentUser();
      }

      this.ready.set(true);
      return null;
    }
  }

  async restoreSession(): Promise<User | null> {
    if (this.ready() && this.currentUser()) {
      return this.currentUser();
    }

    if (this.restorePromise) {
      return this.restorePromise;
    }

    this.restorePromise = this.loadCurrentUser().finally(() => {
      this.restorePromise = null;
    });

    return this.restorePromise;
  }

  updateBalance(balance: number): void {
    const user = this.currentUser();

    if (!user) {
      return;
    }

    this.persistUser({
      ...user,
      balance
    });
  }

  logout(): void {
    this.clearSession();
  }

  private readStoredToken(): string | null {
    return localStorage.getItem(tokenStorageKey);
  }

  private readStoredUser(): User | null {
    const raw = localStorage.getItem(userStorageKey);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as User;
    } catch {
      localStorage.removeItem(userStorageKey);
      return null;
    }
  }

  private setSession(token: string, user: User): void {
    localStorage.setItem(tokenStorageKey, token);
    this.token.set(token);
    this.persistUser(user);
    this.ready.set(true);
  }

  private persistUser(user: User): void {
    localStorage.setItem(userStorageKey, JSON.stringify(user));
    this.currentUser.set(user);
  }

  private clearSession(): void {
    localStorage.removeItem(tokenStorageKey);
    localStorage.removeItem(userStorageKey);
    this.token.set(null);
    this.currentUser.set(null);
    this.ready.set(true);
  }
}
