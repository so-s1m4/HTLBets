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

        <div class="top-bar__meta">
          <span class="top-bar__user">{{ auth.currentUser()?.email || 'guest' }}</span>
          <app-balance-badge [balance]="auth.currentUser()?.balance || 0" />
        </div>
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
      padding: 1rem var(--page-padding) 0.45rem;
    }

    .top-bar__inner {
      position: relative;
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
      overflow: hidden;
    }

    .top-bar__inner::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(90deg, rgba(93, 168, 255, 0.08), transparent 22%, transparent 72%, rgba(136, 123, 255, 0.06));
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

    .top-bar__meta {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: flex-end;
      min-width: 0;
    }

    .top-bar__user {
      max-width: 16rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0.56rem 0.8rem;
      border-radius: 999px;
      border: 1px solid rgba(149, 171, 211, 0.12);
      background: rgba(255, 255, 255, 0.03);
      color: var(--text-soft);
      font-size: 0.78rem;
      font-family: 'SF Mono', 'IBM Plex Mono', ui-monospace, monospace;
      letter-spacing: 0.08em;
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

    @media (max-width: 840px) {
      .top-bar__inner {
        flex-direction: column;
        align-items: stretch;
      }

      .top-bar__meta {
        width: 100%;
        justify-content: space-between;
      }
    }

    @media (max-width: 640px) {
      .top-bar {
        padding-top: 0.8rem;
      }

      .top-bar__inner {
        padding: 0.88rem 0.88rem 0.82rem;
      }

      .top-bar__copy p {
        display: none;
      }

      .top-bar__user {
        max-width: 100%;
        flex: 1 1 100%;
        order: 2;
      }
    }

    @media (max-width: 440px) {
      .top-bar__brand {
        gap: 0.7rem;
      }

      .top-bar__mark {
        width: 2.45rem;
        height: 2.45rem;
        border-radius: 16px;
      }

      .top-bar__copy strong {
        font-size: 0.98rem;
      }

      .top-bar__eyebrow {
        letter-spacing: 0.14em;
      }
    }
  `]
})
export class TopBarComponent {
  readonly auth = inject(AuthService);
}
