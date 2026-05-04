import { Component, Input } from '@angular/core';

import { CreditsPipe } from '../pipes/credits.pipe';

@Component({
  selector: 'app-balance-badge',
  standalone: true,
  imports: [CreditsPipe],
  templateUrl: './app-balance-badge.component.html',
  styleUrl: './app-balance-badge.component.scss'
})
export class AppBalanceBadgeComponent {
  @Input() balance = 0;
}
