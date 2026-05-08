import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';

import type { PokerLobbyState, PokerRealtimeState, PokerTableState } from '../../../core/models/game.model';
import { AuthService } from '../../../core/services/auth.service';
import { GameSocketService } from '../../../core/services/game-socket.service';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { GameShellComponent } from '../components/game-shell.component';
import { PokerTableComponent } from '../poker/poker-table.component';

@Component({
  selector: 'app-poker-page',
  standalone: true,
  imports: [
    AppButtonComponent,
    AppCardComponent,
    AppInputComponent,
    CreditsPipe,
    GameShellComponent,
    PokerTableComponent
  ],
  templateUrl: './poker.page.html',
  styleUrl: './poker.page.scss'
})
export class PokerPageComponent {
  readonly socket = inject(GameSocketService);
  readonly turnDurationMs = 20_000;
  readonly waitingTurnDurationMs = 30_000;
  readonly emoteCooldownMs = 5_000;
  readonly auth = inject(AuthService);

  private readonly destroyRef = inject(DestroyRef);

  readonly createTableName = signal('Skyline No-Limit');
  readonly createVisibility = signal<'public' | 'private'>('public');
  readonly createPassword = signal('');
  readonly createMinBuyIn = signal('200');
  readonly createMaxPlayers = signal('6');
  readonly createBuyIn = signal('400');
  readonly publicJoinBuyIn = signal('200');
  readonly privateJoinBuyIn = signal('200');
  readonly showCreateRoomModal = signal(false);
  readonly privatePassword = signal('');
  readonly raiseAmount = signal('');
  readonly countdownMs = signal(0);
  readonly emoteCooldownRemainingMs = signal(0);
  readonly emotePanelOpen = signal(false);
  readonly selectedTableId = signal<string | null>(null);
  readonly emotes = ['Good luck', 'Nice hand', 'Oops', 'Wow', 'gg'] as const;
  private nextEmoteAt = 0;

