import { Component, Input } from '@angular/core';

import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppBalanceBadgeComponent } from '../../../shared/ui/app-balance-badge.component';

@Component({
  selector: 'app-profile-summary',
  standalone: true,
  imports: [AppCardComponent, AppBalanceBadgeComponent],
  templateUrl: './profile-summary.component.html',
  styleUrl: './profile-summary.component.scss'
})
export class ProfileSummaryComponent {
  @Input() email = '';
  @Input() balance = 0;
}
