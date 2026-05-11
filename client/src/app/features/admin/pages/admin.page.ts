import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';

import { AdminService } from '../../../core/services/admin.service';
import type { AdminCardDeck, AdminUserCardDeck, GameHistoryRecord, User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameLabelPipe } from '../../../shared/pipes/game-label.pipe';

type AdminTabId = 'overview' | 'users' | 'history' | 'decks';
const MAX_BALANCE = 10_000_000_000_000;

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [AppButtonComponent, AppCardComponent, AppInputComponent, CreditsPipe, DatePipe, GameLabelPipe],
  templateUrl: './admin.page.html',
  styleUrl: './admin.page.scss'
})
export class AdminPageComponent {
  private readonly adminService = inject(AdminService);
  private readonly auth = inject(AuthService);

  readonly users = signal<User[]>([]);
  readonly cardDecks = signal<AdminCardDeck[]>([]);
  readonly selectedUserDecks = signal<AdminUserCardDeck[]>([]);
  readonly selectedHistory = signal<GameHistoryRecord[]>([]);

  readonly loading = signal(true);
  readonly deckLoading = signal(true);
  readonly historyLoading = signal(false);
  readonly userDeckLoading = signal(false);

  readonly error = signal('');
  readonly deckError = signal('');
  readonly deckNotice = signal('');
  readonly userDeckError = signal('');
  readonly userDeckNotice = signal('');
  readonly userNotice = signal('');

  readonly query = signal('');
  readonly activeTab = signal<AdminTabId>('overview');

  readonly savingUserId = signal<string | null>(null);
  readonly savingDeckId = signal<string | null>(null);
  readonly grantingDeckActionId = signal<string | null>(null);
  readonly moderationActionId = signal<string | null>(null);

  readonly selectedUser = signal<User | null>(null);

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
  readonly playerCount = computed(() => this.users().filter((user) => !user.isAdmin).length);
  readonly deckCount = computed(() => this.cardDecks().length);
  readonly enabledDeckCount = computed(() => this.cardDecks().filter((deck) => deck.enabled).length);
  readonly defaultDeck = computed(() => this.cardDecks().find((deck) => deck.isDefault) || null);
  readonly selectedDeck = computed(() => this.selectedUserDecks().find((deck) => deck.selected) || null);
  readonly selectedOwnedDeckCount = computed(() => this.selectedUserDecks().filter((deck) => deck.owned).length);
  readonly selectedGrantableDeckCount = computed(() => this.selectedUserDecks().filter((deck) => !deck.owned).length);
  readonly selectedRecentHistory = computed(() => this.selectedHistory().slice(0, 5));
  readonly tabs = computed(() => [
    { id: 'overview' as const, label: 'Overview', badge: `${this.users().length}` },
    { id: 'users' as const, label: 'Players', badge: `${this.playerCount()}` },
    { id: 'history' as const, label: 'History', badge: `${this.selectedHistory().length}` },
    { id: 'decks' as const, label: 'Deck Studio', badge: `${this.enabledDeckCount()}/${this.deckCount()}` }
  ]);

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.deckLoading.set(true);
    this.error.set('');
    this.deckError.set('');
    this.deckNotice.set('');
    this.userDeckError.set('');
    this.userDeckNotice.set('');
    this.userNotice.set('');

