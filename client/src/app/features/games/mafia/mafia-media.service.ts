import { Injectable, inject, signal } from '@angular/core';

import type { MafiaRoomState } from '../../../core/models/game.model';
import { GameSocketService } from '../../../core/services/game-socket.service';

interface MafiaMediaStatusPayload {
  sessionId: string;
  sourceUserId: string;
  cameraEnabled: boolean;
  audioEnabled: boolean;
}

interface MafiaMediaSnapshotPayload {
  sessionId: string;
  participants: MafiaMediaStatusPayload[];
}

interface MafiaMediaSignalPayload {
  sessionId: string;
  sourceUserId: string;
  targetUserId?: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface MafiaSeatMediaView {
  stream: MediaStream | null;
  cameraEnabled: boolean;
  audioEnabled: boolean;
  isSelf: boolean;
}

type MediaKind = 'audio' | 'video';

@Injectable({
  providedIn: 'root'
})
export class MafiaMediaService {
  private readonly socket = inject(GameSocketService);
  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  };

  private readonly peerConnections = new Map<string, RTCPeerConnection>();
  private readonly remoteStreams = new Map<string, MediaStream>();
  private readonly remoteStatuses = new Map<string, { cameraEnabled: boolean; audioEnabled: boolean }>();
  private cleanupListeners: Array<() => void> = [];
  private currentSessionId: string | null = null;
  private currentUserId: string | null = null;
  private participantIds = new Set<string>();
  private allowedPeerIds = new Set<string>();
  private listenersAttached = false;
  private localStream: MediaStream | null = null;
  private roomVideoEnabled = false;
  private selfIsSeated = false;
  private canEnablePublishing = false;

  readonly seatMedia = signal<Record<string, MafiaSeatMediaView>>({});
  readonly mediaError = signal<string | null>(null);
  readonly cameraEnabled = signal(false);
  readonly microphoneEnabled = signal(false);
  readonly isSupported = signal(
    typeof globalThis !== 'undefined' &&
      'RTCPeerConnection' in globalThis &&
      'MediaStream' in globalThis &&
      'navigator' in globalThis &&
      Boolean(globalThis.navigator?.mediaDevices?.getUserMedia)
  );

  attach(): void {
    if (this.listenersAttached) {
      return;
    }

    this.listenersAttached = true;
    this.cleanupListeners = [
      this.socket.onEvent<MafiaMediaStatusPayload>('mafia:media-status', (payload) => this.applyRemoteStatus(payload)),
      this.socket.onEvent<MafiaMediaSnapshotPayload>('mafia:media-snapshot', (payload) => this.applySnapshot(payload)),
      this.socket.onEvent<MafiaMediaSignalPayload>('mafia:media-signal', (payload) => {
        void this.handleSignal(payload);
      })
    ];
  }

  detach(): void {
    this.cleanupListeners.forEach((cleanup) => cleanup());
    this.cleanupListeners = [];
    this.listenersAttached = false;
    this.clearAllPeerConnections();
    this.stopAndReleaseLocalTracks();
    this.remoteStreams.clear();
    this.remoteStatuses.clear();
    this.participantIds.clear();
    this.allowedPeerIds.clear();
    this.currentSessionId = null;
    this.currentUserId = null;
    this.roomVideoEnabled = false;
    this.selfIsSeated = false;
    this.canEnablePublishing = false;
    this.cameraEnabled.set(false);
    this.microphoneEnabled.set(false);
    this.mediaError.set(null);
    this.rebuildSeatMedia();
  }

