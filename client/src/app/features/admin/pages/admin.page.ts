import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';

import { AdminService } from '../../../core/services/admin.service';
import type { AdminCardDeck, GameHistoryRecord, User } from '../../../core/models/user.model';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameLabelPipe } from '../../../shared/pipes/game-label.pipe';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [AppButtonComponent, AppCardComponent, AppInputComponent, CreditsPipe, DatePipe, GameLabelPipe],
  templateUrl: './admin.page.html',
  styleUrl: './admin.page.scss'
})
export class AdminPageComponent {
  private readonly adminService = inject(AdminService);

  readonly users = signal<User[]>([]);
  readonly cardDecks = signal<AdminCardDeck[]>([]);
  readonly loading = signal(true);
  readonly deckLoading = signal(true);
  readonly historyLoading = signal(false);
  readonly error = signal('');
  readonly deckError = signal('');
  readonly deckNotice = signal('');
  readonly query = signal('');
  readonly savingUserId = signal<string | null>(null);
  readonly savingDeckId = signal<string | null>(null);
  readonly selectedUser = signal<User | null>(null);
  readonly selectedHistory = signal<GameHistoryRecord[]>([]);
  readonly balanceDrafts = signal<Record<string, string>>({});
  readonly deckNameDrafts = signal<Record<string, string>>({});
  readonly deckPriceDrafts = signal<Record<string, string>>({});
  readonly deckBackImageDrafts = signal<Record<string, string>>({});
  readonly deckFaceTemplateDrafts = signal<Record<string, string>>({});
  readonly deckEnabledDrafts = signal<Record<string, boolean>>({});
  readonly importDeckId = signal('');
  readonly importDeckName = signal('');
  readonly importDeckPrice = signal('1200');
  readonly importDeckBackImage = signal('');
  readonly importDeckFaceTemplate = signal('/cards/{suit}_{rank}.png');
  readonly importDeckEnabled = signal(true);

  readonly filteredUsers = computed(() => {
    const query = this.query().trim().toLowerCase();

    if (!query) {
      return this.users();
    }

    return this.users().filter((user) =>
      [user.email, user.username || ''].some((value) => value.toLowerCase().includes(query))
    );
  });
  readonly totalBalance = computed(() => this.users().reduce((sum, user) => sum + user.balance, 0));
  readonly adminCount = computed(() => this.users().filter((user) => user.isAdmin).length);
  readonly enabledDeckCount = computed(() => this.cardDecks().filter((deck) => deck.enabled).length);

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.deckLoading.set(true);
    this.error.set('');
    this.deckError.set('');
    this.deckNotice.set('');

