import { lazy } from 'react';
const modes = [
  'normal',
  'unavailable',
  'purchased',
  'empty',
  'offline',
  'auth',
  'not-found',
  'failed',
  'unknown',
] as const;
export function parseDetailPreview(value: unknown) {
  return import.meta.env.DEV ? modes.find((mode) => mode === value) : undefined;
}
export const ProductDetailPreview = import.meta.env.DEV ? lazy(() => import('./preview')) : null;
