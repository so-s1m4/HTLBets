import { env } from '../config/env';

export const isAdminEmail = (email: string): boolean => env.ADMIN_EMAILS.includes(email.trim().toLowerCase());
