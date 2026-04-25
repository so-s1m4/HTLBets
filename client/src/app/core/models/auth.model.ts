import type { User } from './user.model';

export interface ApiMessage {
  message: string;
}

export interface VerifyCodeResponse {
  accessToken: string;
  user: User;
}
