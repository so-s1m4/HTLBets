import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { GameCatalogEntry } from '../models/user.model';
import { AppConfigService } from './app-config.service';

export type GameCatalogId = GameCatalogEntry['id'];

const DEFAULT_GAME_CATALOG: GameCatalogEntry[] = [
  { id: 'roulette', name: 'Roulette', enabled: true },
  { id: 'blackjack', name: 'Blackjack', enabled: true },
  { id: 'poker', name: 'Poker', enabled: true },
  { id: 'miner', name: 'Miner', enabled: true },
  { id: 'crash', name: 'Crash', enabled: true },
  { id: 'slots', name: 'Slots', enabled: true },
  { id: 'ochko', name: 'Ochko', enabled: true },
  { id: 'mafia', name: 'Mafia', enabled: true },
  { id: 'balatro', name: 'Balatro', enabled: true }
];

@Injectable({
  providedIn: 'root'
})
export class GameCatalogService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly router = inject(Router);

  private readonly entries = signal<GameCatalogEntry[]>(DEFAULT_GAME_CATALOG);
  private readonly loaded = signal(false);
  private pendingLoad: Promise<GameCatalogEntry[]> | null = null;

  readonly catalog = computed(() => this.entries());
  readonly enabledIds = computed(() => new Set(this.entries().filter((entry) => entry.enabled).map((entry) => entry.id)));

  async ensureLoaded(force = false): Promise<GameCatalogEntry[]> {
    if (this.loaded() && !force) {
      return this.entries();
    }

    if (this.pendingLoad && !force) {
      return this.pendingLoad;
    }

    const request = firstValueFrom(this.http.get<GameCatalogEntry[]>(`${this.config.apiUrl}/game-catalog`))
      .then((entries) => {
        this.entries.set(entries.length ? entries : DEFAULT_GAME_CATALOG);
        this.loaded.set(true);
        this.pendingLoad = null;
        return this.entries();
      })
      .catch((error) => {
        this.pendingLoad = null;
        throw error;
      });

    this.pendingLoad = request;
    return request;
  }

  isEnabledSync(gameId: GameCatalogId): boolean {
    return this.enabledIds().has(gameId);
  }

  async isEnabled(gameId: GameCatalogId): Promise<boolean> {
    const catalog = await this.ensureLoaded();
    return catalog.some((entry) => entry.id === gameId && entry.enabled);
  }

  visibleItems<T extends { gameId: GameCatalogId }>(items: T[]): T[] {
    const enabledIds = this.enabledIds();
    return items.filter((item) => enabledIds.has(item.gameId));
  }

  async redirectIfDisabled(gameId: GameCatalogId): Promise<boolean> {
    if (await this.isEnabled(gameId)) {
      return false;
    }

    await this.router.navigateByUrl('/lobby');
    return true;
  }
}
