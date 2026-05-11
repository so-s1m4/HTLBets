import { HttpError } from './http-error';

export const MAX_BALANCE = 10_000_000_000_000;
export const MAX_BALANCE_BIGINT = BigInt(MAX_BALANCE);

const ensureSafeInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value)) {
    throw new HttpError(400, `${label} must be a whole number within the supported range.`);
  }

  return value;
};

export const parseNonNegativeAmount = (value: unknown, label: string): number => {
  const amount = ensureSafeInteger(Number(value), label);

  if (amount < 0) {
    throw new HttpError(400, `${label} must be a non-negative whole number.`);
  }

  return amount;
};

export const parseBalanceAmount = (value: unknown): number => {
  const balance = parseNonNegativeAmount(value, 'Balance');

  if (balance > MAX_BALANCE) {
    throw new HttpError(400, `Balance must not exceed ${MAX_BALANCE.toLocaleString('en-US')}.`);
  }

  return balance;
};

export const toDbAmount = (value: number): bigint => BigInt(ensureSafeInteger(value, 'Amount'));

export const fromDbAmount = (value: bigint | number): number => {
  const amount = typeof value === 'bigint' ? Number(value) : value;

  if (!Number.isSafeInteger(amount)) {
    throw new Error(`Encountered an unsupported monetary value: ${String(value)}`);
  }

  return amount;
};
