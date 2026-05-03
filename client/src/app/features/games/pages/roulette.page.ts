import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';

import { GameSocketService } from '../../../core/services/game-socket.service';
import { AppButtonComponent } from '../../../shared/ui/app-button.component';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppInputComponent } from '../../../shared/ui/app-input.component';
import { CreditsPipe } from '../../../shared/pipes/credits.pipe';
import { GameShellComponent } from '../components/game-shell.component';
import { RouletteBoardComponent } from '../roulette/roulette-board.component';
import { RouletteWheelComponent } from '../roulette/roulette-wheel.component';

interface RouletteViewState {
  phase: 'betting' | 'spinning';
  roundId: number;
  bettingClosesAt: string;
  history: Array<{ number: number; color: string }>;
  bets: Array<{
    userId: string;
    playerLabel: string;
    amount: number;
    selection: { type: 'color' | 'number'; value: string | number };
    placedAt: string;
  }>;
  aggregates: Array<{
    selectionType: 'color' | 'number';
    value: string | number;
    totalAmount: number;
    playerCount: number;
  }>;
  lastSpin?: { number: number; color: string };
  lastRound?: {
    selection: { type: 'color' | 'number'; value: string | number };
    spin: { number: number; color: string };
    payoutMultiplier: number;
    won: boolean;
  };
}

