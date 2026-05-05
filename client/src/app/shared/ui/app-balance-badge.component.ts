import { ChangeDetectionStrategy, Component, DestroyRef, Input, inject, signal } from '@angular/core';

import { CreditsPipe } from '../pipes/credits.pipe';

@Component({
  selector: 'app-balance-badge',
  standalone: true,
  imports: [CreditsPipe],
  templateUrl: './app-balance-badge.component.html',
  styleUrl: './app-balance-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppBalanceBadgeComponent {
  private readonly destroyRef = inject(DestroyRef);

  private animationFrameId: number | null = null;
  private lastSettledBalance = 0;
  private isFirstValue = true;

  readonly displayBalance = signal(0);
  readonly trend = signal<'up' | 'down' | 'steady'>('steady');

  @Input()
  set balance(value: number) {
    const nextBalance = Number.isFinite(value) ? value : 0;

    if (this.isFirstValue) {
      this.isFirstValue = false;
      this.lastSettledBalance = nextBalance;
      this.displayBalance.set(nextBalance);
      this.trend.set('steady');
      return;
    }

    if (nextBalance === this.lastSettledBalance) {
      this.displayBalance.set(nextBalance);
      this.trend.set('steady');
      return;
    }

    this.trend.set(nextBalance > this.lastSettledBalance ? 'up' : 'down');
    this.animateBalance(this.displayBalance(), nextBalance);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cancelAnimation();
    });
  }

  private animateBalance(from: number, to: number): void {
    this.cancelAnimation();

    const startedAt = performance.now();
    const duration = Math.min(1400, Math.max(380, Math.abs(to - from) * 10));

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (to - from) * eased);

      this.displayBalance.set(value);

      if (progress < 1) {
        this.animationFrameId = window.requestAnimationFrame(step);
        return;
      }

      this.displayBalance.set(to);
      this.lastSettledBalance = to;
      window.setTimeout(() => {
        if (this.lastSettledBalance === to) {
          this.trend.set('steady');
        }
      }, 260);
      this.animationFrameId = null;
    };

    this.animationFrameId = window.requestAnimationFrame(step);
  }

  private cancelAnimation(): void {
    if (this.animationFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }
}
