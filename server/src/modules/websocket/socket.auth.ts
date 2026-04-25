import type { Socket } from 'socket.io';

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
    socket.data.user = verifyAccessToken(token);
    next();
  } catch {
    next(new Error('Socket authentication token is invalid or expired.'));
  }
};
