import { Component, Input } from '@angular/core';

import { AppCardComponent } from '../../../shared/ui/app-card.component';

@Component({
  selector: 'app-game-shell',
  standalone: true,
  imports: [AppCardComponent],
  templateUrl: './game-shell.component.html',
  styleUrl: './game-shell.component.scss'
})
export class GameShellComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() connectionState = 'disconnected';
  @Input() currentBet = 0;
  @Input() error = '';
  @Input() hasSidebar = true;
  @Input() splitSidebar = true;
}
