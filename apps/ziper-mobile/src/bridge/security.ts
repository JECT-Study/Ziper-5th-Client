import { isInternalPath } from '@ziper/bridge/contract';

export type HostConfig = Readonly<{ origin: string; basePath: string }>;

export class HostConfigError extends Error {}

function cleanPath(path: string): boolean {
  if (!isInternalPath(path) || path.length > 4096) return false;
  let decoded = path.split(/[?#]/, 1)[0];
  // Reject ambiguous separators, traversal and nested escaping before URL normalization.
  for (let i = 0; i < 5; i++) {
    if (
      decoded.includes('\\') ||
      [...decoded].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127) ||
      decoded.split('/').some((part) => part === '.' || part === '..') ||
      decoded.startsWith('//')
    )
      return false;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return true;
      if (/%2f|%5c/i.test(decoded)) return false;
      decoded = next;
    } catch {
      return false;
    }
  }
  return false;
}

function localHost(host: string): boolean {
  if (host === 'localhost' || host === '[::1]') return true;
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255))
    return false;
  const [a, b] = parts.map(Number);
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function hostConfig(
  raw: string | undefined,
  development: boolean,
  platform: 'ios' | 'android',
): HostConfig {
  if (!raw && !development)
    throw new HostConfigError(
      'EXPO_PUBLIC_WEB_URL is required in production and must be an explicit HTTPS URL.',
    );
  const value = raw ?? (platform === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');
  try {
    if (!/^https?:\/\//.test(value) || /[\s\\]/.test(value)) throw new Error();
    const url = new URL(value);
    if (url.username || url.password || value.split('/')[2].includes('@') || url.search || url.hash)
      throw new Error();
    if (
      url.protocol !== 'https:' &&
      !(development && url.protocol === 'http:' && localHost(url.hostname))
    )
      throw new Error();
    const rawPath = value.slice(value.indexOf('://') + 3).replace(/^[^/]*/, '') || '/';
    if (!cleanPath(rawPath)) throw new Error();
    const basePath = url.pathname.replace(/\/+$/, '');
    return Object.freeze({ origin: url.origin, basePath });
  } catch {
    throw new HostConfigError(
      'Invalid EXPO_PUBLIC_WEB_URL: use HTTPS (development HTTP is limited to loopback/private LAN), without credentials, query, fragment or ambiguous paths.',
    );
  }
}

export function serviceURL(config: HostConfig, path: string): string | null {
  if (!cleanPath(path)) return null;
  const url = `${config.origin}${config.basePath}${path}`;
  return allowedDocument(config, url) ? url : null;
}

export function allowedDocument(config: HostConfig, value: unknown): boolean {
  if (typeof value !== 'string' || !/^https?:\/\//.test(value) || /[\s\\]/.test(value))
    return false;
  try {
    const url = new URL(value);
    const rawPath = value.slice(value.indexOf('://') + 3).replace(/^[^/?#]*/, '') || '/';
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    return (
      !url.username &&
      !url.password &&
      !value.split('/')[2].includes('@') &&
      url.origin === config.origin &&
      cleanPath(path) &&
      (!config.basePath ||
        url.pathname === config.basePath ||
        url.pathname.startsWith(`${config.basePath}/`))
    );
  } catch {
    return false;
  }
}
