import { GameSessionStatus } from '../../../../generated/prisma';

import { prisma } from '../../../prisma/client';
import { HttpError } from '../../../utils/http-error';
import { fromDbAmount } from '../../../utils/money';

type MafiaVisibility = 'public' | 'private';
type MafiaRoleKey = 'mafia' | 'detective' | 'doctor' | 'jester' | 'civilian';
type MafiaPhase = 'waiting' | 'mafia-intro' | 'night' | 'day' | 'voting' | 'resolved';
type MafiaWinnerSide = 'town' | 'mafia' | 'jester';

interface MafiaRoleConfigView {
  key: MafiaRoleKey;
  label: string;
  count: number;
}

interface MafiaPlayerView {
  userId: string;
  playerLabel: string;
  avatarUrl?: string | null;
  seatIndex: number;
  isSelf: boolean;
  isOwner: boolean;
  alive: boolean;
  roleHint?: string | null;
  revealedRole?: MafiaRoleKey | null;
  isKnownAlly?: boolean;
}

interface MafiaChatMessageView {
  id: string;
  userId: string;
  playerLabel: string;
  text: string;
  createdAt: string;
  isSystem?: boolean;
}

interface MafiaActionOptionView {
  userId: string;
  playerLabel: string;
}

export interface MafiaRoomSummary {
  sessionId: string;
  roomName: string;
  visibility: MafiaVisibility;
  maxPlayers: number;
  playerCount: number;
  requiresPassword: boolean;
  videoEnabled: boolean;
  textChatEnabled: boolean;
  roles: MafiaRoleConfigView[];
}

export interface MafiaLobbyState {
  kind: 'lobby';
  rooms: MafiaRoomSummary[];
  notes: string;
}

export interface MafiaRoomState {
  kind: 'room';
  roomId: string;
  roomName: string;
  visibility: MafiaVisibility;
  requiresPassword: boolean;
  maxPlayers: number;
  ownerUserId: string;
  phase: MafiaPhase;
  roundNumber: number;
  videoEnabled: boolean;
  textChatEnabled: boolean;
  roles: MafiaRoleConfigView[];
  players: MafiaPlayerView[];
  messages: MafiaChatMessageView[];
  notes: string;
  phaseEndsAt?: string;
  isSeated: boolean;
  canJoin: boolean;
  selfRole?: MafiaRoleKey | null;
  selfTeamHint?: string | null;
  lastInvestigation?: string | null;
  actionOptions?: MafiaActionOptionView[];
  hasSubmittedAction?: boolean;
  canStartGame?: boolean;
  canAdvanceIntro?: boolean;
  canAdvancePhase?: boolean;
  winners?: Array<{ side: MafiaWinnerSide; label: string }>;
}

export interface MafiaPlayerEnvelope {
  sessionId: string;
  gameType: 'MAFIA';
  status: GameSessionStatus;
  balance: number;
  currentBet: number;
  state: MafiaLobbyState | MafiaRoomState;
  outcome: null;
}

interface RuntimePlayer {
  userId: string;
  playerLabel: string;
  avatarUrl: string | null;
  role: MafiaRoleKey | null;
  alive: boolean;
  lastNightTargetUserId: string | null;
  lastVoteTargetUserId: string | null;
  lastInvestigation: string | null;
}

interface MafiaRoomConfig {
  roomName: string;
  visibility: MafiaVisibility;
  password: string;
  maxPlayers: number;
  videoEnabled: boolean;
  textChatEnabled: boolean;
  mafiaCount: number;
  detectiveCount: number;
  doctorCount: number;
  jesterCount: number;
}

const LOBBY_SESSION_ID = 'mafia-lobby';
const MAX_ROOMS = 40;
const MAX_CHAT_MESSAGES = 80;
const MIN_PLAYERS = 4;
const MAX_PLAYERS = 12;
const PHASE_DURATION_MS = 60_000;

const roleLabels: Record<MafiaRoleKey, string> = {
  mafia: 'Mafia',
  detective: 'Detective',
  doctor: 'Doctor',
  jester: 'Jester',
  civilian: 'Civilian'
};

const formatPlayerLabel = (email: string, username?: string | null): string => {
  const normalizedUsername = String(username || '').trim();
  if (normalizedUsername) {
    return normalizedUsername;
  }

  const [localPart] = email.split('@');
  if (!localPart) {
    return 'player';
  }

  return localPart.replace(/[^a-z0-9]/gi, '').slice(0, 10) || 'player';
};

const buildRoomId = (): string => `mafia-${Math.random().toString(36).slice(2, 10)}`;
const buildMessageId = (): string => `msg-${Math.random().toString(36).slice(2, 12)}`;

const clampWholeNumber = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : fallback;
};

