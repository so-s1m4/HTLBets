import { describe, expect, it } from 'vitest';

import { HttpError } from '../../utils/http-error';
import { userService } from './user.service';

describe('UserService admin target guard', () => {
  it('allows admins to target themselves when self actions are enabled', () => {
    const actor = {
      id: 'admin-1',
      email: 'admin@example.com'
    };

    const user = {
      id: 'admin-1',
      email: 'admin@example.com',
      bannedAt: null
    };

    expect(() =>
      (userService as any).requireAdminActorAndTarget(actor, user, {
        allowSelf: true,
        allowAdminTarget: true
      })
    ).not.toThrow();
  });

  it('still blocks self targeting when self actions are disabled', () => {
    const actor = {
      id: 'admin-1',
      email: 'admin@example.com'
    };

    const user = {
      id: 'admin-1',
      email: 'admin@example.com',
      bannedAt: null
    };

    expect(() =>
      (userService as any).requireAdminActorAndTarget(actor, user, {
        allowSelf: false,
        allowAdminTarget: true
      })
    ).toThrow(HttpError);
  });
});
