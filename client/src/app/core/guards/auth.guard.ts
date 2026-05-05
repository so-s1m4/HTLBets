import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

const resolveProtectedTarget = (allowWithoutPasswordSetup: boolean) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/email']);
  }

  if (!allowWithoutPasswordSetup && auth.needsPasswordSetup()) {
    return router.createUrlTree(['/auth/set-password']);
  }

  return true;
};

export const authGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const allowWithoutPasswordSetup = Boolean(route.data?.['allowWithoutPasswordSetup']);

  if (!auth.ready()) {
    return auth.restoreSession().then(() => resolveProtectedTarget(allowWithoutPasswordSetup));
  }

  return resolveProtectedTarget(allowWithoutPasswordSetup);
};

export const guestOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const resolve = () => {
    if (!auth.isAuthenticated()) {
      return true;
    }

    return auth.needsPasswordSetup() ? router.createUrlTree(['/auth/set-password']) : router.createUrlTree(['/lobby']);
  };

  if (!auth.ready()) {
    return auth.restoreSession().then(resolve);
  }

  return resolve();
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const resolve = () => {
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth/email']);
    }

    if (auth.needsPasswordSetup()) {
      return router.createUrlTree(['/auth/set-password']);
    }

    return auth.currentUser()?.isAdmin ? true : router.createUrlTree(['/lobby']);
  };

  if (!auth.ready()) {
    return auth.restoreSession().then(resolve);
  }

  return resolve();
};
