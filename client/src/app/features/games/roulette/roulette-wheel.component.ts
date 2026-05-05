import { Component, Input } from '@angular/core';

const wheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

@Component({
  selector: 'app-roulette-wheel',
  standalone: true,
  templateUrl: './roulette-wheel.component.html',
  styleUrl: './roulette-wheel.component.scss'
})
export class RouletteWheelComponent {
  @Input() wheelRotation = 0;
  @Input() ballRotation = 0;
  @Input() spinning = false;

  readonly wheel = wheelOrder;
  private readonly slotStep = 360 / this.wheel.length;

  labelTransform(index: number): string {
    const angle = this.slotCenterAngle(index);
    return `translate(-50%, -50%) rotate(${angle}deg) translateX(-6.18rem)`;
  }

  labelTextTransform(index: number): string {
    const angle = this.slotCenterAngle(index);
    return `rotate(${-angle}deg)`;
  }

  private slotCenterAngle(index: number): number {
    return this.slotStep * index + this.slotStep / 2;
  }

  isRed(value: number): boolean {
    return redNumbers.has(value);
  }
}
