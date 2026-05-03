import { Component, computed, inject } from '@angular/core';

import { AuthService } from '../../../core/services/auth.service';
import { AppGameCardComponent } from '../../../shared/ui/app-game-card.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppBalanceBadgeComponent } from '../../../shared/ui/app-balance-badge.component';
import { ComingSoonComponent } from '../components/coming-soon.component';

@Component({
  selector: 'app-lobby-page',
  standalone: true,
  imports: [AppGameCardComponent, AppCardComponent, AppBalanceBadgeComponent, ComingSoonComponent],
  template: `
    <div class="page-stack">
      <app-card tone="accent">
        <div class="lobby-hero">
          <div class="lobby-hero__grid" aria-hidden="true"></div>
          <div class="lobby-hero__orbs">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div class="page-heading">
            <span class="page-heading__eyebrow">Premium Demo Floor</span>
            <h1>Mini-game floor built like a real product</h1>
            <p class="status-copy">
              Mobile-first demo tables with strong hierarchy, solid depth, and server-authoritative rounds for roulette, blackjack, and poker.
            </p>
          </div>

          <div class="lobby-hero__ticker">
            <span>Realtime tables</span>
            <span>•</span>
            <span>HTL-only access</span>
            <span>•</span>
            <span>Play money only</span>
          </div>

          <div class="lobby-hero__footer">
            <app-balance-badge [balance]="balance()" />
            <span class="pill">{{ email() }}</span>
          </div>

          <div class="glass-stat-grid">
            <div class="glass-stat">
              <span class="glass-stat__label">Live games</span>
              <strong class="glass-stat__value">03 active</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Mode</span>
              <strong class="glass-stat__value">Demo credits</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Engine</span>
              <strong class="glass-stat__value">Realtime</strong>
            </div>
            <div class="glass-stat">
              <span class="glass-stat__label">Access</span>
              <strong class="glass-stat__value">HTL email</strong>
            </div>
          </div>
        </div>
      </app-card>

      <div class="page-heading section-shell">
        <span class="page-heading__eyebrow">Game Lounge</span>
        <h2>Open a table</h2>
      </div>

      @for (game of games; track game.route) {
        <app-game-card
          [title]="game.title"
          [description]="game.description"
          [route]="game.route"
          [badge]="game.badge"
          [availability]="game.availability"
          [theme]="game.theme"
        />
      }

      <app-coming-soon />
    </div>
  `,
  styles: [`
    .lobby-hero {
      position: relative;
      display: grid;
      gap: 1.1rem;
      isolation: isolate;
      overflow: hidden;
    }

    .lobby-hero__grid {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(rgba(255, 255, 255, 0.028) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px);
      background-size: 32px 32px;
      mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.55), transparent 78%);
      opacity: 0.32;
      pointer-events: none;
    }

    .lobby-hero__footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .lobby-hero__ticker {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      align-items: center;
      color: var(--text-soft);
      font-size: 0.84rem;
      letter-spacing: 0.04em;
    }

    .lobby-hero__orbs {
      position: absolute;
      inset: 0 0 auto auto;
      width: 8rem;
      height: 3rem;
      z-index: -1;
      pointer-events: none;
      display: flex;
      justify-content: flex-end;
      gap: 0.42rem;
    }

    .lobby-hero__orbs span {
      display: block;
      width: 0.4rem;
      border-radius: 999px;
      border: 1px solid rgba(149, 171, 211, 0.12);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0));
      animation: lobby-orb-float 4.5s ease-in-out infinite alternate;
    }

    .lobby-hero__orbs span:nth-child(1) {
      height: 1.1rem;
      background-color: rgba(93, 168, 255, 0.24);
    }

    .lobby-hero__orbs span:nth-child(2) {
      height: 2rem;
      background-color: rgba(125, 227, 255, 0.2);
    }

    .lobby-hero__orbs span:nth-child(3) {
      height: 2.7rem;
      background-color: rgba(136, 123, 255, 0.18);
      animation-delay: 0.5s;
    }

    .lobby-hero__orbs span:nth-child(2) {
      animation-delay: 0.25s;
    }

    @keyframes lobby-orb-float {
      0% {
        transform: translateY(0);
      }
      100% {
        transform: translateY(-4px);
      }
    }

    @media (min-width: 900px) {
      .lobby-hero {
        grid-template-columns: minmax(0, 1.25fr) minmax(18rem, 0.85fr);
        align-items: end;
      }

      .lobby-hero .page-heading,
      .lobby-hero__ticker,
      .lobby-hero__footer {
        grid-column: 1;
      }

      .glass-stat-grid {
        grid-column: 2;
        grid-row: 1 / span 3;
        align-self: stretch;
      }
    }

    @media (max-width: 640px) {
      .lobby-hero {
        gap: 0.95rem;
      }

      .lobby-hero__ticker {
        gap: 0.4rem;
        font-size: 0.78rem;
      }

      .lobby-hero__footer {
        align-items: stretch;
      }

      .lobby-hero__footer .pill {
        width: 100%;
        justify-content: center;
      }

      .lobby-hero__orbs {
        width: 5.4rem;
        height: 2.25rem;
      }
    }
  `]
})
export class LobbyPageComponent {
  private readonly auth = inject(AuthService);

  readonly balance = computed(() => this.auth.currentUser()?.balance || 0);
  readonly email = computed(() => this.auth.currentUser()?.email || 'guest');

  readonly games = [
    {
      title: 'Roulette',
      description: 'Choose a color or a specific number. Spins are generated only on the server.',
      route: '/games/roulette',
      badge: 'Live',
      availability: 'Instant rounds',
      theme: 'roulette' as const
    },
    {
      title: 'Blackjack',
      description: 'Classic hit, stand, and double actions with dealer logic handled server-side.',
      route: '/games/blackjack',
      badge: 'Live',
      availability: 'Table ready',
      theme: 'blackjack' as const
    },
    {
      title: 'Poker',
      description: 'Placeholder table flow with expandable state management for future multiplayer rules.',
      route: '/games/poker',
      badge: 'Prototype',
      availability: 'Demo flow',
      theme: 'poker' as const
    }
  ];
}
