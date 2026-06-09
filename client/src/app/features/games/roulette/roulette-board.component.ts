import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

type RouletteSelectionType = 'color' | 'number' | 'parity' | 'dozen' | 'range' | 'column';

@Component({
  selector: 'app-roulette-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roulette-board.component.html',
  styleUrl: './roulette-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RouletteBoardComponent {
  private readonly chipAssetGroups = [
    ['/casino/chips/chip_1_1.png', '/casino/chips/chip_1_2.png', '/casino/chips/chip_1_3.png', '/casino/chips/chip_1_4.png'],
    ['/casino/chips/chip_1_5.png', '/casino/chips/chip_1_6.png', '/casino/chips/chip_1_7.png', '/casino/chips/chip_1_8.png'],
    ['/casino/chips/chip_2_1.png', '/casino/chips/chip_2_2.png', '/casino/chips/chip_2_3.png', '/casino/chips/chip_2_4.png'],
    ['/casino/chips/chip_2_5.png', '/casino/chips/chip_2_6.png', '/casino/chips/chip_2_7.png', '/casino/chips/chip_2_8.png'],
    ['/casino/chips/chip_3_1.png', '/casino/chips/chip_3_2.png', '/casino/chips/chip_3_3.png', '/casino/chips/chip_3_4.png'],
    ['/casino/chips/chip_3_5.png', '/casino/chips/chip_3_6.png', '/casino/chips/chip_3_7.png', '/casino/chips/chip_3_8.png'],
    ['/casino/chips/chip_4_1.png', '/casino/chips/chip_4_2.png', '/casino/chips/chip_4_3.png', '/casino/chips/chip_4_4.png'],
    ['/casino/chips/chip_4_5.png', '/casino/chips/chip_4_6.png', '/casino/chips/chip_4_7.png', '/casino/chips/chip_4_8.png']
  ];
  private readonly redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  private aggregateMap = new Map<string, { totalAmount: number; playerCount: number }>();
  private chipMap = new Map<string, string[]>();

  @Input() selectedType: RouletteSelectionType = 'color';
  @Input() selectedValue: string | number = 'red';
  @Input()
  set aggregates(
    value: Array<{
      selectionType: 'color' | 'number' | 'parity' | 'dozen' | 'range' | 'column';
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

  @Output() readonly selectionSelected = new EventEmitter<{ selectionType: RouletteSelectionType; value: string | number }>();

  readonly columns:{type:RouletteSelectionType, value:number}[][] = Array.from({ length: 12 }, (_, columnIndex) => [
    {type: 'number', value: columnIndex * 3 + 3},
    {type: 'number', value: columnIndex * 3 + 2},
    {type: 'number', value: columnIndex * 3 + 1},
  ]);

  isRed(number: number): boolean {
    return this.redNumbers.has(number);
  }

  readonly dozens = [
    { label: '1st 12', value: '1st12' },
    { label: '2nd 12', value: '2nd12' },
    { label: '3rd 12', value: '3rd12' }
  ] as const;

  readonly outerBets = [
    { label: '1 to 18', type: 'range', value: '1-18', tone: 'green' },
    { label: 'EVEN', type: 'parity', value: 'even', tone: 'green' },
    { label: 'RED', type: 'color', value: 'red', tone: 'red' },
    { label: 'BLACK', type: 'color', value: 'black', tone: 'black' },
    { label: 'ODD', type: 'parity', value: 'odd', tone: 'green' },
    { label: '19 to 36', type: 'range', value: '19-36', tone: 'green' }
  ] as const;

  readonly columnsBets = [
    { label: '2 to 1', value: 'top' },
    { label: '2 to 1', value: 'middle' },
    { label: '2 to 1', value: 'bottom' }
  ] as const;

  emitSelection(selectionType: RouletteSelectionType, value: string | number): void {
    this.selectionSelected.emit({ selectionType, value });
  }

  getAggregate(selectionType: RouletteSelectionType, value: string | number): { totalAmount: number; playerCount: number } | null {
    return this.aggregateMap.get(this.aggregateKey(selectionType, value)) || null;
  }

  chipsFor(selectionType: RouletteSelectionType, value: string | number, totalAmount: number, playerCount: number): string[] {
    return this.chipMap.get(this.aggregateKey(selectionType, value)) || this.createChips(totalAmount, playerCount);
  }

  private aggregateKey(selectionType: RouletteSelectionType, value: string | number): string {
    return `${selectionType}:${value}`;
  }

  private createChips(totalAmount: number, playerCount: number): string[] {
    const chipCount = Math.min(5, Math.max(1, Math.ceil(playerCount)));
    const averageBet = totalAmount / chipCount;
    const stackLevel = averageBet >= 10_000 ? 3 : averageBet >= 1_000 ? 2 : averageBet >= 500 ? 1 : 0;

    return Array.from({ length: chipCount }, (_, index) => {
      const group = this.chipAssetGroups[(totalAmount + index) % this.chipAssetGroups.length] || this.chipAssetGroups[0];
      return group[stackLevel] || group[0];
    });
  }
}
