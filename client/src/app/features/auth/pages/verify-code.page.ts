import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { AuthPanelComponent } from '../components/auth-panel.component';
import { AuthFlowService } from '../services/auth-flow.service';

@Component({
  selector: 'app-verify-code-page',
  standalone: true,
  imports: [AuthPanelComponent, AppButtonComponent, AppInputComponent],
  template: `
    <section class="auth-page">
      <app-auth-panel
        title="Enter your code"
        subtitle="The verification code expires after 10 minutes. If it times out, request a new one from the previous screen."
      >
        <div class="page-stack">
          <p class="status-copy">
            Verification target: <strong>{{ email }}</strong>
          </p>

          <div class="glass-stat-grid">
            <div class="glass-stat">
              <span class="glass-stat__label">Expiry</span>
              <strong class="glass-stat__value">10 minutes</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Format</span>
              <strong class="glass-stat__value">6 digits</strong>
            </div>
          </div>

          <app-input
            label="6-digit code"
            placeholder="123456"
            inputMode="numeric"
            [maxlength]="6"
            [value]="code()"
            (valueChange)="code.set($event.replace(/\\D/g, '').slice(0, 6))"
          />

          @if (error()) {
            <p class="status-copy text-danger">{{ error() }}</p>
          }

          <div class="page-stack">
            <app-button block [disabled]="loading()" (click)="submit()">
              {{ loading() ? 'Verifying...' : 'Verify and enter lobby' }}
            </app-button>

            <app-button variant="secondary" block [disabled]="resending()" (click)="resend()">
              {{ resending() ? 'Sending again...' : 'Resend code' }}
            </app-button>
          </div>
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
      right: -5rem;
      border-radius: 40px;
      background:
        linear-gradient(135deg, rgba(125, 227, 255, 0.12), transparent 70%),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02), transparent);
      transform: rotate(14deg);
    }

    .auth-page::after {
      width: 16rem;
      height: 10rem;
      left: -5rem;
      bottom: 7rem;
      border-radius: 36px;
      background:
        linear-gradient(135deg, rgba(136, 123, 255, 0.12), transparent 70%),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02), transparent);
      transform: rotate(-16deg);
    }
  `]
})
export class VerifyCodePageComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly flow = inject(AuthFlowService);

  readonly code = signal('');
  readonly loading = signal(false);
  readonly resending = signal(false);
  readonly error = signal('');
  readonly email = this.flow.pendingEmail();

  constructor() {
    if (!this.email) {
      void this.router.navigate(['/auth/email']);
    }
  }

  async submit(): Promise<void> {
    if (this.code().length !== 6) {
      this.error.set('Enter the full 6-digit verification code.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      await this.auth.verifyCode(this.email, this.code());
      this.flow.clearPendingEmail();
      await this.router.navigate(['/lobby']);
    } catch {
      this.error.set('Invalid or expired verification code.');
    } finally {
      this.loading.set(false);
    }
  }

  async resend(): Promise<void> {
    this.resending.set(true);
    this.error.set('');

    try {
      await this.auth.requestCode(this.email);
    } catch {
      this.error.set('Unable to resend the code right now.');
    } finally {
      this.resending.set(false);
    }
  }
}
