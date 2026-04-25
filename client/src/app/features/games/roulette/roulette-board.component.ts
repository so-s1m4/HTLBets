import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-roulette-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="roulette-board">
      <div class="roulette-board__surface">
        <div class="roulette-board__layout">
          <button
            class="roulette-board__zero"
            [class.active]="selectedType === 'number' && selectedValue === 0"
            (click)="numberSelected.emit(0)"
          >
            0
          </button>

          <div class="roulette-board__grid">
            @for (column of columns; track $index) {
              <div class="roulette-board__column">
                @for (number of column; track number) {
                  <button
                    class="roulette-board__number"
                    [class.active]="selectedType === 'number' && selectedValue === number"
                    [class.red]="isRed(number)"
                    (click)="numberSelected.emit(number)"
                  >
                    {{ number }}
                  </button>
                }
              </div>
            }
          </div>
        </div>
      </div>

      <div class="roulette-board__colors">
        <button
          class="roulette-board__choice red"
          [class.active]="selectedType === 'color' && selectedValue === 'red'"
          (click)="colorSelected.emit('red')"
        >
          Red
        </button>
        <button
          class="roulette-board__choice black"
          [class.active]="selectedType === 'color' && selectedValue === 'black'"
          (click)="colorSelected.emit('black')"
        >
          Black
        </button>
      </div>
    </div>
  `,
  styles: [`
    .roulette-board {
      display: grid;
      gap: 1rem;
    }

    .roulette-board__surface {
      overflow-x: auto;
      padding-bottom: 0.25rem;
    }

    .roulette-board__layout {
      min-width: 33rem;
      display: grid;
      grid-template-columns: 3.5rem minmax(0, 1fr);
      gap: 0.6rem;
      align-items: stretch;
    }

    .roulette-board__grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 0.42rem;
    }

    .roulette-board__column {
      display: grid;
      grid-template-rows: repeat(3, minmax(0, 1fr));
      gap: 0.42rem;
    }

    .roulette-board__colors {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      display: grid;
      gap: 0.7rem;
    }

    .roulette-board__choice,
    .roulette-board__zero,
    .roulette-board__number {
      position: relative;
      min-height: 3.15rem;
      border-radius: 18px;
      border: 1px solid rgba(149, 171, 211, 0.12);
      color: var(--text);
      cursor: pointer;
      transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 14px 24px rgba(5, 9, 20, 0.2);
      overflow: hidden;
    }

    .roulette-board__choice::before,
    .roulette-board__zero::before,
    .roulette-board__number::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.08), transparent 28%, transparent 68%, rgba(255, 255, 255, 0.02));
      pointer-events: none;
    }

    .roulette-board__choice.active,
    .roulette-board__zero.active,
    .roulette-board__number.active {
      transform: translateY(-2px);
      border-color: rgba(93, 168, 255, 0.32);
      box-shadow:
        0 0 0 4px rgba(93, 168, 255, 0.1),
        0 18px 32px rgba(5, 9, 20, 0.28);
    }

    .roulette-board__zero {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
        linear-gradient(180deg, rgba(39, 150, 99, 0.92), rgba(17, 90, 59, 0.98));
    }

    .roulette-board__choice.red,
    .roulette-board__number.red {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
        linear-gradient(180deg, rgba(178, 51, 75, 0.95), rgba(102, 20, 38, 0.98));
    }

    .roulette-board__choice.black {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
        linear-gradient(180deg, rgba(43, 51, 64, 0.95), rgba(9, 12, 18, 0.98));
    }

    .roulette-board__number {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
        linear-gradient(180deg, rgba(43, 51, 64, 0.95), rgba(9, 12, 18, 0.98));
    }

    @media (hover: hover) {
      .roulette-board__choice:hover,
      .roulette-board__zero:hover,
      .roulette-board__number:hover {
        transform: translateY(-2px);
      }
    }
  `]
})
export class RouletteBoardComponent {
  @Input() selectedType: 'color' | 'number' = 'color';
  @Input() selectedValue: string | number = 'red';

  @Output() readonly colorSelected = new EventEmitter<'red' | 'black'>();
  @Output() readonly numberSelected = new EventEmitter<number>();

  readonly columns = Array.from({ length: 12 }, (_, columnIndex) => [
    columnIndex * 3 + 3,
    columnIndex * 3 + 2,
    columnIndex * 3 + 1
  ]);

  isRed(number: number): boolean {
    return [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(number);
  }
}