const shuffle = <T>(items: T[]): T[] => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const normalizeRoomConfig = (payload?: Record<string, unknown>): MafiaRoomConfig => {
  const visibility = payload?.visibility === 'private' ? 'private' : 'public';
  const rawName = typeof payload?.roomName === 'string' ? payload.roomName.trim() : '';
  const roomName = rawName || 'Mafia Room';
  const password = typeof payload?.password === 'string' ? payload.password.trim() : '';
  const maxPlayers = clampWholeNumber(payload?.maxPlayers, 8);
  const mafiaCount = clampWholeNumber(payload?.mafiaCount, 2);
  const detectiveCount = clampWholeNumber(payload?.detectiveCount, 1);
  const doctorCount = clampWholeNumber(payload?.doctorCount, 1);
  const jesterCount = clampWholeNumber(payload?.jesterCount, 0);
  const videoEnabled = payload?.videoEnabled === true;
  const textChatEnabled = payload?.textChatEnabled !== false;

  if (maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) {
    throw new HttpError(400, `Mafia rooms support between ${MIN_PLAYERS} and ${MAX_PLAYERS} players.`);
  }

  if (visibility === 'private' && !/^\d{5}$/.test(password)) {
    throw new HttpError(400, 'Private Mafia rooms require a 5-digit numeric password.');
  }

  if (mafiaCount < 1) {
    throw new HttpError(400, 'At least one mafia role is required.');
  }

  if (detectiveCount < 0 || doctorCount < 0 || jesterCount < 0) {
    throw new HttpError(400, 'Role counts cannot be negative.');
  }

  const specialCount = mafiaCount + detectiveCount + doctorCount + jesterCount;
  if (specialCount >= maxPlayers) {
    throw new HttpError(400, 'Leave room for at least one civilian role.');
  }

  return {
    roomName,
    visibility,
    password,
    maxPlayers,
    videoEnabled,
    textChatEnabled,
    mafiaCount,
    detectiveCount,
    doctorCount,
    jesterCount
  };
};

const normalizeJoinConfig = (payload?: Record<string, unknown>): { sessionId?: string; password?: string } => ({
  sessionId: typeof payload?.sessionId === 'string' && payload.sessionId.trim() ? payload.sessionId.trim() : undefined,
  password: typeof payload?.password === 'string' && payload.password.trim() ? payload.password.trim() : undefined
});

class MafiaRoom {
  private readonly players: RuntimePlayer[] = [];
  private readonly messages: MafiaChatMessageView[] = [];
  private readonly rolePlan: MafiaRoleConfigView[];
  private activeRolePlanValue: MafiaRoleConfigView[] | null = null;
  private phaseValue: MafiaPhase = 'waiting';
  private roundNumberValue = 0;
  private winnersValue: Array<{ side: MafiaWinnerSide; label: string }> = [];
  private winningSide: MafiaWinnerSide | null = null;
  private phaseEndsAtValue: Date | null = null;
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onTimedPhaseChange: () => void;

  readonly sessionId: string;
  readonly roomName: string;
  readonly visibility: MafiaVisibility;
  readonly password: string | null;
  readonly maxPlayers: number;
  readonly videoEnabled: boolean;
  readonly textChatEnabled: boolean;
  ownerUserId: string;
  notes = 'Configure the cast, gather the players, and start the game when every seat is filled.';

  constructor(config: MafiaRoomConfig & { sessionId: string; ownerUserId: string; onTimedPhaseChange: () => void }) {
    this.sessionId = config.sessionId;
    this.roomName = config.roomName;
    this.visibility = config.visibility;
    this.password = config.visibility === 'private' ? config.password : null;
    this.maxPlayers = config.maxPlayers;
    this.videoEnabled = config.videoEnabled;
    this.textChatEnabled = config.textChatEnabled;
    this.ownerUserId = config.ownerUserId;
    this.onTimedPhaseChange = config.onTimedPhaseChange;
    this.rolePlan = this.buildRoles(config);
  }

  get phase(): MafiaPhase {
    return this.phaseValue;
  }

  private buildRoles(config: MafiaRoomConfig): MafiaRoleConfigView[] {
    const civilianCount =
      config.maxPlayers - config.mafiaCount - config.detectiveCount - config.doctorCount - config.jesterCount;
    const roles: MafiaRoleConfigView[] = [
      { key: 'mafia', label: roleLabels.mafia, count: config.mafiaCount },
      { key: 'detective', label: roleLabels.detective, count: config.detectiveCount },
      { key: 'doctor', label: roleLabels.doctor, count: config.doctorCount },
      { key: 'jester', label: roleLabels.jester, count: config.jesterCount },
      { key: 'civilian', label: roleLabels.civilian, count: civilianCount }
    ];

    return roles.filter((entry) => entry.count > 0);
  }

  private summarizeRoles(roleKeys: MafiaRoleKey[]): MafiaRoleConfigView[] {
    return (Object.keys(roleLabels) as MafiaRoleKey[])
      .map((key) => ({
        key,
        label: roleLabels[key],
        count: roleKeys.filter((role) => role === key).length
      }))
      .filter((entry) => entry.count > 0);
  }

