import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="bottom-nav">
      @for (item of items; track item.route) {
        <a
          [routerLink]="item.route"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: item.route === '/lobby' || item.route === '/profile' }"
          class="bottom-nav__item"
        >
          <span class="bottom-nav__icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
  styles: [`
    .bottom-nav {
      position: fixed;
      z-index: 12;
      left: 50%;
      bottom: 1rem;
      transform: translateX(-50%);
      width: min(100%, var(--content-width));
      padding: 0 1rem;
    }

    .bottom-nav::before {
      content: '';
      position: absolute;
      inset: -0.2rem 1rem;
      border-radius: 28px;
      border: 1px solid rgba(149, 171, 211, 0.14);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(13, 19, 29, 0.98), rgba(9, 14, 22, 0.98));
      box-shadow: var(--shadow-panel);
      pointer-events: none;
    }

    .bottom-nav {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.55rem;
    }

    .bottom-nav__item {
      position: relative;
      display: grid;
      place-items: center;
      gap: 0.16rem;
      min-height: 4.35rem;
      border-radius: 24px;
      color: var(--text-soft);
      transition:
        border-color 160ms ease,
        transform 160ms ease,
        color 160ms ease,
        background 160ms ease;
      z-index: 1;
    }

    .bottom-nav__item.active {
      color: var(--text);
      transform: translateY(-2px);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(28, 40, 61, 0.98), rgba(17, 25, 38, 0.98));
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 10px 24px rgba(5, 9, 20, 0.2);
    }

    .bottom-nav__icon {
      font-family: 'SF Mono', 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1rem;
      color: inherit;
    }
  `]
})
export class BottomNavigationComponent {
  readonly items = [
    { label: 'Lobby', route: '/lobby', icon: '⌂' },
    { label: 'Roulette', route: '/games/roulette', icon: '◎' },
    { label: 'Profile', route: '/profile', icon: '◌' }
  ];
}
