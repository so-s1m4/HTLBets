import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { AppBalanceBadgeComponent } from '../../shared/ui/app-balance-badge.component';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, AppBalanceBadgeComponent],
  template: `
    <header class="top-bar">
      <div class="top-bar__inner">
        <div class="top-bar__brand">
          <span class="top-bar__mark">HB</span>
          <div class="top-bar__copy">
            <span class="top-bar__eyebrow">HTL Demo Floor</span>
            <strong>Dashboard</strong>
            <p>Structured play-money tables</p>
          </div>
        </div>

        <app-balance-badge [balance]="auth.currentUser()?.balance || 0" />
      </div>
    </header>
  `,
  styles: [`
    .top-bar {
      position: sticky;
      top: 0;
      z-index: 10;
      width: min(100%, var(--content-width));
      margin: 0 auto;
      padding: 1rem 1rem 0.4rem;
    }

    .top-bar__inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.88rem 1rem;
      border-radius: 28px;
      border: 1px solid rgba(149, 171, 211, 0.14);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(15, 22, 34, 0.96), rgba(9, 14, 22, 0.98));
      box-shadow: var(--shadow-panel);
    }

    .top-bar__brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      min-width: 0;
    }

    .top-bar__mark {
      width: 2.8rem;
      height: 2.8rem;
      display: grid;
      place-items: center;
      border-radius: 20px;
      border: 1px solid rgba(149, 171, 211, 0.16);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0)),
        linear-gradient(135deg, rgba(93, 168, 255, 0.3), rgba(15, 23, 36, 0.96) 76%);
      font-family: 'SF Mono', 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 0.82rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--text);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.08),
        0 10px 20px rgba(4, 8, 20, 0.18);
    }

    .top-bar__copy {
      display: grid;
      gap: 0.14rem;
      min-width: 0;
    }

    .top-bar__copy strong,
    .top-bar__copy p {
      display: block;
      margin: 0;
    }

    .top-bar__copy strong {
      letter-spacing: -0.03em;
    }

    .top-bar__copy p {
      color: var(--text-soft);
      font-size: 0.88rem;
    }

    .top-bar__eyebrow {
      color: var(--accent-cyan);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.68rem;
      font-family: 'SF Mono', 'IBM Plex Mono', ui-monospace, monospace;
    }
  `]
})
export class TopBarComponent {
  readonly auth = inject(AuthService);
}
