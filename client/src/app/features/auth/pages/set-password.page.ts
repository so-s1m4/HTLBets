import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { AuthPanelComponent } from '../components/auth-panel.component';

@Component({
  selector: 'app-set-password-page',
  standalone: true,
  imports: [AuthPanelComponent, AppButtonComponent, AppInputComponent],
  templateUrl: './set-password.page.html',
  styleUrl: './set-password.page.scss'
})
export class SetPasswordPageComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    if (!this.auth.needsPasswordSetup()) {
      void this.router.navigate(['/lobby']);
    }
  }

  async submit(): Promise<void> {
    if (this.password().length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }

    if (this.password() !== this.confirmPassword()) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      await this.auth.setPassword(this.password());
      await this.router.navigate(['/lobby']);
    } catch {
      this.error.set('Unable to save your password right now.');
    } finally {
      this.loading.set(false);
    }
  }
}
