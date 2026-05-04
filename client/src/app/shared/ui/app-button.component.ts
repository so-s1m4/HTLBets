import { CommonModule } from '@angular/common';
import { Component, Input, booleanAttribute } from '@angular/core';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-button.component.html',
  styleUrl: './app-button.component.scss'
})
export class AppButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'ghost' = 'primary';
  @Input({ transform: booleanAttribute }) block = false;
  @Input({ transform: booleanAttribute }) disabled = false;
  @Input() type: 'button' | 'submit' = 'button';
}
