import { Component, Input } from '@angular/core';

import { AppCardComponent } from '../../../shared/ui/app-card.component';

@Component({
  selector: 'app-auth-panel',
  standalone: true,
  imports: [AppCardComponent],
  templateUrl: './auth-panel.component.html',
  styleUrl: './auth-panel.component.scss'
})
export class AuthPanelComponent {
  @Input() eyebrow = 'HTL Mini Games';
  @Input() title = '';
  @Input() subtitle = '';
}
