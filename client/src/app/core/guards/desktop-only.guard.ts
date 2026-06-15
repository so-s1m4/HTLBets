import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const desktopOnlyGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (typeof window === 'undefined') {
    return true;
  }

  const isPhone = Math.min(window.innerWidth, window.innerHeight) <= 600;
  return isPhone ? router.createUrlTree(['/lobby']) : true;
};
