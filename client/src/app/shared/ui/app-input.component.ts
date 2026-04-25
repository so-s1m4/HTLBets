import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="app-input">
      <span class="app-input__label">{{ label }}</span>
      <input
        class="app-input__control"
        [type]="type"
        [placeholder]="placeholder"
        [value]="value"
        [disabled]="disabled"
        [attr.maxlength]="maxlength || null"
        [attr.inputmode]="inputMode || null"
        (input)="onInput($event)"
      />
      @if (helper) {
        <span class="app-input__helper">{{ helper }}</span>
      }
    </label>
  `,
  styles: [`
    .app-input {
      display: grid;
      gap: 0.62rem;
    }

    .app-input__label {
      font-size: 0.78rem;
      color: var(--text-soft);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-family: 'SF Mono', 'IBM Plex Mono', ui-monospace, monospace;
    }

    .app-input__control {
      min-height: 3.35rem;
      padding: 0.92rem 1rem;
      border-radius: 22px;
      border: 1px solid rgba(149, 171, 211, 0.14);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
        linear-gradient(180deg, rgba(13, 20, 31, 0.98), rgba(10, 16, 26, 0.98));
      color: var(--text);
      outline: none;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 10px 22px rgba(4, 8, 20, 0.18);
      transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }

    .app-input__control:focus {
      transform: translateY(-1px);
      border-color: rgba(93, 168, 255, 0.32);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 0 0 4px rgba(93, 168, 255, 0.12),
        0 18px 34px rgba(4, 8, 20, 0.24);
    }

    .app-input__helper {
      font-size: 0.8rem;
      color: var(--text-soft);
    }
  `]
})
export class AppInputComponent {
  @Input() label = '';
  @Input() placeholder = '';
  @Input() type = 'text';
  @Input() value = '';
  @Input() helper = '';
  @Input() disabled = false;
  @Input() maxlength?: number;
  @Input() inputMode?: string;

  @Output() readonly valueChange = new EventEmitter<string>();

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.valueChange.emit(input.value);
  }
}
