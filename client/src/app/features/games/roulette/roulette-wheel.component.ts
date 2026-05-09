import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

const wheelOrder: Array<number | '00'> = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];
const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

@Component({
  selector: 'app-roulette-wheel',
  standalone: true,
  templateUrl: './roulette-wheel.component.html',
  styleUrl: './roulette-wheel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RouletteWheelComponent {
  @Input() wheelRotation = 0;
  @Input() ballRotation = 0;
  @Input() spinning = false;

  readonly wheel = wheelOrder;
  private readonly slotStep = 360 / this.wheel.length;
  readonly segmentsBackground = this.buildSegmentsBackground();
  readonly labelTransforms = this.wheel.map((_, index) => {
    const angle = this.slotCenterAngle(index);
    return `translate(-50%, -50%) rotate(${angle}deg) translateX(-6.18rem)`;
  });
  readonly labelTextTransforms = this.wheel.map((_, index) => {
    const angle = this.slotCenterAngle(index);
    return `rotate(${-angle}deg)`;
  });

  labelTransform(index: number): string {
    return this.labelTransforms[index] || '';
  }

  labelTextTransform(index: number): string {
    return this.labelTextTransforms[index] || '';
  }

  private slotCenterAngle(index: number): number {
    return this.slotStep * index + this.slotStep / 2;
  }

  isRed(value: number | '00'): boolean {
    return typeof value === 'number' && redNumbers.has(value);
  }

  private buildSegmentsBackground(): string {
    const segments = this.wheel.map((slot, index) => {
      const start = this.slotStep * index;
      const end = start + this.slotStep;
      const color = slot === 0 || slot === '00' ? '#1f8c5d' : this.isRed(slot) ? '#ad2d48' : '#262b37';
      return `${color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    });

    return `conic-gradient(from -90deg, ${segments.join(', ')})`;
  }
}
