import { Component, Input } from '@angular/core';

import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppBalanceBadgeComponent } from '../../../shared/ui/app-balance-badge.component';

@Component({
  selector: 'app-profile-summary',
  standalone: true,
  imports: [AppCardComponent, AppBalanceBadgeComponent],
  template: `
    <app-card tone="accent">
      <div class="profile-summary">
        <div class="page-heading">
          <span class="page-heading__eyebrow">Profile</span>
          <h1>{{ email }}</h1>
          <p class="status-copy">Demo credits only. No payments or withdrawal flows are implemented.</p>
        </div>

        <div class="profile-summary__footer">
          <app-balance-badge [balance]="balance" />
          <span class="pill">Play money only</span>
        </div>
      </div>
    </app-card>
  `,
  styles: [`
    .profile-summary {
      display: grid;
      gap: 1.1rem;
    }

    .profile-summary__footer {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      align-items: center;
    }
  `]
})
export class ProfileSummaryComponent {
  @Input() email = '';
  @Input() balance = 0;
}