    try {
      const [users, cardDecks] = await Promise.all([this.adminService.listUsers(), this.adminService.listCardDecks()]);
      const currentSelectedUserId = this.selectedUser()?.id;
      const nextSelectedUser =
        users.find((user) => user.id === currentSelectedUserId) ||
        users.find((user) => !user.isAdmin) ||
        users[0] ||
        null;

      this.users.set(users);
      this.cardDecks.set(cardDecks);
      this.selectedUser.set(nextSelectedUser);
      this.balanceDrafts.set(Object.fromEntries(users.map((user) => [user.id, String(user.balance)])));
      this.deckNameDrafts.set(Object.fromEntries(cardDecks.map((deck) => [deck.id, deck.name])));
      this.deckPriceDrafts.set(Object.fromEntries(cardDecks.map((deck) => [deck.id, String(deck.price)])));
      this.deckBackImageDrafts.set(Object.fromEntries(cardDecks.map((deck) => [deck.id, deck.backImageUrl])));
      this.deckFaceTemplateDrafts.set(Object.fromEntries(cardDecks.map((deck) => [deck.id, deck.faceImageTemplate])));
      this.deckEnabledDrafts.set(Object.fromEntries(cardDecks.map((deck) => [deck.id, deck.enabled])));

      if (nextSelectedUser) {
        await Promise.all([
          this.refreshSelectedUserHistory(nextSelectedUser.id),
          this.refreshSelectedUserDecks(nextSelectedUser.id)
        ]);
      } else {
        this.selectedHistory.set([]);
        this.selectedUserDecks.set([]);
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to load admin users.');
    } finally {
      this.loading.set(false);
      this.deckLoading.set(false);
    }
  }

  setActiveTab(tab: AdminTabId): void {
    this.activeTab.set(tab);
  }

  userLabel(user: User | null): string {
    if (!user) {
      return 'No user selected';
    }

    return user.username?.trim() || user.email;
  }

  userInitials(user: User | null): string {
    const source = this.userLabel(user);
    const parts = source.split(/[\s@._-]+/).filter(Boolean);

    return (parts[0]?.[0] || source[0] || '?').toUpperCase();
  }

  isUserBanned(user: User | null): boolean {
    return Boolean(user?.bannedAt);
  }

