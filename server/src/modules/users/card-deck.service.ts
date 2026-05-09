import { GameType } from '../../../generated/prisma';
import { prisma } from '../../prisma/client';
import { HttpError } from '../../utils/http-error';
import { toPublicUser, type PublicUser } from './user.model';

export const DEFAULT_CARD_DECK_ID = 'classic-dark';

export interface PublicCardDeck {
  id: string;
  name: string;
  price: number;
  backImageUrl: string;
  faceImageTemplate: string;
  enabled: boolean;
  owned: boolean;
  selected: boolean;
}

export interface AdminCardDeck {
  id: string;
  name: string;
  price: number;
  backImageUrl: string;
  faceImageTemplate: string;
  enabled: boolean;
  purchaseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CardDeckInput {
  id: string;
  name: string;
  price: number;
  backImageUrl: string;
  faceImageTemplate: string;
  enabled: boolean;
}

const normalizeDeckId = (value: unknown): string => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalized || normalized.length < 3 || normalized.length > 40) {
    throw new HttpError(400, 'Deck id must be between 3 and 40 characters and use only letters, numbers, and dashes.');
  }

  return normalized;
};

const normalizeDeckName = (value: unknown): string => {
  const normalized = String(value || '').trim();

  if (!normalized || normalized.length < 2 || normalized.length > 48) {
    throw new HttpError(400, 'Deck name must be between 2 and 48 characters long.');
  }

  return normalized;
};

const normalizeDeckPrice = (value: unknown): number => {
  const price = Number(value);

  if (!Number.isInteger(price) || price < 0) {
    throw new HttpError(400, 'Deck price must be a non-negative whole number.');
  }

  return price;
};

const normalizeDeckBackImageUrl = (value: unknown): string => {
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new HttpError(400, 'Deck image URL is required.');
  }

  if (normalized.startsWith('/')) {
    return normalized;
  }

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new HttpError(400, 'Deck image must be an absolute http(s) URL or a root-relative asset path.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new HttpError(400, 'Deck image URL must start with http:// or https://.');
  }

  return normalized;
};

const normalizeCardDeckInput = (payload?: Record<string, unknown>): CardDeckInput => ({
  id: normalizeDeckId(payload?.id),
  name: normalizeDeckName(payload?.name),
  price: normalizeDeckPrice(payload?.price),
  backImageUrl: normalizeDeckBackImageUrl(payload?.backImageUrl),
  faceImageTemplate: String(payload?.faceImageTemplate || '/cards/{suit}_{rank}.png').trim() || '/cards/{suit}_{rank}.png',
  enabled: payload?.enabled === undefined ? true : Boolean(payload.enabled)
});

const mapPublicCardDeck = (
  deck: { id: string; name: string; price: number; backImageUrl: string; faceImageTemplate: string; enabled: boolean },
  ownedDeckIds: Set<string>,
  selectedCardDeckId: string
): PublicCardDeck => ({
  id: deck.id,
  name: deck.name,
  price: deck.price,
  backImageUrl: deck.backImageUrl,
  faceImageTemplate: deck.faceImageTemplate,
  enabled: deck.enabled,
  owned: ownedDeckIds.has(deck.id),
  selected: selectedCardDeckId === deck.id
});

export class CardDeckService {
  async ensureDefaultOwnership(userId: string): Promise<void> {
    await prisma.userCardDeck.upsert({
      where: {
        userId_deckId: {
          userId,
          deckId: DEFAULT_CARD_DECK_ID
        }
      },
      update: {},
      create: {
        userId,
        deckId: DEFAULT_CARD_DECK_ID
      }
    });
  }