@Component({
  selector: 'app-roulette-page',
  standalone: true,
  imports: [
    AppButtonComponent,
    AppCardComponent,
    AppInputComponent,
    CreditsPipe,
    GameShellComponent,
    RouletteBoardComponent,
    RouletteWheelComponent
  ],
  template: `
    <app-game-shell
      title="Roulette"
      subtitle="A premium demo wheel with strong mechanical depth, tactile chips, and a CSS-driven ball and wheel spin sequence."
      [connectionState]="socket.connectionState()"
      [currentBet]="currentBet()"
      [error]="socket.lastError() || ''"
      [hasSidebar]="hasSidebarContent()"
    >
      <app-card table>
        <div class="roulette-table">
          <div class="roulette-table__topline">
            <span class="roulette-table__brand">Roulette Royale</span>
            <span class="pill">Round #{{ viewState()?.roundId || 1 }}</span>
            <span class="pill">{{ countdownLabel() }}</span>
            <span class="pill">{{ isSpinning() ? 'Spinning' : 'Open for bets' }}</span>
          </div>

          <div class="roulette-table__surface">
            <div class="roulette-table__wheel-bay">
              <div class="roulette-table__wheel-shell">
                <app-roulette-wheel
                  [wheelRotation]="wheelRotation()"
                  [ballRotation]="ballRotation()"
                  [spinning]="isSpinning()"
                />
              </div>

              @if (viewState()?.lastRound; as round) {
                <div class="roulette-highlight" [class.win]="round.won">
                  <div class="utility-row">
                    <span class="pill">Last spin</span>
                    <span [class]="round.won ? 'text-success' : 'text-danger'">
                      {{ round.won ? 'Win' : 'Loss' }}
                    </span>
                  </div>

                  <div class="roulette-highlight__number">
                    <strong>{{ round.spin.number }}</strong>
                    <span>{{ round.spin.color }}</span>
                  </div>

                  <p class="status-copy">
                    {{ round.selection.type }} {{ round.selection.value }} at x{{ round.payoutMultiplier }}
                  </p>
                </div>
              }
            </div>

            <div class="roulette-table__board-bay">
              <div class="roulette-table__board-head">
                <div class="page-heading">
                  <span class="page-heading__eyebrow">Main Table</span>
                  <h2>Full betting board</h2>
                </div>
                <span class="pill">{{ selectedType() }}: {{ selectedValue() }}</span>
              </div>

              <app-roulette-board
                [selectedType]="selectedType()"
                [selectedValue]="selectedValue()"
                [aggregates]="viewState()?.aggregates || []"
                (colorSelected)="selectColor($event)"
                (numberSelected)="selectNumber($event)"
              />

              <div class="roulette-table__rail">
                <div class="roulette-table__rail-meta">
                  <span class="pill">{{ countdownLabel() }}</span>
                  <span class="pill">{{ selectedType() }} {{ selectedValue() }}</span>
                  <span class="pill">Round #{{ viewState()?.roundId || 1 }}</span>
                </div>

                <div class="roulette-table__rail-tray">
                  @for (chip of chipValues; track chip) {
                    <button
                      class="roulette-chip"
                      [class.active]="selectedChip() === chip"
                      (click)="selectChip(chip)"
                    >
                      {{ chip }}
                    </button>
                  }

                  <app-input
                    label="Bet amount"
                    helper="Tap a chip to prefill the bet amount."
                    inputMode="numeric"
                    [value]="betAmount()"
                    (valueChange)="betAmount.set($event.replace(/\\D/g, ''))"
                  />

                  <app-button block [disabled]="isSpinning()" (click)="placeBet()">
                    {{ isSpinning() ? 'Betting closed...' : 'Place bet on table' }}
                  </app-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </app-card>

      @if (hasSidebarContent()) {
        <app-card sidebar>
          <div class="page-stack roulette-sidebar">
            @if (outcome(); as result) {
              <div class="page-stack roulette-result">
                <span class="pill">{{ result.result }}</span>
                <p class="roulette-result__amount" [class]="result.balanceChange >= 0 ? 'text-success' : 'text-danger'">
                  {{ result.balanceChange | credits }}
                </p>
              </div>
            }

            @if (viewState()?.bets?.length) {
              <div class="page-stack">
                <div class="utility-row">
                  <h3>Live table bets</h3>
                  <span class="pill">{{ viewState()?.bets?.length }} placed</span>
                </div>

                <div class="roulette-bet-feed">
                  @for (bet of viewState()?.bets || []; track $index) {
                    <div class="roulette-bet-feed__item">
                      <strong>{{ bet.playerLabel }}</strong>
                      <span>{{ bet.selection.type }} {{ bet.selection.value }}</span>
                      <span>{{ bet.amount }} cr</span>
                    </div>
                  }
                </div>
              </div>
            }

            @if (viewState()?.history?.length) {
              <div class="page-stack">
                <h3>Recent spins</h3>
                <div class="history">
                  @for (entry of viewState()?.history || []; track $index) {
                    <span class="pill">{{ entry.number }} / {{ entry.color }}</span>
                  }
                </div>
              </div>
            }
          </div>
        </app-card>
      }
    </app-game-shell>
  `,
  styles: [`
    h2,
    h3 {
      margin: 0;
    }

    .roulette-stage {
      display: grid;
      gap: 1rem;
    }

    .roulette-table {
      display: grid;
      gap: 1rem;
      padding: 0.25rem;
    }

    .roulette-table__topline {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      flex-wrap: wrap;
      padding: 0 0.25rem;
    }

    .roulette-table__brand {
      margin-right: auto;
      color: var(--accent-cyan);
      font-family: 'SF Mono', 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 0.74rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }

    .roulette-table__surface {
      display: grid;
      gap: 1rem;
      padding: 1rem;
      border-radius: 32px;
      border: 1px solid rgba(116, 156, 121, 0.18);
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.05), transparent 26%),
        linear-gradient(180deg, rgba(15, 79, 67, 0.92), rgba(10, 50, 44, 0.96) 48%, rgba(8, 35, 33, 0.98));
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.08),
        inset 0 -24px 40px rgba(0, 0, 0, 0.18),
        0 20px 42px rgba(4, 8, 20, 0.22);
    }

    .roulette-table__wheel-bay,
    .roulette-table__board-bay {
      display: grid;
      gap: 1rem;
    }

    .roulette-table__wheel-shell {
      position: relative;
      padding: 1.1rem 0.9rem 1.2rem;
      border-radius: 50% / 44%;
      border: 1px solid rgba(57, 37, 23, 0.88);
      background:
        radial-gradient(circle at 35% 28%, rgba(255, 255, 255, 0.12), transparent 22%),
        linear-gradient(180deg, rgba(100, 67, 39, 0.98), rgba(39, 24, 15, 1));
      box-shadow:
        inset 0 2px 0 rgba(255, 255, 255, 0.16),
        inset 0 -22px 34px rgba(0, 0, 0, 0.28),
        0 22px 36px rgba(0, 0, 0, 0.24);
    }

    .roulette-table__wheel-shell::after {
      content: '';
      position: absolute;
      inset: auto 14% -1rem 14%;
      height: 1.8rem;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 0, 0, 0.35), transparent 72%);
      filter: blur(12px);
      pointer-events: none;
    }

    .roulette-table__wheel-shell::before {
      content: '';
      position: absolute;
      inset: 0.55rem;
      border-radius: 50% / 44%;
      border: 1px solid rgba(255, 238, 195, 0.12);
      pointer-events: none;
    }

    .roulette-table__board-bay {
      padding: 1rem;
      border-radius: 28px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
        rgba(7, 26, 25, 0.54);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .roulette-table__board-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .roulette-table__rail {
      display: grid;
      gap: 0.9rem;
      padding-top: 0.2rem;
    }

    .roulette-table__rail-meta {
      display: flex;
      gap: 0.55rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .roulette-table__rail-tray {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(4, minmax(0, 4rem)) minmax(11rem, 1fr) minmax(10rem, 12rem);
      align-items: end;
      padding: 0.85rem;
      border-radius: 22px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
        rgba(8, 22, 24, 0.56);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .roulette-highlight {
      padding: 1rem;
      border-radius: var(--radius-lg);
      border: 1px solid rgba(149, 171, 211, 0.12);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(18, 26, 40, 0.98), rgba(11, 17, 27, 0.98));
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 18px 32px rgba(5, 9, 20, 0.22);
    }

    .roulette-highlight.win {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 0 36px rgba(93, 168, 255, 0.14),
        0 20px 36px rgba(5, 9, 20, 0.22);
    }

    .roulette-highlight__number {
      display: flex;
      align-items: baseline;
      gap: 0.7rem;
      margin: 0.75rem 0 0.45rem;
    }

    .roulette-highlight__number strong {
      font-size: 2.8rem;
      line-height: 1;
      letter-spacing: -0.06em;
    }

    .roulette-highlight__number span {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--accent-cyan);
      font-size: 0.78rem;
    }

    .roulette-sidebar {
      position: sticky;
      top: 6.2rem;
    }

    .roulette-chip {
      position: relative;
      min-height: 3.8rem;
      border-radius: 50%;
      border: 1px solid rgba(149, 171, 211, 0.16);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0)),
        radial-gradient(circle at 30% 30%, rgba(93, 168, 255, 0.18), transparent 36%),
        linear-gradient(180deg, rgba(19, 28, 42, 0.98), rgba(9, 14, 23, 0.98));
      color: var(--text);
      font-weight: 700;
      letter-spacing: -0.03em;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.08),
        inset 0 0 0 6px rgba(255, 255, 255, 0.025),
        0 14px 26px rgba(5, 9, 20, 0.22);
      cursor: pointer;
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
    }

    .roulette-chip.active {
      transform: translateY(-2px);
      border-color: rgba(93, 168, 255, 0.34);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.08),
        inset 0 0 0 6px rgba(255, 255, 255, 0.04),
        0 0 22px rgba(93, 168, 255, 0.14),
        0 18px 28px rgba(5, 9, 20, 0.28);
    }

    .roulette-result {
      padding: 1rem;
      border-radius: var(--radius-lg);
      border: 1px solid rgba(149, 171, 211, 0.12);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(16, 24, 37, 0.98), rgba(10, 15, 24, 0.98));
    }

    .roulette-result__amount {
      margin: 0;
      font-size: 1.9rem;
      line-height: 1;
      letter-spacing: -0.05em;
    }

    .roulette-bet-feed {
      display: grid;
      gap: 0.55rem;
      max-height: 16rem;
      overflow: auto;
      padding-right: 0.2rem;
    }

    .roulette-bet-feed__item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 0.55rem;
      align-items: center;
      padding: 0.7rem 0.8rem;
      border-radius: 16px;
      border: 1px solid rgba(149, 171, 211, 0.1);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(15, 22, 34, 0.96), rgba(9, 14, 22, 0.98));
      font-size: 0.84rem;
    }

    .roulette-bet-feed__item strong {
      letter-spacing: -0.02em;
    }

    .history {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    @media (min-width: 1080px) {
      .roulette-table__surface {
        grid-template-columns: minmax(220px, 0.6fr) minmax(0, 1.7fr);
        align-items: stretch;
      }

      .roulette-table__wheel-bay {
        align-content: start;
      }
    }

    @media (max-width: 1080px) {
      .roulette-table__rail-tray {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .roulette-table__rail-tray app-input,
      .roulette-table__rail-tray app-button {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 860px) {
      .roulette-sidebar {
        position: static;
      }

      .roulette-bet-feed__item {
        grid-template-columns: 1fr;
        align-items: flex-start;
      }
    }

    @media (max-width: 640px) {
      .roulette-table {
        gap: 0.8rem;
        padding: 0;
      }

      .roulette-table__surface {
        padding: 0.75rem;
        border-radius: 26px;
      }

      .roulette-table__topline {
        padding: 0;
        gap: 0.45rem;
      }

      .roulette-table__brand {
        width: 100%;
        margin-right: 0;
      }

      .roulette-table__wheel-shell {
        max-width: 18.5rem;
        margin: 0 auto;
      }

      .roulette-table__board-bay {
        padding: 0.82rem;
        border-radius: 24px;
      }

      .roulette-table__board-head {
        gap: 0.7rem;
      }

      .roulette-table__rail-tray {
        gap: 0.65rem;
        padding: 0.75rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .roulette-chip {
        min-height: 3.3rem;
      }

      .roulette-highlight__number strong {
        font-size: 2.25rem;
      }
    }

    @media (max-width: 420px) {
      .roulette-table__surface {
        padding: 0.65rem;
      }

      .roulette-table__board-bay {
        padding: 0.7rem;
      }

      .roulette-table__rail-meta {
        gap: 0.4rem;
      }
    }
  `]
})
export class RoulettePageComponent {
  readonly socket = inject(GameSocketService);

