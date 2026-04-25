export type TrustProxySetting = boolean | number | string | string[];

const truthyValues = new Set(['true', 'yes', 'on']);
const falsyValues = new Set(['false', 'no', 'off', '0']);

export const parseTrustProxy = (value?: string): TrustProxySetting => {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim();
  const lowerCasedValue = normalizedValue.toLowerCase();

  if (truthyValues.has(lowerCasedValue)) {
    return true;
  }

  if (falsyValues.has(lowerCasedValue)) {
    return false;
  }

  if (/^\d+$/.test(normalizedValue)) {
    return Number(normalizedValue);
  }

  if (normalizedValue.includes(',')) {
    return normalizedValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return normalizedValue;
};
