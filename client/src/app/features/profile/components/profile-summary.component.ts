import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import type { ProfileLeaderboardTag } from '../../../core/models/user.model';
import { AppCardComponent } from '../../../shared/ui/app-card.component';
import { AppBalanceBadgeComponent } from '../../../shared/ui/app-balance-badge.component';

@Component({
  selector: 'app-profile-summary',
  standalone: true,
  imports: [AppCardComponent, AppBalanceBadgeComponent],
  templateUrl: './profile-summary.component.html',
  styleUrl: './profile-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileSummaryComponent {
  @Input() email = '';
  @Input() username = '';
  @Input() avatarUrl: string | null = null;
  @Input() balance = 0;
  @Input() isAdmin = false;
  @Input() leaderboardTags: ProfileLeaderboardTag[] = [];

  initials(): string {
    const source = this.username.trim() || this.email.trim() || 'HB';
    return source
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
  }
}
