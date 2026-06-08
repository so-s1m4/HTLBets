import { prisma } from '../../../prisma/client';
import { HttpError } from '../../../utils/http-error';

export type GameCatalogId = 'roulette' | 'blackjack' | 'poker' | 'miner' | 'crash' | 'slots' | 'ochko' | 'mafia' | 'balatro';
export type RealtimeGameCatalogId = Exclude<GameCatalogId, 'mafia' | 'balatro'>;

export interface PublicGameCatalogEntry {
  id: GameCatalogId;
  name: string;
  enabled: boolean;
}

export interface AdminGameCatalogEntry extends PublicGameCatalogEntry {
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const GAME_CATALOG_SEED: Array<{ id: GameCatalogId; name: string; sortOrder: number }> = [
  { id: 'roulette', name: 'Roulette', sortOrder: 10 },
  { id: 'blackjack', name: 'Blackjack', sortOrder: 20 },
  { id: 'poker', name: 'Poker', sortOrder: 30 },
  { id: 'miner', name: 'Miner', sortOrder: 40 },
  { id: 'crash', name: 'Crash', sortOrder: 50 },
  { id: 'slots', name: 'Slots', sortOrder: 60 },
  { id: 'ochko', name: 'Ochko', sortOrder: 70 },
  { id: 'mafia', name: 'Mafia', sortOrder: 80 },
  { id: 'balatro', name: 'Balatro', sortOrder: 90 }
];

const GAME_CATALOG_BY_ID = new Map(GAME_CATALOG_SEED.map((entry) => [entry.id, entry]));

export const toRealtimeGameCatalogId = (value: string): RealtimeGameCatalogId => {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'roulette' || normalized === 'blackjack' || normalized === 'poker' || normalized === 'miner' || normalized === 'crash' || normalized === 'slots' || normalized === 'ochko') {
    return normalized;
  }

  throw new HttpError(400, `Unsupported realtime game catalog id: ${value}`);
};

class GameCatalogService {
  async listPublic(): Promise<PublicGameCatalogEntry[]> {
    await this.ensureSeeded();

    const entries = await prisma.gameCatalogEntry.findMany({
      orderBy: {
        sortOrder: 'asc'
      }
    });

    return entries.map((entry) => ({
      id: entry.id as GameCatalogId,
      name: entry.name,
      enabled: entry.enabled
    }));
  }

  async listForAdmin(): Promise<AdminGameCatalogEntry[]> {
    await this.ensureSeeded();

    const entries = await prisma.gameCatalogEntry.findMany({
      orderBy: {
        sortOrder: 'asc'
      }
    });

    return entries.map((entry) => ({
      id: entry.id as GameCatalogId,
      name: entry.name,
      enabled: entry.enabled,
      sortOrder: entry.sortOrder,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }));
  }

  async setEnabled(gameId: string, enabled: boolean): Promise<AdminGameCatalogEntry> {
    const normalizedId = this.requireGameId(gameId);
    await this.ensureSeeded();

    const entry = await prisma.gameCatalogEntry.update({
      where: {
        id: normalizedId
      },
      data: {
        enabled
      }
    });

    return {
      id: entry.id as GameCatalogId,
      name: entry.name,
      enabled: entry.enabled,
      sortOrder: entry.sortOrder,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    };
  }

  async assertEnabled(gameId: string): Promise<void> {
    const normalizedId = this.requireGameId(gameId);
    await this.ensureSeeded();

    const entry = await prisma.gameCatalogEntry.findUnique({
      where: {
        id: normalizedId
      }
    });

    if (!entry?.enabled) {
      throw new HttpError(403, `${GAME_CATALOG_BY_ID.get(normalizedId)?.name || 'This game'} is currently unavailable.`);
    }
  }

  private async ensureSeeded(): Promise<void> {
    await prisma.gameCatalogEntry.createMany({
      data: GAME_CATALOG_SEED.map((entry) => ({
        id: entry.id,
        name: entry.name,
        sortOrder: entry.sortOrder,
        enabled: true
      })),
      skipDuplicates: true
    });
  }

  private requireGameId(value: string): GameCatalogId {
    const normalized = value.trim().toLowerCase() as GameCatalogId;

    if (!GAME_CATALOG_BY_ID.has(normalized)) {
      throw new HttpError(400, `Unsupported game id: ${value}`);
    }

    return normalized;
  }
}

export const gameCatalogService = new GameCatalogService();
