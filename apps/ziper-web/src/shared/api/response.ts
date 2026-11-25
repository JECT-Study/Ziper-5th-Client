import { isShareURL } from '@ziper/bridge/contract';

export function invalidResponse(): never {
  throw new Error('Invalid API response');
}

export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalidResponse();
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : invalidResponse();
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value : invalidResponse();
}

export function wireId(value: unknown): number {
  // Never send a different ID after JS rounds it.
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) invalidResponse();
  return value;
}

export function id(value: unknown): string {
  return String(wireId(value));
}

export function idNumber(value: unknown): number {
  if (typeof value !== 'string') invalidResponse();
  const number = wireId(Number(value));
  return String(number) === value ? number : invalidResponse();
}

export function nullable<T>(read: (value: unknown) => T, value: unknown): T | null {
  return value === null ? null : read(value);
}

export function url(value: unknown): string {
  const string = text(value);
  return isShareURL(string) ? string : invalidResponse();
}
