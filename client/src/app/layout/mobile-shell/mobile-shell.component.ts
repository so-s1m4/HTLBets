import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BottomNavigationComponent } from '../bottom-navigation/bottom-navigation.component';
import { TopBarComponent } from '../top-bar/top-bar.component';

@Component({
  selector: 'app-mobile-shell',
  standalone: true,
  imports: [RouterOutlet, TopBarComponent, BottomNavigationComponent],
  template: `
    <div class="mobile-shell">
      <div class="mobile-shell__ambient mobile-shell__ambient--left"></div>
      <div class="mobile-shell__ambient mobile-shell__ambient--right"></div>
      <app-top-bar />
      <main class="mobile-shell__content">
        <router-outlet />
      </main>
      <app-bottom-nav />
    </div>
  `,
  styles: [`
    .mobile-shell {
      position: relative;
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      isolation: isolate;
    }

    .mobile-shell__ambient {
      position: fixed;
      z-index: -1;
      border-radius: 40px;
      opacity: 0.65;
      pointer-events: none;
    }

    .mobile-shell__ambient--left {
      top: 8rem;
      left: -8rem;
      width: 20rem;
      height: 12rem;
      background:
        linear-gradient(135deg, rgba(93, 168, 255, 0.12), transparent 68%),
        linear-gradient(90deg, rgba(255, 255, 255, 0.03), transparent);
      transform: rotate(-14deg);
    }

    .mobile-shell__ambient--right {
      right: -9rem;
      bottom: 7rem;
      width: 18rem;
      height: 14rem;
      background:
        linear-gradient(135deg, rgba(136, 123, 255, 0.12), transparent 64%),
        linear-gradient(90deg, rgba(255, 255, 255, 0.03), transparent);
      transform: rotate(18deg);
    }

    .mobile-shell__content {
      width: min(100%, var(--content-width));
      margin: 0 auto;
      padding: 1rem var(--page-padding) calc(7.4rem + env(safe-area-inset-bottom, 0px));
    }

    @media (min-width: 768px) {
      .mobile-shell__content {
        padding-top: 1.2rem;
      }
    }

    @media (max-width: 480px) {
      .mobile-shell__ambient--left {
        left: -10rem;
        width: 17rem;
        height: 10rem;
      }

      .mobile-shell__ambient--right {
        right: -10rem;
        width: 15rem;
        height: 11rem;
      }
    }
  `]
})
export class MobileShellComponent {}
