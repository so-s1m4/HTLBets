import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { MobileShellComponent } from './layout/mobile-shell/mobile-shell.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'lobby'
  },
  {
    path: 'auth/email',
    data: { title: 'Sign In' },
    loadComponent: () =>
      import('./features/auth/pages/email-entry.page').then((module) => module.EmailEntryPageComponent)
  },
  {
    path: 'auth/verify',
    data: { title: 'Verify Code' },
    loadComponent: () =>
      import('./features/auth/pages/verify-code.page').then((module) => module.VerifyCodePageComponent)
  },
  {
    path: '',
    component: MobileShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'lobby',
        data: { title: 'Lobby' },
        loadComponent: () =>
          import('./features/lobby/pages/lobby.page').then((module) => module.LobbyPageComponent)
      },
      {
        path: 'games/roulette',
        data: { title: 'Roulette' },
        loadComponent: () =>
          import('./features/games/pages/roulette.page').then((module) => module.RoulettePageComponent)
      },
      {
        path: 'games/blackjack',
        data: { title: 'Blackjack' },
        loadComponent: () =>
          import('./features/games/pages/blackjack.page').then((module) => module.BlackjackPageComponent)
      },
      {
        path: 'games/poker',
        data: { title: 'Poker' },
        loadComponent: () =>
          import('./features/games/pages/poker.page').then((module) => module.PokerPageComponent)
      },
      {
        path: 'profile',
        data: { title: 'Profile' },
        loadComponent: () =>
          import('./features/profile/pages/profile.page').then((module) => module.ProfilePageComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'lobby'
  }
];
