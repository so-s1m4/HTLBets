import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';

import type { MafiaLobbyState, MafiaPlayerView, MafiaRealtimeState, MafiaRoleConfigView, MafiaRoomState } from '../../../core/models/game.model';
import { AuthService } from '../../../core/services/auth.service';
import { GameSocketService } from '../../../core/services/game-socket.service';
import { MediaStreamDirective } from '../../../shared/directives/media-stream.directive';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { GameShellComponent } from '../components/game-shell.component';
import type { MafiaSeatMediaView } from '../mafia/mafia-media.service';
import { MafiaMediaService } from '../mafia/mafia-media.service';

type MafiaPhase = MafiaRoomState['phase'];

@Component({
  selector: 'app-mafia-page',
  standalone: true,
  imports: [AppButtonComponent, AppCardComponent, AppInputComponent, GameShellComponent, MediaStreamDirective],
  templateUrl: './mafia.page.html',
  styleUrl: './mafia.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MafiaPageComponent {
  readonly socket = inject(GameSocketService);
  readonly auth = inject(AuthService);
  readonly media = inject(MafiaMediaService);
  private readonly destroyRef = inject(DestroyRef);

  readonly showCreateRoomModal = signal(false);
  readonly createRoomName = signal('Night Shift');
  readonly createVisibility = signal<'public' | 'private'>('public');
  readonly createPassword = signal('');
  readonly createMaxPlayers = signal('8');
  readonly createMafiaCount = signal('2');
  readonly createDetectiveCount = signal('1');
  readonly createDoctorCount = signal('1');
  readonly createJesterCount = signal('0');
  readonly createVideoEnabled = signal(true);
  readonly createTextChatEnabled = signal(true);
  readonly privatePassword = signal('');
  readonly chatMessage = signal('');
  readonly selectedActionTargetId = signal('');
  readonly now = signal(Date.now());
  readonly isFullscreen = signal(false);
  readonly phaseSteps: Array<{ phase: MafiaPhase; label: string }> = [
    { phase: 'waiting', label: 'Lobby' },
    { phase: 'mafia-intro', label: 'Intro' },
    { phase: 'night', label: 'Night' },
    { phase: 'day', label: 'Debate' },
    { phase: 'voting', label: 'Vote' },
    { phase: 'resolved', label: 'Result' }
  ];

  readonly state = computed(() => this.socket.currentState());
  readonly currentUserId = computed(() => this.auth.currentUser()?.id || null);
  readonly mafiaState = computed(() => (this.state()?.state as unknown as MafiaRealtimeState | null) || null);
  readonly lobbyState = computed(() => (this.mafiaState()?.kind === 'lobby' ? (this.mafiaState() as MafiaLobbyState) : null));
  readonly roomState = computed(() => (this.mafiaState()?.kind === 'room' ? (this.mafiaState() as MafiaRoomState) : null));
  readonly publicRooms = computed(() => this.lobbyState()?.rooms || []);
  readonly selfPlayer = computed(() => this.roomState()?.players.find((player) => player.isSelf) || null);
  readonly actionOptions = computed(() => this.roomState()?.actionOptions || []);
  readonly seatMedia = computed(() => this.media.seatMedia());
  readonly phaseRemainingLabel = computed(() => {
    const endsAt = this.roomState()?.phaseEndsAt;
    if (!endsAt) {
      return '';
    }

    const remainingSeconds = Math.max(0, Math.ceil((new Date(endsAt).getTime() - this.now()) / 1000));
    return `${remainingSeconds}s`;
  });
  readonly phaseProgressPercent = computed(() => {
    const endsAt = this.roomState()?.phaseEndsAt;
    if (!endsAt) {
      return 0;
    }

    const remainingMs = Math.max(0, new Date(endsAt).getTime() - this.now());
    return Math.max(0, Math.min(100, (remainingMs / 60_000) * 100));
  });
  readonly currentPhaseIndex = computed(() => {
    const phase = this.roomState()?.phase;
    return Math.max(0, this.phaseSteps.findIndex((step) => step.phase === phase));
  });
  readonly phaseStatusCopy = computed(() => {
    const room = this.roomState();
    if (!room) {
      return '';
    }

    switch (room.phase) {
      case 'waiting':
        return room.canStartGame ? 'Players are ready. Start the table when the room feels complete.' : 'Gather the table and tune the cast before the first night.';
      case 'mafia-intro':
        return 'Mafia can privately coordinate. Everyone else waits for the night to open.';
      case 'night':
        return 'Hidden roles act now. Submit the night move before the timer closes.';
      case 'day':
        return 'Open debate. Read the room, compare stories, then move into voting.';
      case 'voting':
        return 'Choose who leaves the table. Votes lock as soon as they are submitted.';
      case 'resolved':
        return 'The game is over. Roles are revealed and winners are listed.';
    }
  });
  readonly canUseMediaControls = computed(() => {
    const room = this.roomState();
    return Boolean(room?.videoEnabled && room.isSeated && (room.phase !== 'mafia-intro' || room.selfRole === 'mafia'));
  });
  readonly roleSlotsUsed = computed(
    () => this.roleCount(this.createMafiaCount(), 2) + this.roleCount(this.createDetectiveCount(), 1) + this.roleCount(this.createDoctorCount(), 1) + this.roleCount(this.createJesterCount(), 0)
  );
  readonly createMaxPlayersNumber = computed(() => Math.min(12, this.roleCount(this.createMaxPlayers(), 8, 4)));
  readonly civilianCount = computed(() => Math.max(0, this.createMaxPlayersNumber() - this.roleSlotsUsed()));
  readonly roleSummary = computed<MafiaRoleConfigView[]>(() => {
    const roles: MafiaRoleConfigView[] = [
      { key: 'mafia', label: 'Mafia', count: this.roleCount(this.createMafiaCount(), 2) },
      { key: 'detective', label: 'Detective', count: this.roleCount(this.createDetectiveCount(), 1) },
      { key: 'doctor', label: 'Doctor', count: this.roleCount(this.createDoctorCount(), 1) },
      { key: 'jester', label: 'Jester', count: this.roleCount(this.createJesterCount(), 0) },
      { key: 'civilian', label: 'Civilian', count: this.civilianCount() }
    ];

    return roles.filter((role) => role.count > 0);
  });
  readonly createConfigError = computed(() => {
    if (this.roleCount(this.createMafiaCount(), 2) < 1) {
      return 'At least one mafia role is required.';
    }

    if (this.civilianCount() < 1) {
      return 'Leave at least one civilian slot in the room.';
    }

    return '';
  });

  constructor() {
    this.media.attach();
    this.socket.reset();
    this.socket.joinGame('mafia', 'mafia-lobby');

    const timer = window.setInterval(() => this.now.set(Date.now()), 1000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
      this.media.detach();
      this.socket.leaveGame('mafia', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });

    effect(() => {
      const room = this.roomState();
      const options = room?.actionOptions || [];
      const selected = this.selectedActionTargetId();

      if (!options.length) {
        this.selectedActionTargetId.set('');
        return;
      }

      if (selected && options.some((option) => option.userId === selected)) {
        return;
      }

      this.selectedActionTargetId.set(options[0]?.userId || '');
    });

    effect(() => {
      this.media.syncRoomState(this.roomState(), this.currentUserId());
    });
  }

  openCreateRoomModal(): void {
    this.showCreateRoomModal.set(true);
  }

  setFullscreen(value: boolean): void {
    this.isFullscreen.set(value);
  }

  closeCreateRoomModal(): void {
    this.showCreateRoomModal.set(false);
  }

  createRoom(): void {
    if (this.createConfigError()) {
      return;
    }

    this.socket.sendAction('mafia', 'create-room', {
      roomName: this.createRoomName().trim(),
      visibility: this.createVisibility(),
      password: this.createVisibility() === 'private' ? this.createPassword().trim() : undefined,
      maxPlayers: this.createMaxPlayersNumber(),
      mafiaCount: this.roleCount(this.createMafiaCount(), 2),
      detectiveCount: this.roleCount(this.createDetectiveCount(), 1),
      doctorCount: this.roleCount(this.createDoctorCount(), 1),
      jesterCount: this.roleCount(this.createJesterCount(), 0),
      videoEnabled: this.createVideoEnabled(),
      textChatEnabled: this.createTextChatEnabled()
    });

    this.closeCreateRoomModal();
  }

  joinPublicRoom(sessionId: string): void {
    this.socket.sendAction('mafia', 'join-room', { sessionId });
  }

  joinPrivateRoom(): void {
    this.socket.sendAction('mafia', 'join-room', {
      password: this.privatePassword().trim()
    });
  }

  leaveRoom(): void {
    this.socket.sendAction('mafia', 'leave-room');
  }

  startGame(): void {
    this.socket.sendAction('mafia', 'start-game');
  }

  beginNight(): void {
    this.socket.sendAction('mafia', 'begin-night');
  }

  beginVote(): void {
    this.socket.sendAction('mafia', 'begin-vote');
  }

  async toggleCamera(): Promise<void> {
    await this.media.toggleCamera();
  }

  async toggleMicrophone(): Promise<void> {
    await this.media.toggleMicrophone();
  }

  sendMessage(): void {
    const text = this.chatMessage().trim();
    if (!text) {
      return;
    }

    this.socket.sendAction('mafia', 'send-message', { text });
    this.chatMessage.set('');
  }

  submitAction(): void {
    const room = this.roomState();
    const targetUserId = this.selectedActionTargetId();
    if (!room || !targetUserId) {
      return;
    }

    const action = room.phase === 'night' ? 'submit-night-action' : room.phase === 'voting' ? 'submit-vote' : '';
    if (!action) {
      return;
    }

    this.socket.sendAction('mafia', action, { targetUserId });
  }

  actionPrompt(): string {
    const room = this.roomState();
    if (!room) {
      return '';
    }

    if (room.phase === 'night') {
      switch (room.selfRole) {
        case 'mafia':
          return 'Pick a night kill target.';
        case 'doctor':
          return 'Choose one player to protect tonight.';
        case 'detective':
          return 'Choose one player to investigate.';
        default:
          return 'Your role sleeps through the night.';
      }
    }

    if (room.phase === 'voting') {
      return 'Cast one elimination vote.';
    }

    return '';
  }

  phaseLabel(): string {
    const phase = this.roomState()?.phase;
    if (!phase) {
      return '';
    }

    switch (phase) {
      case 'waiting':
        return 'Waiting room';
      case 'mafia-intro':
        return 'Mafia intro';
      case 'night':
        return 'Night';
      case 'day':
        return 'Day discussion';
      case 'voting':
        return 'Voting';
      case 'resolved':
        return 'Game over';
    }
  }

  phaseClass(): string {
    return `mafia-phase-banner mafia-phase-banner--${this.roomState()?.phase || 'waiting'}`;
  }

  isPhaseStepDone(index: number): boolean {
    return index < this.currentPhaseIndex();
  }

  isPhaseStepActive(index: number): boolean {
    return index === this.currentPhaseIndex();
  }

  playerStatus(player: MafiaPlayerView): string {
    if (player.revealedRole) {
      return player.revealedRole;
    }

    if (player.roleHint) {
      return player.roleHint;
    }

    return player.alive ? 'Alive' : 'Out';
  }

  playerTags(player: MafiaPlayerView): string[] {
    const tags: string[] = [];

    if (player.isSelf) {
      tags.push('You');
    }

    if (player.isOwner) {
      tags.push('Owner');
    }

    if (!player.alive) {
      tags.push('Out');
    }

    return tags;
  }

  mediaFor(userId: string): MafiaSeatMediaView | null {
    return this.seatMedia()[userId] || null;
  }

  hasLiveCamera(userId: string): boolean {
    return Boolean(this.mediaFor(userId)?.cameraEnabled);
  }

  hasLiveAudio(userId: string): boolean {
    return Boolean(this.mediaFor(userId)?.audioEnabled);
  }

  roleLabel(role: MafiaRoleConfigView): string {
    return `${role.label} x${role.count}`;
  }

  private roleCount(value: string, fallback: number, minimum = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(minimum, Math.round(parsed)) : fallback;
  }
}