  private configuredSpecialRoleCount(): number {
    return this.rolePlan
      .filter((role) => role.key !== 'civilian')
      .reduce((total, role) => total + role.count, 0);
  }

  private minimumStartPlayerCount(): number {
    return Math.max(MIN_PLAYERS, this.configuredSpecialRoleCount());
  }

  private buildActiveRolesForPlayerCount(playerCount: number): MafiaRoleKey[] {
    const fixedRoles = this.rolePlan.flatMap((role) =>
      role.key === 'civilian' ? [] : Array.from({ length: role.count }, () => role.key)
    );

    if (fixedRoles.length > playerCount) {
      throw new HttpError(400, `This role setup needs at least ${fixedRoles.length} players before the game can start.`);
    }

    return [...fixedRoles, ...Array.from({ length: playerCount - fixedRoles.length }, () => 'civilian' as const)];
  }

  private waitingNote(): string {
    if (this.players.length === 0) {
      return 'Room is empty.';
    }

    const startThreshold = this.minimumStartPlayerCount();
    if (this.players.length >= startThreshold) {
      return this.players.length >= this.maxPlayers
        ? 'The cast is full. The room owner can start the game now.'
        : `The owner can start now with ${this.players.length} players, or wait for up to ${this.maxPlayers}.`;
    }

    const missingPlayers = startThreshold - this.players.length;
    return `Waiting for ${missingPlayers} more player${missingPlayers === 1 ? '' : 's'} before the owner can start.`;
  }

  isPrivate(): boolean {
    return this.visibility === 'private';
  }

  isFull(): boolean {
    return this.players.length >= this.maxPlayers;
  }

  isEmpty(): boolean {
    return this.players.length === 0;
  }

  hasUser(userId: string): boolean {
    return this.players.some((player) => player.userId === userId);
  }

  validatePassword(password?: string): void {
    if (this.password && this.password !== String(password || '')) {
      throw new HttpError(403, 'Incorrect Mafia room password.');
    }
  }

  matchesPrivatePassword(password?: string): boolean {
    return Boolean(this.password) && this.password === String(password || '');
  }

  addPlayer(player: Pick<RuntimePlayer, 'userId' | 'playerLabel' | 'avatarUrl'>): void {
    if (this.phaseValue !== 'waiting') {
      throw new HttpError(400, 'This Mafia game already started. Wait for the next room.');
    }

    if (this.hasUser(player.userId)) {
      return;
    }

    if (this.isFull()) {
      throw new HttpError(400, 'That Mafia room is already full.');
    }

    this.players.push({
      ...player,
      role: null,
      alive: true,
      lastNightTargetUserId: null,
      lastVoteTargetUserId: null,
      lastInvestigation: null
    });

    this.appendSystemMessage(`${player.playerLabel} joined the room.`);
    this.notes = this.waitingNote();
  }

  removePlayer(userId: string): void {
    const playerIndex = this.players.findIndex((player) => player.userId === userId);
    if (playerIndex === -1) {
      return;
    }

    const [removed] = this.players.splice(playerIndex, 1);
    this.appendSystemMessage(`${removed.playerLabel} left the room.`);

    if (this.ownerUserId === userId) {
      this.ownerUserId = this.players[0]?.userId || this.ownerUserId;
      if (this.players[0]) {
        this.appendSystemMessage(`${this.players[0].playerLabel} is now the room owner.`);
      }
    }

    if (this.phaseValue !== 'waiting' && this.phaseValue !== 'resolved') {
      this.notes = `${removed.playerLabel} left during the game. This room will stay in summary mode.`;
      this.phaseValue = 'resolved';
      this.winningSide = null;
      this.winnersValue = [];
      this.clearPhaseTimer();
    } else {
      this.notes = this.waitingNote();
    }
  }

  sendMessage(userId: string, payload?: Record<string, unknown>): void {
    if (!this.textChatEnabled) {
      throw new HttpError(400, 'Text chat is disabled in this Mafia room.');
    }

    const player = this.getPlayer(userId);
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!text) {
      throw new HttpError(400, 'Write a message before sending it.');
    }

