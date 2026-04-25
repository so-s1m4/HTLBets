import { Component, Input } from '@angular/core';

import { AppCardComponent } from '../../../shared/ui/app-card.component';

@Component({
  selector: 'app-auth-panel',
  standalone: true,
  imports: [AppCardComponent],
  template: `
    <section class="auth-panel">
      <app-card tone="accent">
        <div class="auth-panel__content">
          <div class="auth-panel__signal" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div class="page-heading">
            <span class="page-heading__eyebrow">{{ eyebrow }}</span>
            <h1>{{ title }}</h1>
            <p class="status-copy">{{ subtitle }}</p>
          </div>

          <ng-content />
        </div>
      </app-card>
    </section>
  `,
  styles: [`
    .auth-panel {
      width: min(100%, 460px);
      margin: 0 auto;
    }

    .auth-panel__content {
      position: relative;
      display: grid;
      gap: 1.25rem;
      min-height: 24rem;
    }

    .auth-panel__signal {
      position: absolute;
      top: 0;
      right: 0;
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .auth-panel__signal span {
      display: block;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0));
      border: 1px solid rgba(149, 171, 211, 0.12);
    }

    .auth-panel__signal span:nth-child(1) {
      width: 0.45rem;
      height: 1.8rem;
      background-color: rgba(93, 168, 255, 0.28);
    }

    .auth-panel__signal span:nth-child(2) {
      width: 0.45rem;
      height: 2.6rem;
      background-color: rgba(125, 227, 255, 0.2);
    }

    .auth-panel__signal span:nth-child(3) {
      width: 0.45rem;
      height: 1.1rem;
      background-color: rgba(136, 123, 255, 0.2);
    }
  `]
})
export class AuthPanelComponent {
  @Input() eyebrow = 'HTL Mini Games';
  @Input() title = '';
  @Input() subtitle = '';
}
