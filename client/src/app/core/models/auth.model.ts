import type { User } from './user.model';

export interface ApiMessage {
  message: string;
}

export interface BeginAuthResponse {
  mode: 'password' | 'code';
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  requiresPasswordSetup: boolean;
}

export interface SetPasswordResponse {
  user: User;
}
