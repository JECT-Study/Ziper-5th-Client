export function parseWholeWon(value: string): number | null {
  const amount = value.trim();
  if (amount.length > 13 || !/^(?:\d+|\d{1,3}(?:,\d{3})+)$/u.test(amount)) return null;
  const digits = amount.replaceAll(',', '');
  return digits.length <= 10 ? Number(digits) : null;
}