  private readonly destroyRef = inject(DestroyRef);
  private lastSpinSignature = '';

  readonly betAmount = signal('25');
  readonly selectedChip = signal(25);
  readonly selectedType = signal<'color' | 'number'>('color');
  readonly selectedValue = signal<string | number>('red');
  readonly wheelRotation = signal(0);
  readonly ballRotation = signal(0);
  readonly isSpinning = signal(false);
  readonly countdownMs = signal(0);
  readonly chipValues = [10, 25, 100, 250];

  readonly state = computed(() => this.socket.currentState());
  readonly viewState = computed(() => (this.state()?.state as unknown as RouletteViewState | null) || null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly outcome = computed(() => this.state()?.outcome || null);
  readonly hasSidebarContent = computed(() => {
    const state = this.viewState();
    return Boolean(this.outcome() || state?.bets?.length || state?.history?.length);
  });
  readonly countdownLabel = computed(() => {
    if (this.isSpinning()) {
      return 'Spinning';
    }

    const totalSeconds = Math.max(0, Math.ceil(this.countdownMs() / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  });

  constructor() {
    this.socket.reset();
    this.socket.joinGame('roulette');
    this.destroyRef.onDestroy(() => {
      this.socket.leaveGame('roulette', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });

    effect((onCleanup) => {
      const round = this.viewState()?.lastRound;
      const phase = this.viewState()?.phase;

      this.isSpinning.set(phase === 'spinning');

      if (!round) {
        return;
      }

      const signature = `${round.spin.number}:${round.selection.type}:${round.selection.value}`;

      if (signature === this.lastSpinSignature) {
        return;
      }

      this.lastSpinSignature = signature;

      const step = 360 / 37;
      const wheelIndex = this.wheelOrder.indexOf(round.spin.number);
      const targetRotation = 360 - wheelIndex * step;
      const nextWheel = this.wheelRotation() + 1800 + targetRotation - (this.wheelRotation() % 360);
      const nextBall = this.ballRotation() + 2520 - (this.ballRotation() % 360);

      this.wheelRotation.set(nextWheel);
      this.ballRotation.set(nextBall);
      this.isSpinning.set(true);

      const timer = window.setTimeout(() => {
        this.isSpinning.set(false);
      }, 4500);

      onCleanup(() => window.clearTimeout(timer));
    });

    const countdownTimer = window.setInterval(() => {
      const closesAt = this.viewState()?.bettingClosesAt;

      if (!closesAt) {
        this.countdownMs.set(0);
        return;
      }

      this.countdownMs.set(new Date(closesAt).getTime() - Date.now());
    }, 250);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(countdownTimer);
    });
  }

  private readonly wheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

  selectColor(color: 'red' | 'black'): void {
    this.selectedType.set('color');
    this.selectedValue.set(color);
  }

  selectNumber(number: number): void {
    this.selectedType.set('number');
    this.selectedValue.set(number);
  }

  selectChip(chip: number): void {
    this.selectedChip.set(chip);
    this.betAmount.set(String(chip));
  }

  placeBet(): void {
    const amount = Number(this.betAmount());

    if (!amount) {
      return;
    }

    this.selectedChip.set(amount);
    this.socket.placeBet('roulette', amount, {
      selectionType: this.selectedType(),
      value: this.selectedValue()
    });
  }
}