  syncRoomState(room: MafiaRoomState | null, currentUserId: string | null): void {
    const previousSessionId = this.currentSessionId;
    const nextSessionId = room?.roomId || null;

    this.currentUserId = currentUserId;

    if (!room) {
      this.currentSessionId = null;
      this.roomVideoEnabled = false;
      this.selfIsSeated = false;
      this.canEnablePublishing = false;
      this.participantIds.clear();
      this.allowedPeerIds.clear();
      this.clearAllPeerConnections();
      this.remoteStreams.clear();
      this.remoteStatuses.clear();
      this.stopAndReleaseLocalTracks();
      this.cameraEnabled.set(false);
      this.microphoneEnabled.set(false);
      this.rebuildSeatMedia();
      return;
    }

    if (previousSessionId && previousSessionId !== nextSessionId) {
      this.remoteStreams.clear();
      this.remoteStatuses.clear();
      this.allowedPeerIds.clear();
      this.clearAllPeerConnections();
      this.stopAndReleaseLocalTracks();
      this.cameraEnabled.set(false);
      this.microphoneEnabled.set(false);
    }

    this.currentSessionId = nextSessionId;
    this.roomVideoEnabled = room.videoEnabled;
    this.selfIsSeated = room.isSeated;
    this.participantIds = new Set(room.players.map((player) => player.userId));
    this.allowedPeerIds = new Set(this.computeAllowedPeerIds(room));
    this.canEnablePublishing = this.roomVideoEnabled && this.selfIsSeated && (room.phase !== 'mafia-intro' || room.selfRole === 'mafia');

    if (!this.roomVideoEnabled || !this.selfIsSeated) {
      this.remoteStreams.clear();
      this.remoteStatuses.clear();
      this.allowedPeerIds.clear();
      this.clearAllPeerConnections();
      this.stopPublishing();
      return;
    }

    for (const remoteUserId of Array.from(this.remoteStreams.keys())) {
      if (!this.allowedPeerIds.has(remoteUserId)) {
        this.remoteStreams.delete(remoteUserId);
      }
    }

    for (const remoteUserId of Array.from(this.remoteStatuses.keys())) {
      if (!this.allowedPeerIds.has(remoteUserId)) {
        this.remoteStatuses.delete(remoteUserId);
      }
    }

    for (const [remoteUserId, connection] of Array.from(this.peerConnections.entries())) {
      if (!this.allowedPeerIds.has(remoteUserId) || !this.participantIds.has(remoteUserId) || remoteUserId === this.currentUserId) {
        connection.close();
        this.peerConnections.delete(remoteUserId);
      }
    }

    this.rebuildSeatMedia();
    this.ensurePeerConnections();
  }

  async toggleCamera(): Promise<void> {
    try {
      if (this.cameraEnabled()) {
        this.disableTrack('video');
        await this.afterLocalMediaChanged();
        return;
      }

      if (!this.ensurePublishingAllowed()) {
        return;
      }

      await this.enableTrack('video');
      await this.afterLocalMediaChanged();
    } catch (error) {
      this.mediaError.set(error instanceof Error ? error.message : 'Camera could not be started.');
    }
  }

  async toggleMicrophone(): Promise<void> {
    try {
      if (this.microphoneEnabled()) {
        this.disableTrack('audio');
        await this.afterLocalMediaChanged();
        return;
      }

      if (!this.ensurePublishingAllowed()) {
        return;
      }

      await this.enableTrack('audio');
      await this.afterLocalMediaChanged();
    } catch (error) {
      this.mediaError.set(error instanceof Error ? error.message : 'Microphone could not be started.');
    }
  }

  private computeAllowedPeerIds(room: MafiaRoomState): string[] {
    if (!room.videoEnabled || !room.isSeated) {
      return [];
    }

    if (room.phase === 'mafia-intro') {
      if (room.selfRole !== 'mafia') {
        return [];
      }

      return room.players.filter((player) => player.isKnownAlly).map((player) => player.userId);
    }

    return room.players.filter((player) => !player.isSelf).map((player) => player.userId);
  }

  private ensurePublishingAllowed(): boolean {
    if (!this.isSupported()) {
      this.mediaError.set('This browser does not support live room audio and video.');
      return false;
    }

    if (!this.roomVideoEnabled) {
      this.mediaError.set('Video and audio are disabled in this Mafia room.');
      return false;
    }

    if (!this.selfIsSeated) {
      this.mediaError.set('Join the Mafia room before turning on camera or microphone.');
      return false;
    }

    if (!this.currentSessionId || !this.currentUserId) {
      this.mediaError.set('Reconnect to the room and try again.');
      return false;
    }

    if (!this.canEnablePublishing) {
      this.mediaError.set('During the mafia intro only mafia members can go live.');
      return false;
    }

    this.mediaError.set(null);
    return true;
  }

  private async enableTrack(kind: MediaKind): Promise<void> {
    const constraints = kind === 'video' ? { video: true, audio: false } : { video: false, audio: true };
    const capture = await navigator.mediaDevices.getUserMedia(constraints);
    const nextTrack = kind === 'video' ? capture.getVideoTracks()[0] : capture.getAudioTracks()[0];

    if (!nextTrack) {
      throw new Error(kind === 'video' ? 'No camera track was returned.' : 'No microphone track was returned.');
    }

    if (!this.localStream) {
      this.localStream = new MediaStream();
    }

    this.disableTrack(kind, false);
    this.localStream.addTrack(nextTrack);

    if (kind === 'video') {
      this.cameraEnabled.set(true);
    } else {
      this.microphoneEnabled.set(true);
    }

    nextTrack.addEventListener('ended', () => {
      this.disableTrack(kind);
      void this.afterLocalMediaChanged();
    });
  }

