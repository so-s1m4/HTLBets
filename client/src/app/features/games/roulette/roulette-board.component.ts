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
  private readonly chipPalette = ['#f4f7ff', '#ff6f91', '#5da8ff', '#ffd166', '#7de3ff'];
  private readonly redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  private aggregateMap = new Map<string, { totalAmount: number; playerCount: number }>();
  private chipMap = new Map<string, string[]>();

  @Input() selectedType: 'color' | 'number' = 'color';
  @Input() selectedValue: string | number = 'red';
  @Input()
  set aggregates(
    value: Array<{
      selectionType: 'color' | 'number';
      value: string | number;
      totalAmount: number;
      playerCount: number;
    }>
  ) {
    this.aggregateMap = new Map();
    this.chipMap = new Map();

    for (const entry of value || []) {
      const key = this.aggregateKey(entry.selectionType, entry.value);
      const aggregate = { totalAmount: entry.totalAmount, playerCount: entry.playerCount };
      this.aggregateMap.set(key, aggregate);
      this.chipMap.set(key, this.createChips(entry.totalAmount, entry.playerCount));
    }
  }

  @Output() readonly colorSelected = new EventEmitter<'red' | 'black'>();
  @Output() readonly numberSelected = new EventEmitter<number>();

  readonly columns = Array.from({ length: 12 }, (_, columnIndex) => [
    columnIndex * 3 + 3,
    columnIndex * 3 + 2,
    columnIndex * 3 + 1
  ]);

  isRed(number: number): boolean {
    return this.redNumbers.has(number);
  }

  getAggregate(selectionType: 'color' | 'number', value: string | number): { totalAmount: number; playerCount: number } | null {
    return this.aggregateMap.get(this.aggregateKey(selectionType, value)) || null;
  }

  chipsFor(selectionType: 'color' | 'number', value: string | number, totalAmount: number, playerCount: number): string[] {
    return this.chipMap.get(this.aggregateKey(selectionType, value)) || this.createChips(totalAmount, playerCount);
  }

  private aggregateKey(selectionType: 'color' | 'number', value: string | number): string {
    return `${selectionType}:${value}`;
  }

  private createChips(totalAmount: number, playerCount: number): string[] {
    const chipCount = Math.min(5, Math.max(1, Math.ceil(playerCount)));
    return Array.from({ length: chipCount }, (_, index) => this.chipPalette[(totalAmount + index) % this.chipPalette.length] || '#7de3ff');
  }
}
