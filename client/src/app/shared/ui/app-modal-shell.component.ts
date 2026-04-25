import { Component } from '@angular/core';

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  template: `
    <div class="modal-shell">
      <div class="modal-shell__backdrop"></div>
      <div class="modal-shell__panel">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    .modal-shell {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 1rem;
      z-index: 30;
    }

    .modal-shell__backdrop {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg, rgba(6, 8, 13, 0.76), rgba(6, 8, 13, 0.84)),
        radial-gradient(circle at top, rgba(93, 168, 255, 0.08), transparent 26%);
    }

    .modal-shell__panel {
      position: relative;
      width: min(100%, 420px);
      padding: 1.2rem;
      border-radius: var(--radius-xl);
      border: 1px solid rgba(149, 171, 211, 0.14);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(16, 24, 38, 0.98), rgba(11, 17, 27, 0.98));
      box-shadow: var(--shadow-panel-strong);
    }
  `]
})
export class AppModalShellComponent {}
