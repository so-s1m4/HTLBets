import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';

import type { PokerLobbyState, PokerRealtimeState, PokerTableState, PokerTableSummary } from '../../../core/models/game.model';
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

  private readonly destroyRef = inject(DestroyRef);

  readonly createTableName = signal('Skyline No-Limit');
  readonly createVisibility = signal<'public' | 'private'>('public');
  readonly createPassword = signal('');
  readonly createMinBuyIn = signal('200');
  readonly createMaxPlayers = signal('6');
  readonly createBuyIn = signal('400');
  readonly joinBuyIn = signal('200');
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
      const selected = this.selectedTable();
      if (selected) {
        this.joinBuyIn.set(String(Math.max(selected.minBuyIn, Number(this.joinBuyIn()) || 0)));
      }
    });

    effect(() => {
      const lobby = this.lobbyState();
      if (!lobby) {
        return;
      }

      if (!this.selectedTableId() || !lobby.tables.some((table) => table.sessionId === this.selectedTableId())) {
        this.selectedTableId.set(lobby.tables[0]?.sessionId || null);
      }
    });

    effect(() => {
      const table = this.tableState();
      if (!table) {
        return;
      }

      this.joinBuyIn.set(String(Math.max(table.minBuyIn, Number(this.joinBuyIn()) || 0)));
      if (table.minRaiseTo) {
        this.raiseAmount.set(String(table.minRaiseTo));
      }
    });
  }

  selectPublicTable(table: PokerTableSummary): void {
    this.selectedTableId.set(table.sessionId);
    this.joinBuyIn.set(String(table.minBuyIn));
  }

  createTable(): void {
    this.socket.sendAction('poker', 'create-table', {
      tableName: this.createTableName().trim(),
      visibility: this.createVisibility(),
      password: this.createVisibility() === 'private' ? this.createPassword().trim() : undefined,
      minBuyIn: Number(this.createMinBuyIn()),
      maxPlayers: Number(this.createMaxPlayers()),
      buyIn: Number(this.createBuyIn())
    });
  }

  joinSelectedPublicTable(): void {
    const table = this.selectedTable();
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
    });
  }

  buyInCurrentTable(): void {
    const table = this.tableState();
    if (!table) {
      return;
    }

    this.socket.sendAction('poker', 'join-table', {
      sessionId: table.tableId,
      buyIn: Number(this.joinBuyIn())
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
  }
}
