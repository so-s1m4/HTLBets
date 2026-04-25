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
  history: Array<{ number: number; color: string }>;
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
    >
      <app-card table>
        <div class="roulette-stage">
          <div class="roulette-stage__hero">
            <app-roulette-wheel
              [wheelRotation]="wheelRotation()"
              [ballRotation]="ballRotation()"
              [spinning]="isSpinning()"
            />

            <div class="roulette-stage__summary">
              <div class="page-heading">
                <span class="page-heading__eyebrow">Wheel State</span>
                <h2>Control deck</h2>
                <p class="status-copy">
                  The server decides the result. The client animates the wheel and ball landing sequence.
                </p>
              </div>

              <div class="glass-stat-grid">
                <div class="glass-stat">
                  <span class="glass-stat__label">Selection</span>
                  <strong class="glass-stat__value">{{ selectedType() }} {{ selectedValue() }}</strong>
                </div>
                <div class="glass-stat">
                  <span class="glass-stat__label">Spin state</span>
                  <strong class="glass-stat__value">{{ isSpinning() ? 'In motion' : 'Ready' }}</strong>
                </div>
              </div>

              @if (viewState()?.lastRound; as round) {
                <div class="roulette-highlight" [class.win]="round.won">
                  <div class="utility-row">
                    <span class="pill">Result highlight</span>
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
          </div>

          <app-card tone="muted">
            <div class="page-stack">
              <div class="utility-row">
                <h2>Betting layout</h2>
                <span class="pill">{{ selectedType() }}: {{ selectedValue() }}</span>
              </div>

              <app-roulette-board
                [selectedType]="selectedType()"
                [selectedValue]="selectedValue()"
                (colorSelected)="selectColor($event)"
                (numberSelected)="selectNumber($event)"
              />
            </div>
          </app-card>
        </div>
      </app-card>

      <app-card sidebar>
        <div class="page-stack roulette-sidebar">
          <div class="page-heading">
            <span class="page-heading__eyebrow">Chip Tray</span>
            <h3>Place your credits</h3>
          </div>

          <div class="roulette-chips">
            @for (chip of chipValues; track chip) {
              <button
                class="roulette-chip"
                [class.active]="selectedChip() === chip"
                (click)="selectChip(chip)"
              >
                {{ chip }}
              </button>
            }
          </div>

          <app-input
            label="Bet amount"
            helper="Tap a chip to prefill the bet amount."
            inputMode="numeric"
            [value]="betAmount()"
            (valueChange)="betAmount.set($event.replace(/\\D/g, ''))"
          />

          <app-button block [disabled]="isSpinning()" (click)="placeBet()">
            {{ isSpinning() ? 'Wheel spinning...' : 'Spin roulette' }}
          </app-button>

          @if (outcome(); as result) {
            <div class="page-stack roulette-result">
              <span class="pill">{{ result.result }}</span>
              <p class="roulette-result__amount" [class]="result.balanceChange >= 0 ? 'text-success' : 'text-danger'">
                {{ result.balanceChange | credits }}
              </p>
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

    .roulette-stage__hero {
      display: grid;
      gap: 1rem;
    }

    .roulette-stage__summary {
      display: grid;
      gap: 1rem;
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

    .roulette-chips {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.7rem;
    }

    .roulette-chip {
      position: relative;
      min-height: 4.2rem;
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

    .history {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    @media (min-width: 980px) {
      .roulette-stage__hero {
        grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
        align-items: center;
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
  readonly chipValues = [10, 25, 100, 250];

  readonly state = computed(() => this.socket.currentState());
  readonly viewState = computed(() => (this.state()?.state as unknown as RouletteViewState | null) || null);
  readonly currentBet = computed(() => this.state()?.currentBet || 0);
  readonly outcome = computed(() => this.state()?.outcome || null);

  constructor() {
    this.socket.reset();
    this.socket.joinGame('roulette');
    this.destroyRef.onDestroy(() => {
      this.socket.leaveGame('roulette', this.socket.currentState()?.sessionId);
      this.socket.reset();
    });

    effect((onCleanup) => {
      const round = this.viewState()?.lastRound;

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