  readonly state = computed(() => this.socket.currentState());
  readonly pokerState = computed(() => (this.state()?.state as unknown as PokerRealtimeState | null) || null);
  readonly lobbyState = computed(() => (this.pokerState()?.kind === 'lobby' ? (this.pokerState() as PokerLobbyState) : null));
  readonly tableState = computed(() => (this.pokerState()?.kind === 'table' ? (this.pokerState() as PokerTableState) : null));
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly selfSeat = computed(() => this.tableState()?.players.find((seat) => seat.isSelf) || null);
  readonly isSelfReady = computed(() => Boolean(this.selfSeat()?.isReady));
  readonly selectedTable = computed(() => this.lobbyState()?.tables.find((table) => table.sessionId === this.selectedTableId()) || null);
  readonly actingTurnDurationMs = computed(() =>
    this.tableState()?.phase === 'waiting' ? this.waitingTurnDurationMs : this.turnDurationMs
  );
  readonly isSelfWaitingTurn = computed(() => {
    const table = this.tableState();
    const seat = this.selfSeat();

    return Boolean(table && seat && table.phase === 'waiting' && table.actingUserId === seat.userId);
  });
  readonly publicTables = computed(() => this.lobbyState()?.tables.filter((table) => table.visibility === 'public') || []);
  readonly recommendedPublicTable = computed(() => {
    const tables = this.publicTables();
    if (tables.length === 0) {
      return null;
    }

    return [...tables].sort((left, right) => left.minBuyIn - right.minBuyIn)[0] || null;
  });
  readonly createBuyInNumber = computed(() => this.asWholeNumber(this.createBuyIn(), 400));
  readonly createMinBuyInNumber = computed(() => this.asWholeNumber(this.createMinBuyIn(), 200));
  readonly publicJoinBuyInNumber = computed(() =>
    this.asWholeNumber(this.publicJoinBuyIn(), this.recommendedPublicTable()?.minBuyIn || 200)
  );
  readonly privateJoinBuyInNumber = computed(() => this.asWholeNumber(this.privateJoinBuyIn(), 200));
  readonly createBuyInSliderMin = computed(() => Math.max(100, this.createMinBuyInNumber()));
  readonly createBuyInSliderMax = computed(() => Math.max(this.createBuyInSliderMin() + 400, 5000));
  readonly publicJoinBuyInSliderMin = computed(() => Math.max(100, this.recommendedPublicTable()?.minBuyIn || 100));
  readonly publicJoinBuyInSliderMax = computed(() =>
    Math.max(
      this.publicJoinBuyInSliderMin() + 600,
      Math.min(Math.max(this.auth.currentUser()?.balance || 0, this.publicJoinBuyInSliderMin() + 600), 10000)
    )
  );
  readonly privateJoinBuyInSliderMin = computed(() => 100);
  readonly privateJoinBuyInSliderMax = computed(() =>
    Math.max(
      this.privateJoinBuyInSliderMin() + 600,
      Math.min(Math.max(this.auth.currentUser()?.balance || 0, this.privateJoinBuyInSliderMin() + 600), 10000)
    )
  );
  readonly timerLabel = computed(() => {
    const state = this.tableState();
    if (!state) {
      return 'Lobby';
    }

    const ms = this.countdownMs();
    if (ms <= 0) {
      return state.phase === 'waiting' ? 'Open table' : 'Live';
    }

    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  });
  readonly actingLabel = computed(() => {
    const table = this.tableState();
    const actor = table?.players.find((player) => player.userId === table?.actingUserId);
    return actor?.playerLabel || (table?.phase === 'waiting' ? 'Waiting for ready checks' : 'Runout');
  });
  readonly callAmount = computed(() => {
    const seat = this.selfSeat();
    const table = this.tableState();

    if (!seat || !table) {
      return 0;
    }

    return Math.max(0, table.currentBet - seat.streetContribution);
  });
  readonly raiseTarget = computed(() => {
    const amount = Number(this.raiseAmount());
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  });

  constructor() {
    this.socket.reset();
    this.socket.joinGame('poker', 'poker-lobby');
    this.destroyRef.onDestroy(() => {
      this.socket.leaveGame('poker', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });

    const interval = window.setInterval(() => {
      const table = this.tableState();
      const target =
        table?.phase === 'waiting'
          ? table.phaseEndsAt || table.dealStartsAt
          : table?.phaseEndsAt;

      if (!target) {
        this.countdownMs.set(0);
      } else {
        this.countdownMs.set(Math.max(0, new Date(target).getTime() - Date.now()));
      }

      this.emoteCooldownRemainingMs.set(Math.max(0, this.nextEmoteAt - Date.now()));
    }, 100);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(interval);
    });

    effect(() => {
      const publicTable = this.recommendedPublicTable();
      if (publicTable) {
        this.publicJoinBuyIn.set(String(Math.max(publicTable.minBuyIn, Number(this.publicJoinBuyIn()) || 0)));
      }
    });

