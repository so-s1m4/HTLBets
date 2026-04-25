import { inject, Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';

import type { GameSlug, RealtimeGameState } from '../models/game.model';
import { gameSlugToType } from '../models/game.model';
import { AppConfigService } from './app-config.service';
import { AuthService } from './auth.service';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

@Injectable({
  providedIn: 'root'
})
export class GameSocketService {
  private readonly auth = inject(AuthService);
  private readonly config = inject(AppConfigService);

  private socket: Socket | null = null;

  readonly connectionState = signal<ConnectionState>('disconnected');
  readonly currentState = signal<RealtimeGameState | null>(null);
  readonly lastError = signal<string | null>(null);

  joinGame(game: GameSlug, sessionId?: string): void {
    this.connect();
    this.socket?.emit('game:join', {
      gameType: gameSlugToType[game],
      sessionId
    });
  }

  leaveGame(game: GameSlug, sessionId?: string): void {
    if (!sessionId) {
      return;
    }

    this.socket?.emit('game:leave', {
      gameType: gameSlugToType[game],
      sessionId
    });
  }

  placeBet(game: GameSlug, amount: number, payload?: Record<string, unknown>): void {
    this.connect();
    this.socket?.emit('game:bet', {
      gameType: gameSlugToType[game],
      sessionId: this.currentState()?.sessionId,
      amount,
      payload
    });
  }

  sendAction(game: GameSlug, action: string, payload?: Record<string, unknown>): void {
    const state = this.currentState();

    if (!state?.sessionId) {
      return;
    }

    this.connect();
    this.socket?.emit('game:action', {
      gameType: gameSlugToType[game],
      sessionId: state.sessionId,
      action,
      payload
    });
  }

  reset(): void {
    this.currentState.set(null);
    this.lastError.set(null);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connectionState.set('disconnected');
    this.reset();
  }

  private connect(): void {
    const token = this.auth.token();

    if (!token) {
      this.lastError.set('Sign in again to access realtime games.');
      return;
    }

    if (this.socket) {
      if (!this.socket.connected) {
        this.connectionState.set('connecting');
        this.socket.auth = { token };
        this.socket.connect();
      }

      return;
    }

    this.connectionState.set('connecting');

    this.socket = io(this.config.socketUrl, {
      auth: {
        token
      }
    });

    this.socket.on('connect', () => {
      this.connectionState.set('connected');
      this.lastError.set(null);
    });

    this.socket.on('disconnect', () => {
      this.connectionState.set('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      this.connectionState.set('disconnected');
      this.lastError.set(error.message);
    });

    this.socket.on('game:state', (payload: RealtimeGameState) => {
      this.currentState.set(payload);
      this.lastError.set(null);
      this.auth.updateBalance(payload.balance);
    });

    this.socket.on('game:error', (payload: { message: string }) => {
      this.lastError.set(payload.message);
    });
  }
}
