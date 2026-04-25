import { Component } from '@angular/core';

import { AppCardComponent } from '../../../shared/ui/app-card.component';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [AppCardComponent],
  template: `
    <app-card tone="muted">
      <div class="coming-soon">
        <div class="page-heading">
          <span class="page-heading__eyebrow">Roadmap</span>
          <h2>Next tables in queue</h2>
          <p class="status-copy">The game engine contract is already shaped for more realtime demo games.</p>
        </div>

        <div class="coming-soon__list">
          <span class="pill">Slots</span>
          <span class="pill">Baccarat</span>
          <span class="pill">Crash</span>
        </div>

        <div class="glass-divider"></div>

        <p class="status-copy">
          Tournaments, richer multiplayer rooms, and modal flows can plug into the same component system without reshaping the platform.
        </p>
      </div>
    </app-card>
  `,
  styles: [`
    .coming-soon {
      display: grid;
      gap: 1rem;
    }

    .coming-soon__list {
      display: flex;
      gap: 0.7rem;
      flex-wrap: wrap;
    }
  `]
})
export class ComingSoonComponent {}