    try {
      const [users, cardDecks] = await Promise.all([this.adminService.listUsers(), this.adminService.listCardDecks()]);
      this.users.set(users);
      this.cardDecks.set(cardDecks);
      this.balanceDrafts.set(Object.fromEntries(users.map((user) => [user.id, String(user.balance)])));
      this.deckNameDrafts.set(Object.fromEntries(cardDecks.map((deck) => [deck.id, deck.name])));
      this.deckPriceDrafts.set(Object.fromEntries(cardDecks.map((deck) => [deck.id, String(deck.price)])));
      this.deckBackImageDrafts.set(Object.fromEntries(cardDecks.map((deck) => [deck.id, deck.backImageUrl])));
      this.deckFaceTemplateDrafts.set(Object.fromEntries(cardDecks.map((deck) => [deck.id, deck.faceImageTemplate])));
      this.deckEnabledDrafts.set(Object.fromEntries(cardDecks.map((deck) => [deck.id, deck.enabled])));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to load admin users.');
    } finally {
      this.loading.set(false);
      this.deckLoading.set(false);
    }
  }

  draftBalance(userId: string): string {
    return this.balanceDrafts()[userId] || '';
  }

  setDraftBalance(userId: string, value: string): void {
    this.balanceDrafts.update((drafts) => ({
      ...drafts,
      [userId]: value
    }));
  }

  async saveBalance(user: User): Promise<void> {
    const nextBalance = Number(this.draftBalance(user.id));

    if (!Number.isInteger(nextBalance) || nextBalance < 0) {
      this.error.set('Balance must be a non-negative whole number.');
      return;
    }

    this.savingUserId.set(user.id);
    this.error.set('');

    try {
      const updated = await this.adminService.setBalance(user.id, nextBalance);
      this.users.update((users) => users.map((entry) => (entry.id === user.id ? updated : entry)));

      if (this.selectedUser()?.id === user.id) {
        this.selectedUser.set(updated);
        await this.refreshSelectedUserHistory(user.id);
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to update user balance.');
    } finally {
      this.savingUserId.set(null);
    }
  }

  async selectUser(user: User): Promise<void> {
    this.selectedUser.set(user);
    await this.refreshSelectedUserHistory(user.id);
  }

  private async refreshSelectedUserHistory(userId: string): Promise<void> {
    this.historyLoading.set(true);
    this.error.set('');

    try {
      this.selectedHistory.set(await this.adminService.getUserHistory(userId));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to load user history.');
    } finally {
      this.historyLoading.set(false);
    }
  }

  isAdminAdjustment(entry: GameHistoryRecord): boolean {
    return entry.gameType === 'ADMIN' || entry.result === 'ADMIN_ADJUSTMENT';
  }

  draftDeckName(deckId: string): string {
    return this.deckNameDrafts()[deckId] || '';
  }

  setDraftDeckName(deckId: string, value: string): void {
    this.deckNameDrafts.update((drafts) => ({ ...drafts, [deckId]: value }));
  }

  draftDeckPrice(deckId: string): string {
    return this.deckPriceDrafts()[deckId] || '';
  }

  setDraftDeckPrice(deckId: string, value: string): void {
    this.deckPriceDrafts.update((drafts) => ({ ...drafts, [deckId]: value }));
  }

  draftDeckBackImage(deckId: string): string {
    return this.deckBackImageDrafts()[deckId] || '';
  }

  setDraftDeckBackImage(deckId: string, value: string): void {
    this.deckBackImageDrafts.update((drafts) => ({ ...drafts, [deckId]: value }));
  }

  draftDeckFaceTemplate(deckId: string): string {
    return this.deckFaceTemplateDrafts()[deckId] || '/cards/{suit}_{rank}.png';
  }

  setDraftDeckFaceTemplate(deckId: string, value: string): void {
    this.deckFaceTemplateDrafts.update((drafts) => ({ ...drafts, [deckId]: value }));
  }

  draftDeckEnabled(deckId: string): boolean {
    return this.deckEnabledDrafts()[deckId] ?? true;
  }

  setDraftDeckEnabled(deckId: string, value: boolean): void {
    this.deckEnabledDrafts.update((drafts) => ({ ...drafts, [deckId]: value }));
  }

  async saveDeck(deck: AdminCardDeck): Promise<void> {
    this.savingDeckId.set(deck.id);
    this.deckError.set('');
    this.deckNotice.set('');

    try {
      const saved = await this.adminService.importCardDeck({
        id: deck.id,
        name: this.draftDeckName(deck.id),
        price: Number(this.draftDeckPrice(deck.id)),
        backImageUrl: this.draftDeckBackImage(deck.id),
        faceImageTemplate: this.draftDeckFaceTemplate(deck.id),
        enabled: this.draftDeckEnabled(deck.id)
      });

      this.cardDecks.update((decks) => decks.map((entry) => (entry.id === deck.id ? saved : entry)));
      this.deckNotice.set(`Deck ${saved.name} saved.`);
    } catch (error) {
      this.deckError.set(error instanceof Error ? error.message : 'Failed to save deck.');
    } finally {
      this.savingDeckId.set(null);
    }
  }

  async importDeck(): Promise<void> {
    this.savingDeckId.set('import');
    this.deckError.set('');
    this.deckNotice.set('');

    try {
      const imported = await this.adminService.importCardDeck({
        id: this.importDeckId(),
        name: this.importDeckName(),
        price: Number(this.importDeckPrice()),
        backImageUrl: this.importDeckBackImage(),
        faceImageTemplate: this.importDeckFaceTemplate(),
        enabled: this.importDeckEnabled()
      });

      const nextDecks = this.cardDecks().filter((deck) => deck.id !== imported.id);
      this.cardDecks.set([...nextDecks, imported].sort((left, right) => Number(right.enabled) - Number(left.enabled)));
      this.deckNameDrafts.update((drafts) => ({ ...drafts, [imported.id]: imported.name }));
      this.deckPriceDrafts.update((drafts) => ({ ...drafts, [imported.id]: String(imported.price) }));
      this.deckBackImageDrafts.update((drafts) => ({ ...drafts, [imported.id]: imported.backImageUrl }));
      this.deckFaceTemplateDrafts.update((drafts) => ({ ...drafts, [imported.id]: imported.faceImageTemplate }));
      this.deckEnabledDrafts.update((drafts) => ({ ...drafts, [imported.id]: imported.enabled }));
      this.importDeckId.set('');
      this.importDeckName.set('');
      this.importDeckPrice.set('1200');
      this.importDeckBackImage.set('');
      this.importDeckFaceTemplate.set('/cards/{suit}_{rank}.png');
      this.importDeckEnabled.set(true);
      this.deckNotice.set(`Deck ${imported.name} imported.`);
    } catch (error) {
      this.deckError.set(error instanceof Error ? error.message : 'Failed to import deck.');
    } finally {
      this.savingDeckId.set(null);
    }
  }

  async setDefaultDeck(deck: AdminCardDeck): Promise<void> {
    this.savingDeckId.set(`default:${deck.id}`);
    this.deckError.set('');
    this.deckNotice.set('');

    try {
      const updatedDefault = await this.adminService.setDefaultCardDeck(deck.id);
      this.cardDecks.update((decks) =>
        decks
          .map((entry) =>
            entry.id === updatedDefault.id
              ? updatedDefault
              : {
                  ...entry,
                  isDefault: false
                }
          )
          .sort((left, right) => Number(right.enabled) - Number(left.enabled))
      );
      this.deckNotice.set(`Deck ${updatedDefault.name} is now the standard deck.`);
    } catch (error) {
      this.deckError.set(error instanceof Error ? error.message : 'Failed to change the standard deck.');
    } finally {
      this.savingDeckId.set(null);
    }
  }
}