  isProtectedUser(user: User | null): boolean {
    return Boolean(user?.isAdmin);
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

    if (nextBalance > MAX_BALANCE) {
      this.error.set(`Balance must not exceed ${MAX_BALANCE.toLocaleString('en-US')}.`);
      return;
    }

    this.savingUserId.set(user.id);
    this.error.set('');
    this.userNotice.set('');

    try {
      const updated = await this.adminService.setBalance(user.id, nextBalance);
      this.replaceUser(updated);

      if (this.auth.currentUser()?.id === updated.id) {
        this.auth.updateBalance(updated.balance);
      }

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
    this.userDeckError.set('');
    this.userDeckNotice.set('');
    this.userNotice.set('');

    await Promise.all([
      this.refreshSelectedUserHistory(user.id),
      this.refreshSelectedUserDecks(user.id)
    ]);
  }

  async openUserHistory(user: User): Promise<void> {
    this.activeTab.set('history');
    await this.selectUser(user);
  }

  async openUserWorkspace(user: User): Promise<void> {
    this.activeTab.set('users');
    await this.selectUser(user);
  }

  async grantDeckToSelected(deck: AdminUserCardDeck, select = false): Promise<void> {
    const user = this.selectedUser();

    if (!user) {
      return;
    }

    const actionId = `${select ? 'equip' : 'grant'}:${deck.id}`;
    this.grantingDeckActionId.set(actionId);
    this.userDeckError.set('');
    this.userDeckNotice.set('');

    try {
      const result = await this.adminService.grantCardDeck(user.id, deck.id, { select });
      this.replaceUser(result.user);
      this.selectedUser.set(result.user);
      this.selectedUserDecks.set(result.decks);
      this.userDeckNotice.set(
        select
          ? `${deck.name} is now equipped for ${this.userLabel(result.user)}.`
          : `${deck.name} granted to ${this.userLabel(result.user)}.`
      );
      await this.refreshSelectedUserHistory(user.id);
    } catch (error) {
      this.userDeckError.set(error instanceof Error ? error.message : 'Failed to grant card deck.');
    } finally {
      this.grantingDeckActionId.set(null);
    }
  }

  isDeckActionBusy(deckId: string, action: 'grant' | 'equip'): boolean {
    return this.grantingDeckActionId() === `${action}:${deckId}`;
  }

  isModerationBusy(action: 'ban' | 'wipe' | 'delete'): boolean {
    return this.moderationActionId() === action;
  }

  async toggleSelectedUserBan(): Promise<void> {
    const user = this.selectedUser();

    if (!user || this.isProtectedUser(user)) {
      return;
    }

    const nextBanned = !this.isUserBanned(user);
    this.moderationActionId.set('ban');
    this.error.set('');
    this.userNotice.set('');

    try {
      const updated = await this.adminService.setUserBanState(user.id, nextBanned);
      this.replaceUser(updated);
      this.selectedUser.set(updated);
      this.userNotice.set(nextBanned ? `${this.userLabel(updated)} has been suspended.` : `${this.userLabel(updated)} has been restored.`);
      await this.refreshSelectedUserHistory(updated.id);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to update ban state.');
    } finally {
      this.moderationActionId.set(null);
    }
  }

  async wipeSelectedUser(): Promise<void> {
    const user = this.selectedUser();

    if (!user || this.isProtectedUser(user)) {
      return;
    }

    this.moderationActionId.set('wipe');
    this.error.set('');
    this.userNotice.set('');
    this.userDeckNotice.set('');

    try {
      const updated = await this.adminService.wipeUser(user.id);
      this.replaceUser(updated);
      this.selectedUser.set(updated);
      this.userNotice.set(`${this.userLabel(updated)} was reset to a clean game state.`);
      await Promise.all([
        this.refreshSelectedUserHistory(updated.id),
        this.refreshSelectedUserDecks(updated.id)
      ]);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to wipe user data.');
    } finally {
      this.moderationActionId.set(null);
    }
  }

  async deleteSelectedUser(): Promise<void> {
    const user = this.selectedUser();

    if (!user || this.isProtectedUser(user)) {
      return;
    }

    this.moderationActionId.set('delete');
    this.error.set('');
    this.userNotice.set('');
    this.userDeckNotice.set('');

    try {
      const { deletedUserId } = await this.adminService.deleteUser(user.id);
      const remainingUsers = this.users().filter((entry) => entry.id !== deletedUserId);
      const nextSelectedUser = remainingUsers[0] || null;

      this.users.set(remainingUsers);
      this.balanceDrafts.update((drafts) => {
        const { [deletedUserId]: _removed, ...rest } = drafts;
        return rest;
      });

      this.selectedUser.set(nextSelectedUser);
      this.userNotice.set(`${this.userLabel(user)} was deleted.`);

      if (nextSelectedUser) {
        await Promise.all([
          this.refreshSelectedUserHistory(nextSelectedUser.id),
          this.refreshSelectedUserDecks(nextSelectedUser.id)
        ]);
      } else {
        this.selectedHistory.set([]);
        this.selectedUserDecks.set([]);
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to delete user.');
    } finally {
      this.moderationActionId.set(null);
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

      if (this.selectedUser()) {
        await this.refreshSelectedUserDecks(this.selectedUser()!.id);
      }
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

      if (this.selectedUser()) {
        await this.refreshSelectedUserDecks(this.selectedUser()!.id);
      }
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

      if (this.selectedUser()) {
        await this.refreshSelectedUserDecks(this.selectedUser()!.id);
      }
    } catch (error) {
      this.deckError.set(error instanceof Error ? error.message : 'Failed to change the standard deck.');
    } finally {
      this.savingDeckId.set(null);
    }
  }

  private replaceUser(user: User): void {
    this.users.update((users) => users.map((entry) => (entry.id === user.id ? user : entry)));
    this.balanceDrafts.update((drafts) => ({
      ...drafts,
      [user.id]: String(user.balance)
    }));
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

  private async refreshSelectedUserDecks(userId: string): Promise<void> {
    this.userDeckLoading.set(true);
    this.userDeckError.set('');

    try {
      this.selectedUserDecks.set(await this.adminService.listUserCardDecks(userId));
    } catch (error) {
      this.userDeckError.set(error instanceof Error ? error.message : 'Failed to load user decks.');
    } finally {
      this.userDeckLoading.set(false);
    }
  }
}
