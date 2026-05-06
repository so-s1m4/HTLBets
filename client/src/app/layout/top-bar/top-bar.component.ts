import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { AppBalanceBadgeComponent } from '../../shared/ui/app-balance-badge.component';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, AppBalanceBadgeComponent],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopBarComponent {
  readonly auth = inject(AuthService);
}
