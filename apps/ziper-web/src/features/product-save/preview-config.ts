import { lazy } from 'react';

const previewModes = [
  'auto',
  'manual',
  'unsupported',
  'offline',
  'auth',
  'duplicate',
  'failed',
  'unknown',
] as const;
export type PreviewMode = (typeof previewModes)[number];

export function parsePreviewMode(value: unknown): PreviewMode | undefined {
  return import.meta.env.DEV ? previewModes.find((mode) => mode === value) : undefined;
}

export const ProductSavePreview = import.meta.env.DEV ? lazy(() => import('./preview')) : null;