  private disableTrack(kind: MediaKind, syncPeers = true): void {
    if (!this.localStream) {
      if (kind === 'video') {
        this.cameraEnabled.set(false);
      } else {
        this.microphoneEnabled.set(false);
      }
      return;
    }

    const tracks = kind === 'video' ? this.localStream.getVideoTracks() : this.localStream.getAudioTracks();
    for (const track of tracks) {
      this.localStream.removeTrack(track);
      track.stop();
    }

    if (kind === 'video') {
      this.cameraEnabled.set(false);
    } else {
      this.microphoneEnabled.set(false);
    }

    if (syncPeers) {
      this.syncLocalTracksToPeers();
    }
  }

  private stopPublishing(): void {
    this.stopAndReleaseLocalTracks();
    this.cameraEnabled.set(false);
    this.microphoneEnabled.set(false);
    this.rebuildSeatMedia();
  }

  private stopAndReleaseLocalTracks(): void {
    if (!this.localStream) {
      return;
    }

    for (const track of this.localStream.getTracks()) {
      this.localStream.removeTrack(track);
      track.stop();
    }

    this.localStream = null;
    this.syncLocalTracksToPeers();
  }

  private async afterLocalMediaChanged(): Promise<void> {
    this.syncLocalTracksToPeers();
    await this.renegotiateAllPeers();
    this.broadcastStatus(this.currentSessionId, this.cameraEnabled(), this.microphoneEnabled());
    this.rebuildSeatMedia();
  }

  private ensurePeerConnections(): void {
    if (!this.currentSessionId || !this.currentUserId) {
      return;
    }

    for (const remoteUserId of this.allowedPeerIds) {
      if (remoteUserId === this.currentUserId) {
        continue;
      }

      const connection = this.ensurePeerConnection(remoteUserId);
      if (this.shouldInitiatePeer(remoteUserId) && !connection.localDescription && !connection.remoteDescription) {
        void this.createAndSendOffer(remoteUserId);
      }
    }
  }

  private shouldInitiatePeer(remoteUserId: string): boolean {
    if (!this.currentUserId) {
      return false;
    }

    return this.currentUserId.localeCompare(remoteUserId) > 0;
  }

