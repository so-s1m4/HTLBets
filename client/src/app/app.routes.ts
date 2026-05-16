import { Routes } from '@angular/router';

import { adminGuard, authGuard, guestOnlyGuard } from './core/guards/auth.guard';
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
    canActivate: [guestOnlyGuard],
    loadComponent: () =>
      import('./features/auth/pages/email-entry.page').then((module) => module.EmailEntryPageComponent)
  },
  {
    path: 'auth/password',
    data: { title: 'Enter Password' },
    canActivate: [guestOnlyGuard],
    loadComponent: () =>
      import('./features/auth/pages/password-entry.page').then((module) => module.PasswordEntryPageComponent)
  },
  {
    path: 'auth/verify',
    data: { title: 'Verify Code' },
    canActivate: [guestOnlyGuard],
    loadComponent: () =>
      import('./features/auth/pages/verify-code.page').then((module) => module.VerifyCodePageComponent)
  },
  {
    path: 'auth/set-password',
    data: { title: 'Set Password', allowWithoutPasswordSetup: true },
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/pages/set-password.page').then((module) => module.SetPasswordPageComponent)
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
        path: 'games/miner',
        data: { title: 'Miner' },
        loadComponent: () =>
          import('./features/games/pages/miner.page').then((module) => module.MinerPageComponent)
      },
      {
        path: 'games/crash',
        data: { title: 'Crash' },
        loadComponent: () =>
          import('./features/games/pages/crash.page').then((module) => module.CrashPageComponent)
      },
      {
        path: 'games/slots',
        data: { title: 'Slots' },
        loadComponent: () =>
          import('./features/games/pages/slots.page').then((module) => module.SlotsPageComponent)
      },
      {
        path: 'games/ochko',
        data: { title: 'Ochko' },
        loadComponent: () =>
          import('./features/games/pages/ochko.page').then((module) => module.OchkoPageComponent)
      },
      {
        path: 'games/mafia',
        data: { title: 'Mafia' },
        loadComponent: () =>
          import('./features/games/pages/mafia.page').then((module) => module.MafiaPageComponent)
      },
      {
        path: 'games/leaderboard',
        data: { title: 'Leaderboard' },
        loadComponent: () =>
          import('./features/games/pages/leaderboard.page').then((module) => module.LeaderboardPageComponent)
      },
      {
        path: 'profile',
        data: { title: 'Profile' },
        loadComponent: () =>
          import('./features/profile/pages/profile.page').then((module) => module.ProfilePageComponent)
      },
      {
        path: 'admin',
        data: { title: 'Admin' },
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/pages/admin.page').then((module) => module.AdminPageComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'lobby'
  }
];
