import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.ready()) {
    return auth.restoreSession().then(() => {
      if (auth.isAuthenticated()) {
        return true;
      }

      return router.createUrlTree(['/auth/email']);
    });
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/email']);
};

export const guestOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.ready()) {
    return auth.restoreSession().then(() => (auth.isAuthenticated() ? router.createUrlTree(['/lobby']) : true));
  }

  return auth.isAuthenticated() ? router.createUrlTree(['/lobby']) : true;
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const resolve = () => {
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth/email']);
    }

    return auth.currentUser()?.isAdmin ? true : router.createUrlTree(['/lobby']);
  };

  if (!auth.ready()) {
    return auth.restoreSession().then(resolve);
  }

  return resolve();
};
