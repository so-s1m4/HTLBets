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
  templateUrl: './verify-code.page.html',
  styleUrl: './verify-code.page.scss'
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
