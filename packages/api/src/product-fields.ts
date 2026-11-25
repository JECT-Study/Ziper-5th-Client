/** Field rules the server enforces for a product card, shared by the save and edit forms. */
export const fallbackIcons = ['TOP', 'PANTS', 'SKIRT', 'ACCESSORY', 'BEAUTY'] as const;
export type FallbackIcon = (typeof fallbackIcons)[number];

export const seasonTags = ['봄', '여름', '가을', '겨울'] as const;

export const productLimits = {
  maxPrice: 1_000_000_000,
  // The server counts Unicode code points, not UTF-16 units.
  titleLength: 200,
  memoLength: 100,
  tagLength: 6,
  boardNameLength: 10,
} as const;

export const priceRangeMessage = '0원부터 10억원까지의 정수를 입력해 주세요.';
export const titleLengthMessage = '상품명은 200자까지 저장할 수 있어요. 줄여 주세요.';

export function codePointLength(value: string) {
  return [...value].length;
}

export function isValidTitle(value: string) {
  const length = codePointLength(value.trim());
  return length > 0 && length <= productLimits.titleLength;
}

export function normalizeTag(value: string) {
  return value.trim().replace(/^#+/, '').trim();
}

/** Parses "39000" or "39,000" as whole won within the server range; anything else is null. */
export function parseWholeWon(value: string): number | null {
  const amount = value.trim();
  if (amount.length > 13 || !/^(?:\d+|\d{1,3}(?:,\d{3})+)$/u.test(amount)) return null;
  const digits = amount.replaceAll(',', '');
  if (digits.length > 10) return null;
  const price = Number(digits);
  return price <= productLimits.maxPrice ? price : null;
}

export function isValidPrice(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= productLimits.maxPrice
  );
}
