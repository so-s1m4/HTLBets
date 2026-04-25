import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import {
  htlstpEmailErrorMessage,
  isAllowedHtlstpEmail,
  normalizeLoginEmail
} from '../../../core/utils/email-rules';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { AuthPanelComponent } from '../components/auth-panel.component';
import { AuthFlowService } from '../services/auth-flow.service';

@Component({
  selector: 'app-email-entry-page',
  standalone: true,
  imports: [AuthPanelComponent, AppButtonComponent, AppInputComponent],
  template: `
    <section class="auth-page">
      <app-auth-panel
        title="Sign in with email"
        subtitle="A one-time code is generated server-side, stored with expiry, and delivered through the configured Mailcow SMTP server."
      >
        <div class="page-stack">
          <div class="glass-stat-grid">
            <div class="glass-stat">
              <span class="glass-stat__label">Access</span>
              <strong class="glass-stat__value">Email only</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Security</span>
              <strong class="glass-stat__value">JWT + code</strong>
            </div>
          </div>

          <app-input
            label="Email address"
            placeholder="student@htlstp.at"
            helper="Only @htlstp.at addresses are allowed. +tags are rejected."
            [value]="email()"
            (valueChange)="email.set($event)"
          />

          @if (error()) {
            <p class="status-copy text-danger">{{ error() }}</p>
          }

          <app-button block [disabled]="loading()" (click)="submit()">
            {{ loading() ? 'Sending code...' : 'Request verification code' }}
          </app-button>

          <p class="status-copy">
            Demo-only login. No payments, no real betting, and no existing-account disclosure.
          </p>
        </div>
      </app-auth-panel>
    </section>
  `,
  styles: [`
    .auth-page {
      position: relative;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 1rem;
      isolation: isolate;
    }

    .auth-page::before,
    .auth-page::after {
      content: '';
      position: absolute;
      z-index: -1;
      pointer-events: none;
    }

    .auth-page::before {
      width: 18rem;
      height: 12rem;
      top: 5rem;
      left: -6rem;
      border-radius: 40px;
      background:
        linear-gradient(135deg, rgba(93, 168, 255, 0.12), transparent 72%),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02), transparent);
      transform: rotate(-14deg);
    }

    .auth-page::after {
      width: 16rem;
      height: 10rem;
      right: -4rem;
      bottom: 7rem;
      border-radius: 36px;
      background:
        linear-gradient(135deg, rgba(136, 123, 255, 0.12), transparent 72%),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02), transparent);
      transform: rotate(16deg);
    }
  `]
})
export class EmailEntryPageComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly flow = inject(AuthFlowService);

  readonly email = signal('');
  readonly loading = signal(false);
  readonly error = signal('');

  async submit(): Promise<void> {
    const email = normalizeLoginEmail(this.email());

    if (!isAllowedHtlstpEmail(email)) {
      this.error.set(htlstpEmailErrorMessage);
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      await this.auth.requestCode(email);
      this.flow.setPendingEmail(email);
      await this.router.navigate(['/auth/verify']);
    } catch {
      this.error.set('Unable to send a verification code right now.');
    } finally {
      this.loading.set(false);
    }
  }
}
