import { Component, Input } from '@angular/core';

import { AppCardComponent } from '../../../shared/ui/app-card.component';

@Component({
  selector: 'app-game-shell',
  standalone: true,
  imports: [AppCardComponent],
  template: `
    <div class="game-shell">
      <app-card tone="accent">
        <div class="game-shell__header">
          <div class="page-heading">
            <span class="page-heading__eyebrow">{{ connectionState }}</span>
            <h1>{{ title }}</h1>
            <p class="status-copy">{{ subtitle }}</p>
          </div>

          <div class="game-shell__meta">
            <span class="game-shell__dot" [class.connected]="connectionState === 'connected'"></span>
            <span class="pill">Realtime {{ connectionState }}</span>
            <span class="pill">Current bet: {{ currentBet }} cr</span>
          </div>
        </div>
      </app-card>

      @if (error) {
        <app-card tone="muted">
          <p class="status-copy text-danger">{{ error }}</p>
        </app-card>
      }

      <div class="game-shell__grid">
        <ng-content select="[table]" />
        <ng-content select="[sidebar]" />
      </div>
    </div>
  `,
  styles: [`
    .game-shell {
      display: grid;
      gap: 1rem;
    }

    .game-shell__header {
      display: grid;
      gap: 1rem;
    }

    .game-shell__meta {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .game-shell__dot {
      width: 0.62rem;
      height: 0.62rem;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.16);
      box-shadow: 0 0 12px rgba(255, 255, 255, 0.06);
    }

    .game-shell__dot.connected {
      background: linear-gradient(180deg, var(--accent-cyan), var(--accent));
      box-shadow: 0 0 18px rgba(93, 168, 255, 0.28);
    }

    .game-shell__grid {
      display: grid;
      gap: 1rem;
    }

    @media (min-width: 960px) {
      .game-shell__grid {
        grid-template-columns: minmax(0, 1.85fr) minmax(300px, 0.92fr);
      }
    }
  `]
})
export class GameShellComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() connectionState = 'disconnected';
  @Input() currentBet = 0;
  @Input() error = '';
}