    this.messages.push({
      id: buildMessageId(),
      userId: player.userId,
      playerLabel: player.playerLabel,
      text: text.slice(0, 220),
      createdAt: new Date().toISOString()
    });
    this.trimMessages();
  }

  startGame(userId: string): void {
    this.assertOwner(userId);

    if (this.phaseValue !== 'waiting') {
      throw new HttpError(400, 'This Mafia game already started.');
    }

    if (this.players.length < this.minimumStartPlayerCount()) {
      throw new HttpError(400, `You need at least ${this.minimumStartPlayerCount()} players to start this Mafia setup.`);
    }

    const shuffledRoles = shuffle(this.buildActiveRolesForPlayerCount(this.players.length));

    this.winningSide = null;
    this.winnersValue = [];
    this.activeRolePlanValue = this.summarizeRoles(shuffledRoles);

    this.players.forEach((player, index) => {
      player.role = shuffledRoles[index] || 'civilian';
      player.alive = true;
      player.lastNightTargetUserId = null;
      player.lastVoteTargetUserId = null;
      player.lastInvestigation = null;
    });

    this.roundNumberValue = 1;

    const mafiaCount = this.players.filter((player) => player.role === 'mafia').length;
    if (mafiaCount > 1) {
      this.phaseValue = 'mafia-intro';
      this.notes = 'First night: mafia members can see and hear only each other to get acquainted before the real night starts.';
      this.appendSystemMessage('The game started. Mafia intro is live. Only mafia members can privately coordinate right now.');
      this.schedulePhaseTimer();
      return;
    }

    this.phaseValue = 'night';
    this.notes = 'Night 1 started. Camera and audio are open to the full room again while mafia, doctor, and detective submit actions.';
    this.appendSystemMessage('The game started. Check your private role panel.');
    this.schedulePhaseTimer();
  }

  beginNight(userId: string): void {
    this.assertOwner(userId);

    if (this.phaseValue !== 'mafia-intro') {
      throw new HttpError(400, 'The mafia intro is not active right now.');
    }

    for (const player of this.players) {
      player.lastNightTargetUserId = null;
      player.lastVoteTargetUserId = null;
    }

    this.phaseValue = 'night';
    this.notes = `Night ${this.roundNumberValue} started. Camera and audio are open to the full room again while hidden actions are submitted.`;
    this.appendSystemMessage('The mafia intro ended. Full-room camera and audio returned for the night phase.');
    this.schedulePhaseTimer();
  }

  beginVoting(userId: string): void {
    this.assertOwner(userId);

    if (this.phaseValue !== 'day') {
      throw new HttpError(400, 'Voting can only open during the day discussion phase.');
    }

    for (const player of this.alivePlayers()) {
      player.lastVoteTargetUserId = null;
    }

    this.phaseValue = 'voting';
    this.notes = 'Voting is open. Every living player must cast one elimination vote.';
    this.appendSystemMessage(`Voting opened for day ${this.roundNumberValue}.`);
    this.schedulePhaseTimer();
  }

  submitNightAction(userId: string, payload?: Record<string, unknown>): void {
    if (this.phaseValue !== 'night') {
      throw new HttpError(400, 'Night actions are closed right now.');
    }

    const player = this.getPlayer(userId);
    if (!player.alive) {
      throw new HttpError(400, 'Eliminated players cannot act.');
    }

    if (!player.role || player.role === 'civilian' || player.role === 'jester') {
      throw new HttpError(400, 'Your role has no night action.');
    }

    const targetUserId = typeof payload?.targetUserId === 'string' ? payload.targetUserId : '';
    if (!targetUserId) {
      throw new HttpError(400, 'Choose a target first.');
    }

    const target = this.getPlayer(targetUserId);
    if (!target.alive) {
      throw new HttpError(400, 'That target is already out of the game.');
    }

    if (player.role === 'mafia' && target.role === 'mafia') {
      throw new HttpError(400, 'Mafia cannot target their own side.');
    }

    player.lastNightTargetUserId = target.userId;

    if (this.allRequiredNightActionsSubmitted()) {
      this.resolveNight();
    } else {
      this.notes = this.buildNightWaitingNote();
    }
  }

  submitVote(userId: string, payload?: Record<string, unknown>): void {
    if (this.phaseValue !== 'voting') {
      throw new HttpError(400, 'Voting is not open right now.');
    }

    const player = this.getPlayer(userId);
    if (!player.alive) {
      throw new HttpError(400, 'Eliminated players cannot vote.');
    }

    const targetUserId = typeof payload?.targetUserId === 'string' ? payload.targetUserId : '';
    if (!targetUserId) {
      throw new HttpError(400, 'Choose a vote target first.');
    }

    const target = this.getPlayer(targetUserId);
    if (!target.alive) {
      throw new HttpError(400, 'That target is already out of the game.');
    }

    if (target.userId === player.userId) {
      throw new HttpError(400, 'You cannot vote for yourself.');
    }

    player.lastVoteTargetUserId = target.userId;

    if (this.alivePlayers().every((entry) => Boolean(entry.lastVoteTargetUserId))) {
      this.resolveVote();
    } else {
      this.notes = 'Voting is live. Waiting for the remaining living players to cast a vote.';
    }
  }

  getSummary(): MafiaRoomSummary {
    return {
      sessionId: this.sessionId,
      roomName: this.roomName,
      visibility: this.visibility,
      maxPlayers: this.maxPlayers,
      playerCount: this.players.length,
      requiresPassword: Boolean(this.password),
      videoEnabled: this.videoEnabled,
      textChatEnabled: this.textChatEnabled,
      roles: (this.activeRolePlanValue || this.rolePlan).map((role) => ({ ...role }))
    };
  }

  buildStateForUser(userId: string): MafiaRoomState {
    const self = this.players.find((player) => player.userId === userId) || null;
    const mafiaMates = self?.role === 'mafia' ? this.alivePlayers().filter((player) => player.role === 'mafia' && player.userId !== userId) : [];
    const isResolved = this.phaseValue === 'resolved';

    return {
      kind: 'room',
      roomId: this.sessionId,
      roomName: this.roomName,
      visibility: this.visibility,
      requiresPassword: Boolean(this.password),
      maxPlayers: this.maxPlayers,
      ownerUserId: this.ownerUserId,
      phase: this.phaseValue,
      roundNumber: this.roundNumberValue,
      videoEnabled: this.videoEnabled,
      textChatEnabled: this.textChatEnabled,
      roles: (this.activeRolePlanValue || this.rolePlan).map((role) => ({ ...role })),
      players: this.players.map((player, index) => ({
        userId: player.userId,
        playerLabel: player.playerLabel,
        avatarUrl: player.avatarUrl,
        seatIndex: index,
        isSelf: player.userId === userId,
        isOwner: player.userId === this.ownerUserId,
        alive: player.alive,
        roleHint: player.userId === userId
          ? (player.role ? roleLabels[player.role] : null)
          : self?.role === 'mafia' && player.role === 'mafia' && player.alive
            ? 'Mafia ally'
            : null,
        revealedRole: !player.alive || isResolved ? player.role : null,
        isKnownAlly: Boolean(self?.role === 'mafia' && player.role === 'mafia' && player.userId !== userId)
      })),
      messages: this.messages.map((message) => ({ ...message })),
      notes: this.notes,
      phaseEndsAt: this.phaseEndsAtValue?.toISOString(),
      isSeated: Boolean(self),
      canJoin: !self && !this.isFull() && this.phaseValue === 'waiting',
      selfRole: self?.role || null,
      selfTeamHint: mafiaMates.length ? `Allies: ${mafiaMates.map((entry) => entry.playerLabel).join(', ')}` : null,
      lastInvestigation: self?.lastInvestigation || null,
      actionOptions: self ? this.buildActionOptionsFor(self) : [],
      hasSubmittedAction: self ? this.hasSubmittedAction(self) : false,
      canStartGame: Boolean(
        self &&
          self.userId === this.ownerUserId &&
          this.phaseValue === 'waiting' &&
          this.players.length >= this.minimumStartPlayerCount()
      ),
      canAdvanceIntro: Boolean(self && self.userId === this.ownerUserId && this.phaseValue === 'mafia-intro'),
      canAdvancePhase: Boolean(self && self.userId === this.ownerUserId && this.phaseValue === 'day'),
      winners: this.winnersValue.length ? this.winnersValue.map((winner) => ({ ...winner })) : undefined
    };
  }

  buildMediaAccessForUser(userId: string): {
    roomId: string;
    videoEnabled: boolean;
    phase: MafiaPhase;
    canPublish: boolean;
    allowedPeerIds: string[];
  } {
    const self = this.players.find((player) => player.userId === userId) || null;
    if (!self || !this.videoEnabled) {
      return {
        roomId: this.sessionId,
        videoEnabled: this.videoEnabled,
        phase: this.phaseValue,
        canPublish: false,
        allowedPeerIds: []
      };
    }

    if (this.phaseValue === 'mafia-intro') {
      if (self.role !== 'mafia') {
        return {
          roomId: this.sessionId,
          videoEnabled: this.videoEnabled,
          phase: this.phaseValue,
          canPublish: false,
          allowedPeerIds: []
        };
      }

      return {
        roomId: this.sessionId,
        videoEnabled: this.videoEnabled,
        phase: this.phaseValue,
        canPublish: true,
        allowedPeerIds: this.players
          .filter((player) => player.userId !== userId && player.role === 'mafia')
          .map((player) => player.userId)
      };
    }

    return {
      roomId: this.sessionId,
      videoEnabled: this.videoEnabled,
      phase: this.phaseValue,
      canPublish: true,
      allowedPeerIds: this.players.filter((player) => player.userId !== userId).map((player) => player.userId)
    };
  }

  private buildActionOptionsFor(player: RuntimePlayer): MafiaActionOptionView[] {
    if (!player.alive) {
      return [];
    }

    if (this.phaseValue === 'night') {
      if (!player.role || player.role === 'civilian' || player.role === 'jester') {
        return [];
      }

      return this.alivePlayers()
        .filter((candidate) => {
          if (candidate.userId === player.userId && player.role !== 'doctor') {
            return false;
          }

          if (player.role === 'mafia' && candidate.role === 'mafia') {
            return false;
          }

          return true;
        })
        .map((candidate) => ({
          userId: candidate.userId,
          playerLabel: candidate.playerLabel
        }));
    }

    if (this.phaseValue === 'voting') {
      return this.alivePlayers()
        .filter((candidate) => candidate.userId !== player.userId)
        .map((candidate) => ({
          userId: candidate.userId,
          playerLabel: candidate.playerLabel
        }));
    }

    return [];
  }

  private hasSubmittedAction(player: RuntimePlayer): boolean {
    if (this.phaseValue === 'night') {
      return Boolean(player.lastNightTargetUserId);
    }

    if (this.phaseValue === 'voting') {
      return Boolean(player.lastVoteTargetUserId);
    }

    return false;
  }

  private resolveNight(): void {
    const mafiaVotes = this.alivePlayers()
      .filter((player) => player.role === 'mafia' && player.lastNightTargetUserId)
      .map((player) => player.lastNightTargetUserId as string);

    const doctorSave = this.alivePlayers().find((player) => player.role === 'doctor')?.lastNightTargetUserId || null;
    const detective = this.alivePlayers().find((player) => player.role === 'detective') || null;
    const killTargetId = this.resolveMajorityTarget(mafiaVotes);
    const killTarget = killTargetId ? this.players.find((player) => player.userId === killTargetId) || null : null;
    const saved = Boolean(killTarget && doctorSave === killTarget.userId);

    if (detective?.lastNightTargetUserId) {
      const investigated = this.getPlayer(detective.lastNightTargetUserId);
      detective.lastInvestigation = `${investigated.playerLabel} is ${investigated.role === 'mafia' ? 'Mafia' : 'not Mafia'}.`;
    }

    if (killTarget && !saved) {
      killTarget.alive = false;
      this.appendSystemMessage(`${killTarget.playerLabel} was found dead. Their role was ${roleLabels[killTarget.role || 'civilian']}.`);
    } else if (killTarget && saved) {
      this.appendSystemMessage(`${killTarget.playerLabel} survived the night. Someone protected them.`);
    } else {
      this.appendSystemMessage('The night passed without a kill.');
    }

    for (const player of this.players) {
      player.lastNightTargetUserId = null;
      player.lastVoteTargetUserId = null;
    }

    const winner = this.computeWinner(killTarget?.role === 'jester' ? 'jester' : null);
    if (winner) {
      this.applyWinner(winner);
      return;
    }

    this.phaseValue = 'day';
    this.notes = `Day ${this.roundNumberValue} started. Discuss what happened, then the owner can open voting.`;
    this.schedulePhaseTimer();
  }

  private resolveVote(): void {
    const votes = this.alivePlayers().map((player) => player.lastVoteTargetUserId).filter(Boolean) as string[];
    const eliminatedId = this.resolveMajorityTarget(votes);
    const eliminated = eliminatedId ? this.players.find((player) => player.userId === eliminatedId) || null : null;

    if (eliminated) {
      eliminated.alive = false;
      this.appendSystemMessage(`${eliminated.playerLabel} was voted out. Their role was ${roleLabels[eliminated.role || 'civilian']}.`);
    } else {
      this.appendSystemMessage('Voting ended in a tie. Nobody was eliminated.');
    }

    for (const player of this.players) {
      player.lastVoteTargetUserId = null;
      player.lastNightTargetUserId = null;
    }

    const winner = this.computeWinner(eliminated?.role === 'jester' ? 'jester' : null);
    if (winner) {
      this.applyWinner(winner);
      return;
    }

    this.phaseValue = 'night';
    this.roundNumberValue += 1;
    this.notes = `Night ${this.roundNumberValue} started. Camera and audio stay open to the full room while hidden actions are submitted.`;
    this.schedulePhaseTimer();
  }

  private computeWinner(forcedJesterWin: MafiaWinnerSide | null): MafiaWinnerSide | null {
    if (forcedJesterWin === 'jester') {
      return 'jester';
    }

    const aliveMafia = this.alivePlayers().filter((player) => player.role === 'mafia').length;
    const aliveTown = this.alivePlayers().filter((player) => player.role !== 'mafia').length;

    if (aliveMafia === 0) {
      return 'town';
    }

    if (aliveMafia >= aliveTown) {
      return 'mafia';
    }

    return null;
  }

  private applyWinner(side: MafiaWinnerSide): void {
    this.phaseValue = 'resolved';
    this.winningSide = side;
    this.winnersValue = this.players
      .filter((player) => {
        if (side === 'jester') {
          return player.role === 'jester';
        }

        if (side === 'mafia') {
          return player.role === 'mafia';
        }

        return player.role !== 'mafia';
      })
      .map((player) => ({
        side,
        label: player.playerLabel
      }));

    this.notes =
      side === 'jester'
        ? 'The jester got themselves executed and stole the win.'
        : side === 'mafia'
          ? 'Mafia reached parity and controls the room.'
          : 'Town eliminated every mafia member.';
    this.appendSystemMessage(this.notes);
    this.clearPhaseTimer();
  }

  destroy(): void {
    this.clearPhaseTimer();
  }

  private schedulePhaseTimer(): void {
    this.clearPhaseTimer();

    if (!['mafia-intro', 'night', 'day', 'voting'].includes(this.phaseValue)) {
      return;
    }

    this.phaseEndsAtValue = new Date(Date.now() + PHASE_DURATION_MS);
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      this.advanceTimedPhase();
      this.onTimedPhaseChange();
    }, PHASE_DURATION_MS);
  }

  private clearPhaseTimer(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }

    this.phaseEndsAtValue = null;
  }

  private advanceTimedPhase(): void {
    switch (this.phaseValue) {
      case 'mafia-intro':
        for (const player of this.players) {
          player.lastNightTargetUserId = null;
          player.lastVoteTargetUserId = null;
        }
        this.phaseValue = 'night';
        this.notes = `Night ${this.roundNumberValue} started automatically. Hidden actions are open.`;
        this.appendSystemMessage('Mafia intro timed out. Full-room camera and audio returned for the night phase.');
        this.schedulePhaseTimer();
        return;
      case 'night':
        this.appendSystemMessage('Night timed out. Resolving with submitted actions.');
        this.resolveNight();
        return;
      case 'day':
        for (const player of this.alivePlayers()) {
          player.lastVoteTargetUserId = null;
        }
        this.phaseValue = 'voting';
        this.notes = 'Day discussion timed out. Voting is open.';
        this.appendSystemMessage(`Voting opened automatically for day ${this.roundNumberValue}.`);
        this.schedulePhaseTimer();
        return;
      case 'voting':
        this.appendSystemMessage('Voting timed out. Resolving with submitted votes.');
        this.resolveVote();
        return;
      default:
        this.clearPhaseTimer();
    }
  }

  private allRequiredNightActionsSubmitted(): boolean {
    return this.alivePlayers()
      .filter((player) => player.role === 'mafia' || player.role === 'doctor' || player.role === 'detective')
      .every((player) => Boolean(player.lastNightTargetUserId));
  }

  private buildNightWaitingNote(): string {
    const pendingRoles = this.alivePlayers()
      .filter((player) => player.role === 'mafia' || player.role === 'doctor' || player.role === 'detective')
      .filter((player) => !player.lastNightTargetUserId)
      .map((player) => roleLabels[player.role || 'civilian']);

    return pendingRoles.length
      ? `Night actions pending: ${pendingRoles.join(', ')}.`
      : 'Night actions are being resolved.';
  }

  private resolveMajorityTarget(targetIds: string[]): string | null {
    if (!targetIds.length) {
      return null;
    }

    const counts = new Map<string, number>();
    for (const targetId of targetIds) {
      counts.set(targetId, (counts.get(targetId) || 0) + 1);
    }

    let bestTarget: string | null = null;
    let bestCount = 0;
    let tie = false;

    for (const [targetId, count] of counts.entries()) {
      if (count > bestCount) {
        bestTarget = targetId;
        bestCount = count;
        tie = false;
      } else if (count === bestCount) {
        tie = true;
      }
    }

    return tie ? null : bestTarget;
  }

  private alivePlayers(): RuntimePlayer[] {
    return this.players.filter((player) => player.alive);
  }

  private getPlayer(userId: string): RuntimePlayer {
    const player = this.players.find((entry) => entry.userId === userId);
    if (!player) {
      throw new HttpError(403, 'Join the room before taking game actions.');
    }

    return player;
  }

  private assertOwner(userId: string): void {
    if (this.ownerUserId !== userId) {
      throw new HttpError(403, 'Only the room owner can do that.');
    }
  }

  private appendSystemMessage(text: string): void {
    this.messages.push({
      id: buildMessageId(),
      userId: 'system',
      playerLabel: 'System',
      text,
      createdAt: new Date().toISOString(),
      isSystem: true
    });
    this.trimMessages();
  }

  private trimMessages(): void {
    if (this.messages.length > MAX_CHAT_MESSAGES) {
      this.messages.splice(0, this.messages.length - MAX_CHAT_MESSAGES);
    }
  }
}

