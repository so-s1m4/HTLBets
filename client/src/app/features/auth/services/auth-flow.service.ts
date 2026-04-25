import { Injectable, signal } from '@angular/core';

const pendingEmailKey = 'htl-bets.pending-email';

@Injectable({
  providedIn: 'root'
})
export class AuthFlowService {
  readonly pendingEmail = signal<string>(sessionStorage.getItem(pendingEmailKey) || '');

  setPendingEmail(email: string): void {
    sessionStorage.setItem(pendingEmailKey, email);
    this.pendingEmail.set(email);
  }

  clearPendingEmail(): void {
    sessionStorage.removeItem(pendingEmailKey);
    this.pendingEmail.set('');
  }
}
