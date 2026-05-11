import type { Socket } from 'socket.io';

import { prisma } from '../../prisma/client';
import { verifyAccessToken, type AccessTokenPayload } from '../../utils/jwt';

declare module 'socket.io' {
  interface SocketData {
    user: AccessTokenPayload;
  }
}

const getToken = (socket: Socket): string | null => {
  const authToken = socket.handshake.auth.token;

  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }

  const authorization = socket.handshake.headers.authorization;

  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }

  return null;
};

export const socketAuth = (socket: Socket, next: (error?: Error) => void): void => {
  const token = getToken(socket);

  if (!token) {
    next(new Error('Socket authentication token is missing.'));
    return;
  }

  try {
    const auth = verifyAccessToken(token);

    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, bannedAt: true }
    })
      .then((user) => {
        if (!user) {
          next(new Error('Socket authentication token is invalid or expired.'));
          return;
        }

        if (user.bannedAt) {
          next(new Error('This account has been suspended by an administrator.'));
          return;
        }

        socket.data.user = auth;
        next();
      })
      .catch((error) => next(error instanceof Error ? error : new Error('Socket authentication failed.')));
  } catch {
    next(new Error('Socket authentication token is invalid or expired.'));
  }
};