  private ensurePeerConnection(remoteUserId: string): RTCPeerConnection {
    const existing = this.peerConnections.get(remoteUserId);
    if (existing) {
      return existing;
    }

    const connection = new RTCPeerConnection(this.rtcConfig);

    connection.onicecandidate = (event) => {
      if (!event.candidate || !this.currentSessionId) {
        return;
      }

      this.socket.emitEvent('mafia:media-signal', {
        sessionId: this.currentSessionId,
        targetUserId: remoteUserId,
        candidate: event.candidate.toJSON()
      });
    };

    connection.ontrack = (event) => {
      const [stream] = event.streams;
      const nextStream = stream || this.remoteStreams.get(remoteUserId) || new MediaStream();

      if (!stream) {
        nextStream.addTrack(event.track);
      }

      this.remoteStreams.set(remoteUserId, nextStream);
      this.rebuildSeatMedia();
    };

    connection.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(connection.connectionState)) {
        this.peerConnections.delete(remoteUserId);
      }
    };

    this.peerConnections.set(remoteUserId, connection);
    this.syncLocalTracksToPeer(connection);
    return connection;
  }

  private async createAndSendOffer(remoteUserId: string): Promise<void> {
    if (!this.currentSessionId) {
      return;
    }

    const connection = this.ensurePeerConnection(remoteUserId);
    if (connection.signalingState !== 'stable') {
      return;
    }

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    this.socket.emitEvent('mafia:media-signal', {
      sessionId: this.currentSessionId,
      targetUserId: remoteUserId,
      description: connection.localDescription
    });
  }

  private async handleSignal(payload: MafiaMediaSignalPayload): Promise<void> {
    if (
      !this.currentSessionId ||
      payload.sessionId !== this.currentSessionId ||
      !payload.sourceUserId ||
      !this.allowedPeerIds.has(payload.sourceUserId)
    ) {
      return;
    }

    const connection = this.ensurePeerConnection(payload.sourceUserId);

    if (payload.description) {
      const description = new RTCSessionDescription(payload.description);

      if (description.type === 'offer') {
        await connection.setRemoteDescription(description);
        this.syncLocalTracksToPeer(connection);

        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        this.socket.emitEvent('mafia:media-signal', {
          sessionId: this.currentSessionId,
          targetUserId: payload.sourceUserId,
          description: connection.localDescription
        });
        return;
      }

      await connection.setRemoteDescription(description);
      return;
    }

    if (payload.candidate) {
      await connection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    }
  }

  private syncLocalTracksToPeers(): void {
    for (const [remoteUserId, connection] of this.peerConnections.entries()) {
      if (!this.allowedPeerIds.has(remoteUserId)) {
        connection.close();
        this.peerConnections.delete(remoteUserId);
        continue;
      }

      this.syncLocalTracksToPeer(connection);
    }

    this.rebuildSeatMedia();
  }

  private syncLocalTracksToPeer(connection: RTCPeerConnection): void {
    const localTracks = this.localStream?.getTracks() || [];
    const senders = connection.getSenders();

    for (const sender of senders) {
      const matchingTrack = localTracks.find((track) => track.kind === sender.track?.kind);

      if (!matchingTrack) {
        connection.removeTrack(sender);
        continue;
      }

      if (sender.track !== matchingTrack) {
        void sender.replaceTrack(matchingTrack);
      }
    }

    for (const track of localTracks) {
      const alreadySending = senders.some((sender) => sender.track?.kind === track.kind);
      if (!alreadySending && this.localStream) {
        connection.addTrack(track, this.localStream);
      }
    }
  }

  private async renegotiateAllPeers(): Promise<void> {
    await Promise.all(
      Array.from(this.peerConnections.entries()).map(async ([remoteUserId, connection]) => {
        if (!this.allowedPeerIds.has(remoteUserId)) {
          return;
        }

        if (connection.signalingState === 'stable') {
          await this.createAndSendOffer(remoteUserId);
        }
      })
    );
  }

  private applySnapshot(payload: MafiaMediaSnapshotPayload): void {
    if (!this.currentSessionId || payload.sessionId !== this.currentSessionId) {
      return;
    }

    const nextStatuses = new Map<string, { cameraEnabled: boolean; audioEnabled: boolean }>();
    for (const participant of payload.participants) {
      if (!participant.sourceUserId || !this.allowedPeerIds.has(participant.sourceUserId)) {
        continue;
      }

      nextStatuses.set(participant.sourceUserId, {
        cameraEnabled: participant.cameraEnabled,
        audioEnabled: participant.audioEnabled
      });
    }

    for (const remoteUserId of Array.from(this.remoteStatuses.keys())) {
      if (!nextStatuses.has(remoteUserId)) {
        this.remoteStatuses.delete(remoteUserId);
        this.remoteStreams.delete(remoteUserId);
      }
    }

    for (const [remoteUserId, status] of nextStatuses.entries()) {
      this.remoteStatuses.set(remoteUserId, status);
    }

    this.rebuildSeatMedia();
  }

  private applyRemoteStatus(payload: MafiaMediaStatusPayload): void {
    if (
      !this.currentSessionId ||
      payload.sessionId !== this.currentSessionId ||
      !payload.sourceUserId ||
      !this.allowedPeerIds.has(payload.sourceUserId)
    ) {
      return;
    }

    if (!payload.cameraEnabled && !payload.audioEnabled) {
      this.remoteStatuses.delete(payload.sourceUserId);
      this.remoteStreams.delete(payload.sourceUserId);
    } else {
      this.remoteStatuses.set(payload.sourceUserId, {
        cameraEnabled: payload.cameraEnabled,
        audioEnabled: payload.audioEnabled
      });
    }

    this.rebuildSeatMedia();
  }

  private broadcastStatus(sessionId: string | null, cameraEnabled: boolean, audioEnabled: boolean): void {
    if (!sessionId || !this.currentUserId || !this.roomVideoEnabled || !this.selfIsSeated) {
      return;
    }

    this.socket.emitEvent('mafia:media-status', {
      sessionId,
      cameraEnabled,
      audioEnabled
    });
  }

  private rebuildSeatMedia(): void {
    const seatMedia: Record<string, MafiaSeatMediaView> = {};

    if (this.currentUserId && (this.cameraEnabled() || this.microphoneEnabled())) {
      seatMedia[this.currentUserId] = {
        stream: this.localStream,
        cameraEnabled: this.cameraEnabled(),
        audioEnabled: this.microphoneEnabled(),
        isSelf: true
      };
    }

    for (const remoteUserId of this.allowedPeerIds) {
      const status = this.remoteStatuses.get(remoteUserId);
      if (!status) {
        continue;
      }

      seatMedia[remoteUserId] = {
        stream: this.remoteStreams.get(remoteUserId) || null,
        cameraEnabled: status.cameraEnabled,
        audioEnabled: status.audioEnabled,
        isSelf: false
      };
    }

    this.seatMedia.set(seatMedia);
  }

  private clearAllPeerConnections(): void {
    for (const connection of this.peerConnections.values()) {
      connection.close();
    }

    this.peerConnections.clear();
  }
}
