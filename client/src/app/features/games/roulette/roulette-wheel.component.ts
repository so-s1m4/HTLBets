import { Component, Input } from '@angular/core';

const wheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

@Component({
  selector: 'app-roulette-wheel',
  standalone: true,
  template: `
    <div class="roulette-wheel" [class.spinning]="spinning">
      <div class="roulette-wheel__marker"></div>

      <div class="roulette-wheel__ball-track" [style.transform]="'rotate(' + ballRotation + 'deg)'">
        <span class="roulette-wheel__ball"></span>
      </div>

      <div class="roulette-wheel__plate" [style.transform]="'rotate(' + wheelRotation + 'deg)'">
        <div class="roulette-wheel__outer-ring"></div>
        <div class="roulette-wheel__segments"></div>

        <div class="roulette-wheel__labels">
          @for (slot of wheel; track slot; let index = $index) {
            <span
              class="roulette-wheel__label"
              [class.red]="isRed(slot)"
              [class.green]="slot === 0"
              [style.transform]="labelTransform(index)"
            >
              <span [style.transform]="labelTextTransform(index)">{{ slot }}</span>
            </span>
          }
        </div>

        <div class="roulette-wheel__inner-ring"></div>
        <div class="roulette-wheel__hub"></div>
      </div>

      <div class="roulette-wheel__shadow"></div>
    </div>
  `,
  styles: [`
    .roulette-wheel {
      position: relative;
      width: min(100%, 20rem);
      aspect-ratio: 1;
      margin: 0 auto;
      animation: soft-float 8s ease-in-out infinite;
    }

    .roulette-wheel__marker {
      position: absolute;
      z-index: 6;
      top: 0.2rem;
      left: 50%;
      width: 1.2rem;
      height: 1.5rem;
      transform: translateX(-50%);
      clip-path: polygon(50% 100%, 0 0, 100% 0);
      background: linear-gradient(180deg, rgba(255, 244, 213, 0.98), rgba(203, 175, 113, 0.88));
      filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.22));
    }

    .roulette-wheel__ball-track,
    .roulette-wheel__plate,
    .roulette-wheel__shadow {
      position: absolute;
      inset: 0;
      border-radius: 50%;
    }

    .roulette-wheel__ball-track {
      z-index: 5;
      transition: transform 4.6s cubic-bezier(0.08, 0.76, 0.14, 1);
    }

    .roulette-wheel__ball {
      position: absolute;
      top: 1.7rem;
      left: 50%;
      width: 0.88rem;
      height: 0.88rem;
      transform: translateX(-50%);
      border-radius: 50%;
      background:
        radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0.9) 30%, rgba(211, 230, 255, 0.92) 52%, rgba(107, 126, 168, 0.95));
      box-shadow:
        0 0 0 2px rgba(255, 255, 255, 0.08),
        0 8px 18px rgba(0, 0, 0, 0.4),
        0 0 20px rgba(255, 255, 255, 0.25);
    }

    .roulette-wheel__plate {
      z-index: 2;
      overflow: hidden;
      transition: transform 4.3s cubic-bezier(0.1, 0.84, 0.18, 1);
      background:
        radial-gradient(circle at center, rgba(255, 255, 255, 0.08), transparent 52%),
        radial-gradient(circle at center, rgba(255, 255, 255, 0.05), transparent 66%),
        #281b12;
      box-shadow:
        inset 0 2px 0 rgba(255, 255, 255, 0.18),
        inset 0 -18px 40px rgba(0, 0, 0, 0.32),
        0 24px 54px rgba(0, 0, 0, 0.32);
    }

    .roulette-wheel__outer-ring {
      position: absolute;
      inset: 0.25rem;
      border-radius: 50%;
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.18), transparent 28%),
        linear-gradient(180deg, rgba(113, 82, 53, 0.95), rgba(55, 38, 24, 1));
      box-shadow:
        inset 0 2px 0 rgba(255, 255, 255, 0.18),
        inset 0 -12px 18px rgba(0, 0, 0, 0.25);
    }

    .roulette-wheel__segments {
      position: absolute;
      inset: 1.38rem;
      border-radius: 50%;
      background:
        conic-gradient(
          from -90deg,
          #1f8c5d 0deg 9.73deg,
          #ad2d48 9.73deg 19.46deg,
          #262b37 19.46deg 29.19deg,
          #ad2d48 29.19deg 38.92deg,
          #262b37 38.92deg 48.65deg,
          #ad2d48 48.65deg 58.38deg,
          #262b37 58.38deg 68.11deg,
          #ad2d48 68.11deg 77.84deg,
          #262b37 77.84deg 87.57deg,
          #ad2d48 87.57deg 97.3deg,
          #262b37 97.3deg 107.03deg,
          #ad2d48 107.03deg 116.76deg,
          #262b37 116.76deg 126.49deg,
          #ad2d48 126.49deg 136.22deg,
          #262b37 136.22deg 145.95deg,
          #ad2d48 145.95deg 155.68deg,
          #262b37 155.68deg 165.41deg,
          #ad2d48 165.41deg 175.14deg,
          #262b37 175.14deg 184.87deg,
          #ad2d48 184.87deg 194.6deg,
          #262b37 194.6deg 204.33deg,
          #ad2d48 204.33deg 214.06deg,
          #262b37 214.06deg 223.79deg,
          #ad2d48 223.79deg 233.52deg,
          #262b37 233.52deg 243.25deg,
          #ad2d48 243.25deg 252.98deg,
          #262b37 252.98deg 262.71deg,
          #ad2d48 262.71deg 272.44deg,
          #262b37 272.44deg 282.17deg,
          #ad2d48 282.17deg 291.9deg,
          #262b37 291.9deg 301.63deg,
          #ad2d48 301.63deg 311.36deg,
          #262b37 311.36deg 321.09deg,
          #ad2d48 321.09deg 330.82deg,
          #262b37 330.82deg 340.55deg,
          #ad2d48 340.55deg 350.28deg,
          #262b37 350.28deg 360deg
        );
      box-shadow:
        inset 0 0 0 10px rgba(51, 33, 21, 0.82),
        inset 0 0 18px rgba(255, 255, 255, 0.08);
    }

    .roulette-wheel__labels {
      position: absolute;
      inset: 0;
      z-index: 3;
    }

    .roulette-wheel__label {
      position: absolute;
      top: 50%;
      left: 50%;
      transform-origin: center center;
      color: rgba(248, 250, 255, 0.92);
      font-size: 0.5rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.03em;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
      pointer-events: none;
    }

    .roulette-wheel__label span {
      display: block;
      min-width: 0.95rem;
      text-align: center;
    }

    .roulette-wheel__label.red {
      color: #ffb0bf;
    }

    .roulette-wheel__label.green {
      color: #9bf0c7;
    }

    .roulette-wheel__inner-ring {
      position: absolute;
      inset: 3.45rem;
      border-radius: 50%;
      background:
        radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.2), transparent 36%),
        linear-gradient(180deg, rgba(90, 61, 35, 0.96), rgba(30, 20, 13, 1));
      box-shadow:
        inset 0 2px 0 rgba(255, 255, 255, 0.12),
        inset 0 -12px 18px rgba(0, 0, 0, 0.28);
    }

    .roulette-wheel__hub {
      position: absolute;
      inset: 5.45rem;
      border-radius: 50%;
      background:
        radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3), transparent 26%),
        linear-gradient(180deg, rgba(250, 253, 255, 0.95), rgba(181, 195, 220, 0.88));
      box-shadow:
        inset 0 2px 0 rgba(255, 255, 255, 0.48),
        0 12px 18px rgba(0, 0, 0, 0.24);
    }

    .roulette-wheel__shadow {
      z-index: 1;
      inset: auto 12% -0.9rem 12%;
      height: 2.4rem;
      background: radial-gradient(circle, rgba(0, 0, 0, 0.34), transparent 70%);
      filter: blur(18px);
    }

    .roulette-wheel.spinning .roulette-wheel__ball {
      animation: roulette-ball-bounce 360ms ease-in-out infinite alternate;
    }

    @keyframes roulette-ball-bounce {
      0% {
        transform: translateX(-50%) translateY(0);
      }
      100% {
        transform: translateX(-50%) translateY(-3px);
      }
    }
  `]
})
export class RouletteWheelComponent {
  @Input() wheelRotation = 0;
  @Input() ballRotation = 0;
  @Input() spinning = false;

  readonly wheel = wheelOrder;

  labelTransform(index: number): string {
    const angle = (360 / this.wheel.length) * index;
    return `translate(-50%, -50%) rotate(${angle - 90}deg) translateY(-6.18rem)`;
  }

  labelTextTransform(index: number): string {
    const angle = (360 / this.wheel.length) * index;
    return `rotate(${90 - angle}deg)`;
  }

  isRed(value: number): boolean {
    return redNumbers.has(value);
  }
}