    effect(() => {
      const table = this.tableState();
      if (!table) {
        return;
      }

      this.publicJoinBuyIn.set(String(Math.max(table.minBuyIn, Number(this.publicJoinBuyIn()) || 0)));
      this.privateJoinBuyIn.set(String(Math.max(table.minBuyIn, Number(this.privateJoinBuyIn()) || 0)));
      if (table.minRaiseTo) {
        this.raiseAmount.set(String(table.minRaiseTo));
      }
    });
  }

  openCreateRoomModal(): void {
    this.showCreateRoomModal.set(true);
    this.createPassword.set('');
  }

  closeCreateRoomModal(): void {
    this.showCreateRoomModal.set(false);
  }

  createRoom(): void {
    this.socket.sendAction('poker', 'create-table', {
      tableName: this.createTableName().trim(),
      visibility: this.createVisibility(),
      password: this.createVisibility() === 'private' ? this.createPassword().trim() : undefined,
      minBuyIn: this.createMinBuyInNumber(),
      maxPlayers: Number(this.createMaxPlayers()),
      buyIn: Math.max(this.createMinBuyInNumber(), this.createBuyInNumber())
    });

    this.closeCreateRoomModal();
  }

  joinSelectedPublicTable(): void {
    const tables = this.publicTables();
    if (tables.length === 0) {
      return;
    }

    const eligibleTables = tables.filter((table) => table.playerCount < table.maxPlayers);
    const pool = eligibleTables.length > 0 ? eligibleTables : tables;
    const table = pool[Math.floor(Math.random() * pool.length)];

    if (!table) {
      return;
    }

    this.emotePanelOpen.set(false);
    this.socket.joinGame('poker', table.sessionId);
  }

  joinPrivateTable(): void {
    this.emotePanelOpen.set(false);
    this.socket.sendAction('poker', 'spectate-table', {
      password: this.privatePassword().trim()
    this.socket.sendAction('poker', 'join-table', {
      sessionId: table.sessionId,
      buyIn: Math.max(table.minBuyIn, this.publicJoinBuyInNumber())
    });
  }

  joinPrivateTable(): void {
    this.socket.sendAction('poker', 'join-table', {
      password: this.privatePassword().trim(),
      buyIn: this.privateJoinBuyInNumber()
    });
  }

  buyInCurrentTable(): void {
    const table = this.tableState();
    if (!table) {
      return;
    }

    this.socket.sendAction('poker', 'join-table', {
      sessionId: table.tableId,
      buyIn: Math.max(table.minBuyIn, this.publicJoinBuyInNumber())
    });
  }

  leaveTable(): void {
    this.emotePanelOpen.set(false);
    this.socket.sendAction('poker', 'leave-table');
  }

  readyTable(): void {
    const table = this.tableState();
    if (!table?.isSeated) {
      return;
    }

    this.socket.sendAction('poker', 'ready-table');
  }

  can(action: 'check' | 'call' | 'raise' | 'all-in' | 'fold'): boolean {
    return Boolean(this.tableState()?.allowedActions?.includes(action));
  }

  raise(): void {
    const amount = this.raiseTarget();
    if (!amount) {
      return;
    }

    this.socket.sendAction('poker', 'raise', { amount });
  }

  action(action: 'check' | 'call' | 'all-in' | 'fold'): void {
    this.socket.sendAction('poker', action);
  }

  sendEmote(emote: (typeof this.emotes)[number]): void {
    if (!this.tableState()?.isSeated || this.emoteCooldownRemainingMs() > 0) {
      return;
    }

    this.nextEmoteAt = Date.now() + this.emoteCooldownMs;
    this.emoteCooldownRemainingMs.set(this.emoteCooldownMs);
    this.emotePanelOpen.set(false);
    this.socket.sendAction('poker', 'emote', { emote });
  }

  emoteCooldownSeconds(): number {
    return Math.ceil(this.emoteCooldownRemainingMs() / 1000);
  }

  toggleEmotePanel(): void {
    if (!this.tableState()?.isSeated) {
      return;
    }

    this.emotePanelOpen.update((open) => !open);
  setCreateBuyInFromSlider(value: string): void {
    const next = Math.max(this.createBuyInSliderMin(), Number(value) || this.createBuyInSliderMin());
    this.createBuyIn.set(String(next));
  }

  setPublicJoinBuyInFromSlider(value: string): void {
    const next = Math.max(this.publicJoinBuyInSliderMin(), Number(value) || this.publicJoinBuyInSliderMin());
    this.publicJoinBuyIn.set(String(next));
  }

  setPrivateJoinBuyInFromSlider(value: string): void {
    const next = Math.max(this.privateJoinBuyInSliderMin(), Number(value) || this.privateJoinBuyInSliderMin());
    this.privateJoinBuyIn.set(String(next));
  }

  private asWholeNumber(value: string, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
  }
}