  async listForUser(userId: string): Promise<PublicCardDeck[]> {
    await this.ensureDefaultOwnership(userId);

    const [user, ownedEntries, decks] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          selectedCardDeckId: true
        }
      }),
      prisma.userCardDeck.findMany({
        where: { userId },
        select: { deckId: true }
      }),
      prisma.cardDeck.findMany({
        orderBy: [{ enabled: 'desc' }, { price: 'asc' }, { createdAt: 'asc' }]
      })
    ]);

    if (!user) {
      throw new HttpError(404, 'User was not found.');
    }

    const ownedDeckIds = new Set(ownedEntries.map((entry) => entry.deckId));
    ownedDeckIds.add(DEFAULT_CARD_DECK_ID);

    return decks
      .filter((deck) => deck.enabled || ownedDeckIds.has(deck.id) || user.selectedCardDeckId === deck.id)
      .map((deck) => mapPublicCardDeck(deck, ownedDeckIds, user.selectedCardDeckId));
  }

  async purchaseForUser(userId: string, deckId: string): Promise<{ user: PublicUser; decks: PublicCardDeck[] }> {
    await this.ensureDefaultOwnership(userId);

    const normalizedDeckId = normalizeDeckId(deckId);

    const [user, deck, existingOwnership] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId }
      }),
      prisma.cardDeck.findUnique({
        where: { id: normalizedDeckId }
      }),
      prisma.userCardDeck.findUnique({
        where: {
          userId_deckId: {
            userId,
            deckId: normalizedDeckId
          }
        }
      })
    ]);

    if (!user) {
      throw new HttpError(404, 'User was not found.');
    }

    if (!deck || !deck.enabled) {
      throw new HttpError(404, 'That card deck is not available.');
    }

    if (existingOwnership || deck.price === 0) {
      throw new HttpError(400, 'You already own that card deck.');
    }

    if (user.balance < deck.price) {
      throw new HttpError(400, 'Insufficient demo balance to buy that card deck.');
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            decrement: deck.price
          }
        }
      });

      await tx.userCardDeck.create({
        data: {
          userId,
          deckId: deck.id
        }
      });

      await tx.gameHistory.create({
        data: {
          userId,
          gameType: GameType.ADMIN,
          betAmount: deck.price,
          result: 'CARD_DECK_PURCHASE',
          balanceChange: -deck.price
        }
      });

      return nextUser;
    });

    return {
      user: toPublicUser(updatedUser),
      decks: await this.listForUser(userId)
    };
  }

  async selectForUser(userId: string, deckId: string): Promise<{ user: PublicUser; decks: PublicCardDeck[] }> {
    await this.ensureDefaultOwnership(userId);

    const normalizedDeckId = normalizeDeckId(deckId);
    const [deck, ownership] = await Promise.all([
      prisma.cardDeck.findUnique({
        where: { id: normalizedDeckId }
      }),
      prisma.userCardDeck.findUnique({
        where: {
          userId_deckId: {
            userId,
            deckId: normalizedDeckId
          }
        }
      })
    ]);

    if (!deck) {
      throw new HttpError(404, 'That card deck was not found.');
    }

    if (normalizedDeckId !== DEFAULT_CARD_DECK_ID && !ownership) {
      throw new HttpError(400, 'Buy that card deck before selecting it.');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        selectedCardDeckId: normalizedDeckId
      }
    });

    return {
      user: toPublicUser(updatedUser),
      decks: await this.listForUser(userId)
    };
  }

  async listForAdmin(): Promise<AdminCardDeck[]> {
    const decks = await prisma.cardDeck.findMany({
      include: {
        _count: {
          select: {
            owners: true
          }
        }
      },
      orderBy: [{ enabled: 'desc' }, { createdAt: 'asc' }]
    });

    return decks.map((deck) => ({
      id: deck.id,
      name: deck.name,
      price: deck.price,
      backImageUrl: deck.backImageUrl,
      faceImageTemplate: deck.faceImageTemplate,
      enabled: deck.enabled,
      purchaseCount: deck._count.owners,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt
    }));
  }

  async importForAdmin(payload?: Record<string, unknown>): Promise<AdminCardDeck> {
    const input = normalizeCardDeckInput(payload);

    const deck = await prisma.cardDeck.upsert({
      where: { id: input.id },
      update: {
        name: input.name,
        price: input.price,
        backImageUrl: input.backImageUrl,
        faceImageTemplate: input.faceImageTemplate,
        enabled: input.enabled
      },
      create: input,
      include: {
        _count: {
          select: {
            owners: true
          }
        }
      }
    });

    return {
      id: deck.id,
      name: deck.name,
      price: deck.price,
      backImageUrl: deck.backImageUrl,
      faceImageTemplate: deck.faceImageTemplate,
      enabled: deck.enabled,
      purchaseCount: deck._count.owners,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt
    };
  }
}

export const cardDeckService = new CardDeckService();
