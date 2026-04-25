import { normalizeEmail } from './code';

export const htlstpEmailDomain = 'htlstp.at';
export const htlstpEmailErrorMessage =
  'Use your @htlstp.at email address without +tags.';

export const isAllowedHtlstpEmail = (email: string): boolean => {
  const normalized = normalizeEmail(email);

  if (!normalized.endsWith(`@${htlstpEmailDomain}`)) {
    return false;
  }

  const [localPart, domain] = normalized.split('@');

  if (!localPart || domain !== htlstpEmailDomain) {
    return false;
  }

  if (localPart.includes('+')) {
    return false;
  }

  return /^[a-z0-9][a-z0-9._-]*$/i.test(localPart);
};
