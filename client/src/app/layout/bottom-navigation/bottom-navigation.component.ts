import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './bottom-navigation.component.html',
  styleUrl: './bottom-navigation.component.scss'
})
export class BottomNavigationComponent {
  private readonly auth = inject(AuthService);

  readonly items = computed(() => {
    const base = [
      { label: 'Lobby', route: '/lobby', icon: '⌂' },
      { label: 'Roulette', route: '/games/roulette', icon: '◎' },
      { label: 'Profile', route: '/profile', icon: '◌' }
    ];

    if (this.auth.currentUser()?.isAdmin) {
      return [...base.slice(0, 2), { label: 'Admin', route: '/admin', icon: '◈' }, base[2]];
    }

    return base;
  });

  constructor() {
    effect(() => {
      document.documentElement.style.setProperty('--nav-count', String(this.items().length));
    });
  }
}
