import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppCardComponent } from './app-card.component';
import { AppButtonComponent } from './app-button.component';

@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [RouterLink, AppCardComponent, AppButtonComponent],
  template: `
    <app-card tone="accent">
      <div class="game-card" [attr.data-theme]="theme">
        <div class="game-card__meta">
          <div class="utility-row">
            <span class="pill">{{ badge }}</span>
            <span class="game-card__availability">{{ availability }}</span>
          </div>
          <h3>{{ title }}</h3>
          <p>{{ description }}</p>
        </div>

        <div class="game-card__visual" aria-hidden="true">
          <span class="game-card__visual-ring"></span>
          <span class="game-card__visual-ring"></span>
          <span class="game-card__visual-core"></span>
        </div>

        <div class="game-card__footer">
          <span class="game-card__hint">Enter table</span>
          <a [routerLink]="route">
            <app-button variant="primary">Open</app-button>
          </a>
        </div>
      </div>
    </app-card>
  `,
  styles: [`
    .game-card {
      position: relative;
      display: grid;
      gap: 1.1rem;
      min-height: 12rem;
      grid-template-columns: minmax(0, 1fr);
    }

    .game-card__meta {
      display: grid;
      gap: 0.55rem;
      position: relative;
      z-index: 1;
    }

    .game-card__meta h3,
    .game-card__meta p {
      margin: 0;
    }

    .game-card__meta p {
      color: var(--text-muted);
      line-height: 1.5;
    }

    .game-card__visual {
      position: relative;
      min-height: 8.5rem;
      border-radius: calc(var(--radius-lg) - 4px);
      border: 1px solid rgba(149, 171, 211, 0.12);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(10, 16, 27, 0.96), rgba(8, 12, 20, 0.98));
      overflow: hidden;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .game-card__visual::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent 34%),
        radial-gradient(circle at top left, rgba(93, 168, 255, 0.14), transparent 34%);
    }

    .game-card__visual-ring,
    .game-card__visual-core {
      position: absolute;
      inset: 50% auto auto 50%;
      border-radius: 50%;
      transform: translate(-50%, -50%);
    }

    .game-card__visual-ring:nth-child(1) {
      width: 7.5rem;
      height: 7.5rem;
      border: 1px solid rgba(255, 255, 255, 0.06);
      box-shadow: 0 0 0 1px rgba(149, 171, 211, 0.04);
    }

    .game-card__visual-ring:nth-child(2) {
      width: 5rem;
      height: 5rem;
      border: 1px solid rgba(93, 168, 255, 0.24);
      box-shadow: 0 0 24px rgba(93, 168, 255, 0.08);
    }

    .game-card__visual-core {
      width: 1.1rem;
      height: 1.1rem;
      background: linear-gradient(180deg, var(--accent-cyan), var(--accent));
      box-shadow: 0 0 20px rgba(93, 168, 255, 0.24);
    }

    .game-card[data-theme="blackjack"] .game-card__visual::before {
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent 34%),
        radial-gradient(circle at top left, rgba(125, 227, 255, 0.14), transparent 34%);
    }

    .game-card[data-theme="blackjack"] .game-card__visual-ring:nth-child(2) {
      border-color: rgba(125, 227, 255, 0.28);
      box-shadow: 0 0 24px rgba(125, 227, 255, 0.08);
    }

    .game-card[data-theme="poker"] .game-card__visual::before {
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent 34%),
        radial-gradient(circle at top left, rgba(136, 123, 255, 0.14), transparent 34%);
    }

    .game-card[data-theme="poker"] .game-card__visual-ring:nth-child(2) {
      border-color: rgba(136, 123, 255, 0.3);
      box-shadow: 0 0 24px rgba(136, 123, 255, 0.08);
    }

    .game-card__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
      position: relative;
      z-index: 1;
    }

    .game-card__availability {
      color: var(--text-soft);
      font-size: 0.76rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-family: 'SF Mono', 'IBM Plex Mono', ui-monospace, monospace;
    }

    .game-card__hint {
      color: var(--text-soft);
      font-size: 0.88rem;
    }

    @media (hover: hover) {
      .game-card__visual {
        transition: transform 260ms ease, border-color 260ms ease;
      }

      :host:hover .game-card__visual {
        transform: translateY(-2px);
        border-color: rgba(149, 171, 211, 0.18);
      }
    }

    @media (min-width: 720px) {
      .game-card {
        grid-template-columns: minmax(0, 1fr) 8.75rem;
        align-items: center;
      }

      .game-card__footer {
        grid-column: 1 / -1;
      }
    }
  `]
})
export class AppGameCardComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() route = '/lobby';
  @Input() badge = 'Demo';
  @Input() availability = 'Available now';
  @Input() theme: 'roulette' | 'blackjack' | 'poker' = 'roulette';
}
