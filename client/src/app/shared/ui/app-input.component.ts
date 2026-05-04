import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-input.component.html',
  styleUrl: './app-input.component.scss'
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
