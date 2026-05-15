import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';

import type {
  OchkoActionCardView,
  OchkoLobbyState,
  OchkoPlayerView,
  OchkoRealtimeState,
  OchkoRoomState,
  OchkoTableSummary
} from '../../../core/models/game.model';
import { AuthService } from '../../../core/services/auth.service';
import { GameSocketService } from '../../../core/services/game-socket.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameShellComponent } from '../components/game-shell.component';

interface PositionedOchkoSeat {
  player: OchkoPlayerView;
  left: number;
  top: number;
  avatarInitial: string;
}

const orbitLayouts: Record<number, Array<{ left: number; top: number }>> = {
  0: [],
  1: [{ left: 50, top: 17 }],
  2: [
    { left: 30, top: 18 },
    { left: 70, top: 18 }
  ],
  3: [
    { left: 14, top: 48 },
    { left: 50, top: 17 },
    { left: 86, top: 48 }
  ],
  4: [
    { left: 14, top: 48 },
    { left: 30, top: 18 },
    { left: 70, top: 18 },
    { left: 86, top: 48 }
  ]
};

@Component({
  selector: 'app-ochko-page',
  standalone: true,
  imports: [AppButtonComponent, AppCardComponent, AppInputComponent, CreditsPipe, GameShellComponent],
  templateUrl: './ochko.page.html',
  styleUrl: './ochko.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OchkoPageComponent {
  readonly socket = inject(GameSocketService);
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly roomName = signal('Night Ochko');
  readonly roomVisibility = signal<'public' | 'private'>('public');
  readonly roomPassword = signal('');
  readonly roomBuyIn = signal('250');
  readonly roomMaxPlayers = signal('5');
  readonly joinPassword = signal('');
  readonly selectedRoomId = signal<string | null>(null);
  readonly selectedTargetUserId = signal<string | null>(null);
  readonly countdownMs = signal(0);

  readonly state = computed(() => this.socket.currentState());
  readonly ochkoState = computed(() => {
    const rawState = this.state()?.state;

    if (!rawState || typeof rawState !== 'object') {
      return null;
    }

    return rawState as unknown as OchkoRealtimeState;
  });
  readonly lobbyState = computed(() => (this.ochkoState()?.kind === 'lobby' ? (this.ochkoState() as OchkoLobbyState) : null));
  readonly roomState = computed(() => (this.ochkoState()?.kind === 'room' ? (this.ochkoState() as OchkoRoomState) : null));
  readonly hasRoomState = computed(() => this.roomState() !== null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly self = computed(() => this.roomState()?.players.find((player) => player.isSelf) || null);
  readonly orbitSeats = computed(() => {
    const room = this.roomState();
    if (!room) {
      return [] as PositionedOchkoSeat[];
    }

    const players = room.players.filter((player) => !player.isSelf);
    const layout = orbitLayouts[players.length] || orbitLayouts[4];

    return players.map((player, index) => ({
      player,
      left: layout[index]?.left ?? 50,
      top: layout[index]?.top ?? 16,
      avatarInitial: this.avatarInitial(player.playerLabel)
    }));
  });
  readonly roomList = computed(() => this.lobbyState()?.rooms || []);
  readonly canReady = computed(() => Boolean(this.roomState()?.isSeated && this.roomState()?.phase === 'waiting' && !this.self()?.isReady));
  readonly isMyTurn = computed(() => {
    const room = this.roomState();
    const self = this.self();
    return Boolean(room && self && room.phase === 'round' && room.currentPlayerId === self.userId && self.status === 'active');
  });
  readonly targetCandidates = computed(() => {
    const room = this.roomState();
    const self = this.self();

    if (!room || !self) {
      return [] as OchkoPlayerView[];
    }

    return room.players.filter((player) => player.userId !== self.userId);
  });
  readonly roomTimerLabel = computed(() => {
    const ms = this.countdownMs();
    if (ms <= 0) {
      return this.roomState()?.phase === 'waiting' ? 'Ready checks' : 'Live';
    }

    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });
  readonly headlineEvent = computed(() => this.roomState()?.recentEvents[0] || this.roomState()?.notes || '');
  readonly feedEvents = computed(() => (this.roomState()?.recentEvents || []).slice(1, 6));

  constructor() {
    this.socket.reset();
    this.socket.joinGame('ochko', 'ochko-lobby');

    this.destroyRef.onDestroy(() => {
      this.socket.leaveGame('ochko', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });

    const updateTimers = () => {
      const target = this.roomState()?.phaseEndsAt;
      this.countdownMs.set(target ? Math.max(0, new Date(target).getTime() - Date.now()) : 0);
    };

    updateTimers();
    const interval = window.setInterval(updateTimers, 1000);
    this.destroyRef.onDestroy(() => window.clearInterval(interval));
  }

  createRoom(): void {
    this.socket.sendAction('ochko', 'create-room', {
      roomName: this.roomName().trim(),
      visibility: this.roomVisibility(),
      password: this.roomVisibility() === 'private' ? this.roomPassword().trim() : undefined,
      buyIn: Number(this.roomBuyIn()),
      maxPlayers: Number(this.roomMaxPlayers())
    });
  }

  joinRoom(room: OchkoTableSummary): void {
    this.selectedRoomId.set(room.sessionId);
    this.socket.sendAction('ochko', 'join-room', {
      sessionId: room.sessionId,
      password: room.requiresPassword ? this.joinPassword().trim() : undefined
    });
  }

  readyRoom(): void {
    this.socket.sendAction('ochko', 'ready-room');
  }

  leaveRoom(): void {
    this.socket.sendAction('ochko', 'leave-room');
    this.selectedTargetUserId.set(null);
  }

  drawCard(): void {
    this.socket.sendAction('ochko', 'draw-card');
  }

  stand(): void {
    this.socket.sendAction('ochko', 'stand');
  }

  playActionCard(card: OchkoActionCardView): void {
    const targetMode = card.targetMode;
    const targetUserId =
      targetMode === 'self'
        ? this.self()?.userId || undefined
        : targetMode === 'none'
          ? undefined
          : this.selectedTargetUserId() || undefined;

    this.socket.sendAction('ochko', 'play-action-card', {
      cardType: card.type,
      targetUserId
    });
  }

  chooseTarget(userId: string): void {
    this.selectedTargetUserId.set(userId);
  }

  needsTarget(card: OchkoActionCardView): boolean {
    return card.targetMode === 'opponent' || card.targetMode === 'any';
  }

  avatarInitial(label: string): string {
    return label.trim().charAt(0).toUpperCase() || 'P';
  }

  suitSymbol(suit?: string): string {
    switch (suit) {
      case 'hearts':
        return '♥';
      case 'diamonds':
        return '♦';
      case 'clubs':
        return '♣';
      case 'spades':
        return '♠';
      default:
        return '';
    }
  }

  cardToneClass(suit?: string): string {
    return suit === 'hearts' || suit === 'diamonds' ? 'is-red' : 'is-dark';
  }
}
