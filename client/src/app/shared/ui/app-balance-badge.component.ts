import { Component, Input } from '@angular/core';

import { CreditsPipe } from '../pipes/credits.pipe';

@Component({
  selector: 'app-balance-badge',
  standalone: true,
  imports: [CreditsPipe],
  template: `
    <div class="balance-badge">
      <span class="balance-badge__pulse"></span>
      <div class="balance-badge__copy">
        <span class="balance-badge__label">Balance</span>
        <strong class="balance-badge__value">{{ balance | credits }}</strong>
      </div>
    </div>
  `,
  styles: [`
    .balance-badge {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.72rem;
      padding: 0.7rem 0.95rem;
      border-radius: var(--radius-pill);
      border: 1px solid rgba(149, 171, 211, 0.14);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(19, 28, 42, 0.98), rgba(11, 17, 27, 0.98));
      color: var(--text);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 14px 28px rgba(4, 8, 20, 0.22);
    }

    .balance-badge__pulse {
      width: 0.62rem;
      height: 2rem;
      border-radius: 999px;
      background: linear-gradient(180deg, var(--accent-cyan), var(--accent));
      box-shadow: 0 0 16px rgba(93, 168, 255, 0.34);
    }

    .balance-badge__copy {
      display: grid;
      gap: 0.1rem;
    }

    .balance-badge__label {
      color: var(--text-soft);
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-family: 'SF Mono', 'IBM Plex Mono', ui-monospace, monospace;
    }

    .balance-badge__value {
      display: block;
      font-size: 1rem;
      letter-spacing: -0.03em;
    }
  `]
})
export class AppBalanceBadgeComponent {
  @Input() balance = 0;
}