class MafiaRoomManager {
  private readonly listeners = new Set<() => void>();
  private readonly rooms = new Map<string, MafiaRoom>();
  private readonly userRoom = new Map<string, string>();

  getLobbySessionId(): string {
    return LOBBY_SESSION_ID;
  }

  onStateChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async getStateForUser(userId: string, requestedSessionId = LOBBY_SESSION_ID): Promise<MafiaPlayerEnvelope> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true }
    });

    if (!user) {
      throw new HttpError(404, 'Authenticated user could not be found.');
    }

    const visibleRoom = this.resolveVisibleRoom(requestedSessionId, this.userRoom.get(userId));
    if (!visibleRoom) {
      return {
        sessionId: LOBBY_SESSION_ID,
        gameType: 'MAFIA',
        status: GameSessionStatus.IDLE,
        balance: fromDbAmount(user.balance),
        currentBet: 0,
        state: {
          kind: 'lobby',
          rooms: [...this.rooms.values()]
            .filter((room) => !room.isPrivate())
            .map((room) => room.getSummary())
            .sort((left, right) => right.playerCount - left.playerCount),
          notes: 'Create a room, tune the role mix, and gather your full cast.'
        },
        outcome: null
      };
    }

    return {
      sessionId: visibleRoom.getSummary().sessionId,
      gameType: 'MAFIA',
      status: visibleRoom.phase === 'resolved' ? GameSessionStatus.COMPLETED : GameSessionStatus.WAITING_ACTION,
      balance: fromDbAmount(user.balance),
      currentBet: 0,
      state: visibleRoom.buildStateForUser(userId),
      outcome: null
    };
  }

  async createRoom(userId: string, payload?: Record<string, unknown>): Promise<string> {
    if (this.rooms.size >= MAX_ROOMS) {
      throw new HttpError(400, 'The demo already has the maximum number of active Mafia rooms.');
    }

    if (this.userRoom.has(userId)) {
      throw new HttpError(400, 'Leave your current Mafia room before creating another one.');
    }

    const config = normalizeRoomConfig(payload);
    const user = await this.requireUserIdentity(userId);
    const room = new MafiaRoom({
      ...config,
      sessionId: buildRoomId(),
      ownerUserId: user.id,
      onTimedPhaseChange: () => this.emitStateChange()
    });

    room.addPlayer({
      userId: user.id,
      playerLabel: user.playerLabel,
      avatarUrl: user.avatarUrl
    });

    this.rooms.set(room.sessionId, room);
    this.userRoom.set(user.id, room.sessionId);
    this.emitStateChange();
    return room.sessionId;
  }

  async joinRoom(userId: string, payload?: Record<string, unknown>): Promise<string> {
    if (this.userRoom.has(userId)) {
      throw new HttpError(400, 'Leave your current Mafia room before joining another one.');
    }

    const user = await this.requireUserIdentity(userId);
    const { sessionId, password } = normalizeJoinConfig(payload);
    const room = sessionId ? this.requireRoom(sessionId) : this.findPrivateRoomByPassword(password);
    room.validatePassword(password);
    room.addPlayer({
      userId: user.id,
      playerLabel: user.playerLabel,
      avatarUrl: user.avatarUrl
    });

    this.userRoom.set(user.id, room.sessionId);
    this.emitStateChange();
    return room.sessionId;
  }

  async leaveRoom(userId: string): Promise<void> {
    const roomId = this.userRoom.get(userId);
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    this.userRoom.delete(userId);

    if (!room) {
      this.emitStateChange();
      return;
    }

    room.removePlayer(userId);
    if (room.isEmpty()) {
      room.destroy();
      this.rooms.delete(roomId);
    }

    this.emitStateChange();
  }

  async performAction(userId: string, sessionId: string | undefined, action: string, payload?: Record<string, unknown>): Promise<void> {
    const room = this.requireRoom(sessionId || this.userRoom.get(userId));

    switch (action) {
      case 'send-message':
        room.sendMessage(userId, payload);
        break;
      case 'start-game':
        room.startGame(userId);
        break;
      case 'begin-night':
        room.beginNight(userId);
        break;
      case 'begin-vote':
        room.beginVoting(userId);
        break;
      case 'submit-night-action':
        room.submitNightAction(userId, payload);
        break;
      case 'submit-vote':
        room.submitVote(userId, payload);
        break;
      default:
        throw new HttpError(400, `Unsupported Mafia action: ${action}`);
    }

    this.emitStateChange();
  }

  private async requireUserIdentity(userId: string): Promise<{ id: string; playerLabel: string; avatarUrl: string | null }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true
      }
    });

    if (!user) {
      throw new HttpError(404, 'Authenticated user could not be found.');
    }

    return {
      id: user.id,
      playerLabel: formatPlayerLabel(user.email, user.username),
      avatarUrl: user.avatarUrl
    };
  }

  private resolveVisibleRoom(requestedSessionId?: string, assignedRoomId?: string): MafiaRoom | null {
    if (requestedSessionId && requestedSessionId !== LOBBY_SESSION_ID) {
      const room = this.rooms.get(requestedSessionId);
      if (room) {
        return room;
      }
    }

    if (assignedRoomId) {
      return this.rooms.get(assignedRoomId) || null;
    }

    return null;
  }

  private requireRoom(sessionId: string | undefined): MafiaRoom {
    if (!sessionId || sessionId === LOBBY_SESSION_ID) {
      throw new HttpError(400, 'Mafia room session is missing.');
    }

    const room = this.rooms.get(sessionId);
    if (!room) {
      throw new HttpError(404, 'That Mafia room was not found.');
    }

    return room;
  }

  getMediaAccessForUser(userId: string, sessionId: string): {
    roomId: string;
    videoEnabled: boolean;
    phase: MafiaPhase;
    canPublish: boolean;
    allowedPeerIds: string[];
  } {
    const room = this.requireRoom(sessionId);
    return room.buildMediaAccessForUser(userId);
  }

  private findPrivateRoomByPassword(password?: string): MafiaRoom {
    const room = [...this.rooms.values()].find((entry) => entry.isPrivate() && entry.matchesPrivatePassword(password));
    if (!room) {
      throw new HttpError(404, 'That private Mafia room was not found.');
    }

    return room;
  }

  private emitStateChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const mafiaRoomManager = new MafiaRoomManager();
