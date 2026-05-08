import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-roulette-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roulette-board.component.html',
  styleUrl: './roulette-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RouletteBoardComponent {
  @Input() selectedType: 'color' | 'number' = 'color';
  @Input() selectedValue: string | number = 'red';
  @Input() aggregates: Array<{
    selectionType: 'color' | 'number';
    value: string | number;
    totalAmount: number;
    playerCount: number;
  }> = [];

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

  getAggregate(selectionType: 'color' | 'number', value: string | number): { totalAmount: number; playerCount: number } | null {
    return this.aggregates.find((entry) => entry.selectionType === selectionType && entry.value === value) || null;
  }

  buildChips(totalAmount: number, playerCount: number): string[] {
    const chipPalette = ['#f4f7ff', '#ff6f91', '#5da8ff', '#ffd166', '#7de3ff'];
    const chipCount = Math.min(5, Math.max(1, Math.ceil(playerCount)));

    return Array.from({ length: chipCount }, (_, index) => chipPalette[(totalAmount + index) % chipPalette.length] || '#7de3ff');
  }
}
