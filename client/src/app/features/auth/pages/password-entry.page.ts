import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { AuthPanelComponent } from '../components/auth-panel.component';
import { AuthFlowService } from '../services/auth-flow.service';

@Component({
  selector: 'app-password-entry-page',
  standalone: true,
  imports: [AuthPanelComponent, AppButtonComponent, AppInputComponent],
  templateUrl: './password-entry.page.html',
  styleUrl: './password-entry.page.scss'
})
export class PasswordEntryPageComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly flow = inject(AuthFlowService);

  readonly password = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly email = this.flow.pendingEmail();

  constructor() {
    if (!this.email) {
      void this.router.navigate(['/auth/email']);
    }
  }

  async submit(): Promise<void> {
    if (this.password().length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      await this.auth.loginWithPassword(this.email, this.password());
      this.flow.clearPendingEmail();
      await this.router.navigate(['/lobby']);
    } catch {
      this.error.set('Incorrect password.');
    } finally {
      this.loading.set(false);
    }
  }
}
