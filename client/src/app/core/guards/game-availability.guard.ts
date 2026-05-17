import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import type { GameCatalogId } from '../services/game-catalog.service';
import { GameCatalogService } from '../services/game-catalog.service';

export const gameAvailabilityGuard: CanActivateFn = async (route) => {
  const gameId = route.data?.['gameId'] as GameCatalogId | undefined;

  if (!gameId) {
    return true;
  }

  const router = inject(Router);
  const gameCatalog = inject(GameCatalogService);

  try {
    const enabled = await gameCatalog.isEnabled(gameId);
    return enabled ? true : router.createUrlTree(['/lobby']);
  } catch {
    return true;
  }
};
