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
  templateUrl: './email-entry.page.html',
  styleUrl: './email-entry.page.scss'
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
      this.flow.setPendingEmail(email);
      const result = await this.auth.beginAuth(email);

      if (result.mode === 'password') {
        await this.router.navigate(['/auth/password']);
        return;
      }

      await this.auth.requestCode(email);
      await this.router.navigate(['/auth/verify']);
    } catch {
      this.error.set('Unable to start sign in right now.');
    } finally {
      this.loading.set(false);
    }
  }
}
