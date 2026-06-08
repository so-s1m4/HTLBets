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
  private readonly rouletteBalanceRevealDelayMs = 5200;
  private readonly blackjackInitialDealRevealDelayMs = 5260;
  private readonly blackjackOutcomeOnlyRevealDelayMs = 1200;
  private readonly blackjackPerCardRevealDelayMs = 1200;
  private readonly blackjackInitialCardRevealDelayMs = 260;
  private readonly blackjackFinalRevealBufferMs = 180;
  private readonly errorDismissDelayMs = 30_000;

  private socket: Socket | null = null;
  private delayedBalanceTimer: number | null = null;
  private errorDismissTimer: number | null = null;

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

  emitEvent(eventName: string, payload?: unknown): void {
    this.connect();
    this.socket?.emit(eventName, payload);
  }

  onEvent<T>(eventName: string, handler: (payload: T) => void): () => void {
    this.connect();
    const socket = this.socket;

    if (!socket) {
      return () => undefined;
    }

    socket.on(eventName, handler as (payload: T) => void);
    return () => {
      socket.off(eventName, handler as (payload: T) => void);
    };
  }

  reset(): void {
    this.clearDelayedBalanceTimer();
    this.clearErrorDismissTimer();
    this.currentState.set(null);
    this.lastError.set(null);
  }

  disconnect(): void {
    this.clearDelayedBalanceTimer();
    this.socket?.disconnect();
    this.socket = null;
    this.connectionState.set('disconnected');
    this.reset();
  }

  private connect(): void {
    const token = this.auth.token();

    if (!token) {
      this.showError('Sign in again to access realtime games.');
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
      this.clearError();
    });

    this.socket.on('disconnect', () => {
      this.connectionState.set('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      this.connectionState.set('disconnected');
      this.showError(error.message);
    });

    this.socket.on('game:state', (payload: RealtimeGameState) => {
      const previousState = this.currentState();
      this.currentState.set(payload);
      this.clearError();

      const previousPhase = this.readPhase(previousState);
      const nextPhase = this.readPhase(payload);
      const shouldDelayRouletteBalance =
        previousState?.gameType === 'ROULETTE' &&
        payload.gameType === 'ROULETTE' &&
        previousPhase === 'spinning' &&
        nextPhase === 'betting' &&
        Boolean(payload.outcome);

      if (shouldDelayRouletteBalance) {
        this.clearDelayedBalanceTimer();
        this.delayedBalanceTimer = window.setTimeout(() => {
          this.auth.updateBalance(payload.balance);
          this.delayedBalanceTimer = null;
        }, this.rouletteBalanceRevealDelayMs);
        return;
      }

      const blackjackBalanceRevealDelay = this.getBlackjackBalanceRevealDelay(previousState, payload);

      if (blackjackBalanceRevealDelay !== null) {
        this.clearDelayedBalanceTimer();
        this.delayedBalanceTimer = window.setTimeout(() => {
          this.auth.updateBalance(payload.balance);
          this.delayedBalanceTimer = null;
        }, blackjackBalanceRevealDelay);
        return;
      }

      this.clearDelayedBalanceTimer();
      this.auth.updateBalance(payload.balance);
    });

    this.socket.on('game:error', (payload: { message: string }) => {
      this.showError(payload.message);
    });
  }

  private showError(message: string): void {
    this.clearErrorDismissTimer();
    this.lastError.set(message);
    this.errorDismissTimer = window.setTimeout(() => {
      this.lastError.set(null);
      this.errorDismissTimer = null;
    }, this.errorDismissDelayMs);
  }

  private clearError(): void {
    this.clearErrorDismissTimer();
    this.lastError.set(null);
  }

  private clearErrorDismissTimer(): void {
    if (this.errorDismissTimer === null) {
      return;
    }

    window.clearTimeout(this.errorDismissTimer);
    this.errorDismissTimer = null;
  }

  private readPhase(state: RealtimeGameState | null): string | null {
    const phase = state?.state && typeof state.state === 'object' ? (state.state as Record<string, unknown>)['phase'] : null;
    return typeof phase === 'string' ? phase : null;
  }

  private clearDelayedBalanceTimer(): void {
    if (this.delayedBalanceTimer === null) {
      return;
    }

    window.clearTimeout(this.delayedBalanceTimer);
    this.delayedBalanceTimer = null;
  }

  private getBlackjackBalanceRevealDelay(previousState: RealtimeGameState | null, nextState: RealtimeGameState): number | null {
    if (
      !previousState ||
      previousState.gameType !== 'BLACKJACK' ||
      nextState.gameType !== 'BLACKJACK' ||
      previousState.sessionId !== nextState.sessionId ||
      !nextState.outcome
    ) {
      return null;
    }

    const previousView = this.readBlackjackState(previousState);
    const nextView = this.readBlackjackState(nextState);

    if (!previousView || !nextView) {
      return null;
    }

    const previousPlayerHands = this.readBlackjackHands(previousView);
    const previousDealerHand = this.readBlackjackHand(previousView['dealerHand']);
    const nextPlayerHands = this.readBlackjackHands(nextView);
    const nextDealerHand = this.readBlackjackHand(nextView['dealerHand']);

    const isInitialResolvedDeal =
      previousPlayerHands.length === 0 &&
      previousDealerHand.length === 0 &&
      nextPlayerHands.length === 1 &&
      nextPlayerHands[0].length === 2 &&
      nextDealerHand.length === 2 &&
      typeof nextView['phase'] === 'string' &&
      nextView['phase'] !== 'ready';

    if (isInitialResolvedDeal) {
      return this.blackjackInitialDealRevealDelayMs;
    }

    const changedCards =
      this.countBlackjackHandSetChanges(previousPlayerHands, nextPlayerHands) +
      this.countBlackjackCardChanges(previousDealerHand, nextDealerHand);

    if (changedCards > 0) {
      return (
        this.blackjackInitialCardRevealDelayMs +
        this.blackjackFinalRevealBufferMs +
        this.blackjackPerCardRevealDelayMs * changedCards
      );
    }

    return this.blackjackOutcomeOnlyRevealDelayMs;
  }

  private readBlackjackState(state: RealtimeGameState | null): Record<string, unknown> | null {
    if (state?.state && typeof state.state === 'object') {
      return state.state as Record<string, unknown>;
    }

    return null;
  }

  private readBlackjackHand(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object') : [];
  }

  private readBlackjackHands(state: Record<string, unknown>): Array<Array<Record<string, unknown>>> {
    const serializedHands = state['playerHands'];

    if (Array.isArray(serializedHands)) {
      return serializedHands
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
        .map((entry) => this.readBlackjackHand(entry['cards']))
        .filter((cards) => cards.length > 0);
    }

    const fallbackHand = this.readBlackjackHand(state['playerHand']);
    return fallbackHand.length ? [fallbackHand] : [];
  }

  private countBlackjackCardChanges(left: Array<Record<string, unknown>>, right: Array<Record<string, unknown>>): number {
    const maxLength = Math.max(left.length, right.length);
    let changes = 0;

    for (let index = 0; index < maxLength; index += 1) {
      if (this.blackjackCardSignature(left[index]) !== this.blackjackCardSignature(right[index])) {
        changes += 1;
      }
    }

    return changes;
  }

  private countBlackjackHandSetChanges(
    left: Array<Array<Record<string, unknown>>>,
    right: Array<Array<Record<string, unknown>>>
  ): number {
    const maxLength = Math.max(left.length, right.length);
    let changes = 0;

    for (let index = 0; index < maxLength; index += 1) {
      changes += this.countBlackjackCardChanges(left[index] || [], right[index] || []);
    }

    return changes;
  }

  private blackjackCardSignature(card: Record<string, unknown> | undefined): string {
    if (!card) {
      return 'missing';
    }

    const rank = typeof card['rank'] === 'string' ? card['rank'] : '?';
    const suit = typeof card['suit'] === 'string' ? card['suit'] : '?';
    const hidden = card['hidden'] === true ? 'hidden' : 'visible';
    return `${rank}:${suit}:${hidden}`;
  }
}
