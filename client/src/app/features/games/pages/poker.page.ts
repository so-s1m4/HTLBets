import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';

import type { PokerLobbyState, PokerRealtimeState, PokerTableState, PokerTableSummary } from '../../../core/models/game.model';
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
  readonly auth = inject(AuthService);

  private readonly destroyRef = inject(DestroyRef);

  readonly createTableName = signal('Skyline No-Limit');
  readonly createPassword = signal('');
  readonly createMinBuyIn = signal('200');
  readonly createMaxPlayers = signal('6');
  readonly createBuyIn = signal('400');
  readonly publicJoinBuyIn = signal('200');
  readonly privateJoinBuyIn = signal('200');
  readonly showPrivateCreateModal = signal(false);
  readonly privatePassword = signal('');
  readonly raiseAmount = signal('');
  readonly countdownMs = signal(0);
  readonly selectedTableId = signal<string | null>(null);

  readonly state = computed(() => this.socket.currentState());
  readonly pokerState = computed(() => (this.state()?.state as unknown as PokerRealtimeState | null) || null);
  readonly lobbyState = computed(() => (this.pokerState()?.kind === 'lobby' ? (this.pokerState() as PokerLobbyState) : null));
  readonly tableState = computed(() => (this.pokerState()?.kind === 'table' ? (this.pokerState() as PokerTableState) : null));
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly selfSeat = computed(() => this.tableState()?.players.find((seat) => seat.isSelf) || null);
  readonly selectedTable = computed(() => this.lobbyState()?.tables.find((table) => table.sessionId === this.selectedTableId()) || null);
  readonly createBuyInNumber = computed(() => this.asWholeNumber(this.createBuyIn(), 400));
  readonly createMinBuyInNumber = computed(() => this.asWholeNumber(this.createMinBuyIn(), 200));
  readonly publicJoinBuyInNumber = computed(() => this.asWholeNumber(this.publicJoinBuyIn(), this.selectedTable()?.minBuyIn || 200));
  readonly privateJoinBuyInNumber = computed(() => this.asWholeNumber(this.privateJoinBuyIn(), 200));
  readonly createBuyInSliderMin = computed(() => Math.max(100, this.createMinBuyInNumber()));
  readonly createBuyInSliderMax = computed(() => Math.max(this.createBuyInSliderMin() + 400, 5000));
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
    return actor?.playerLabel || (table?.phase === 'waiting' ? 'Waiting for seats' : 'Runout');
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
      const target = table?.phase === 'waiting' ? table.dealStartsAt : table?.phaseEndsAt;

      if (!target) {
        this.countdownMs.set(0);
        return;
      }

      this.countdownMs.set(Math.max(0, new Date(target).getTime() - Date.now()));
    }, 1000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(interval);
    });

    effect(() => {
      const selected = this.selectedTable();
      if (selected) {
        this.publicJoinBuyIn.set(String(Math.max(selected.minBuyIn, Number(this.publicJoinBuyIn()) || 0)));
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

      this.publicJoinBuyIn.set(String(Math.max(table.minBuyIn, Number(this.publicJoinBuyIn()) || 0)));
      this.privateJoinBuyIn.set(String(Math.max(table.minBuyIn, Number(this.privateJoinBuyIn()) || 0)));
      if (table.minRaiseTo) {
        this.raiseAmount.set(String(table.minRaiseTo));
      }
    });
  }

  selectPublicTable(table: PokerTableSummary): void {
    this.selectedTableId.set(table.sessionId);
    this.publicJoinBuyIn.set(String(table.minBuyIn));
  }

  openPrivateCreateModal(): void {
    this.showPrivateCreateModal.set(true);
    this.createPassword.set('');
  }

  closePrivateCreateModal(): void {
    this.showPrivateCreateModal.set(false);
  }

  createPrivateTable(): void {
    this.socket.sendAction('poker', 'create-table', {
      tableName: this.createTableName().trim(),
      visibility: 'private',
      password: this.createPassword().trim(),
      minBuyIn: this.createMinBuyInNumber(),
      maxPlayers: Number(this.createMaxPlayers()),
      buyIn: Math.max(this.createMinBuyInNumber(), this.createBuyInNumber())
    });

    this.closePrivateCreateModal();
  }

  joinSelectedPublicTable(): void {
    const table = this.selectedTable();
    if (!table) {
      return;
    }

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
    this.socket.sendAction('poker', 'leave-table');
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

  setCreateBuyInFromSlider(value: string): void {
    const next = Math.max(this.createBuyInSliderMin(), Number(value) || this.createBuyInSliderMin());
    this.createBuyIn.set(String(next));
  }

  private asWholeNumber(value: string, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
  }
}
