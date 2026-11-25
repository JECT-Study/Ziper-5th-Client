export function isShareURL(value: string): boolean {
  if (value.length > 4096 || /[\s\\]/u.test(value)) return false;
  if ([...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
    return false;
  const scheme = /^https?:\/\//i.exec(value)?.[0];
  if (!scheme) return false;
  // Check userinfo in the authority only; the React Native URL implementation can match @ in the path.
  const authority = value.slice(scheme.length).split(/[/?#]/, 1)[0];
  if (!authority || authority.includes('@')) return false;
  try {
    return Boolean(new URL(scheme.toLowerCase() + value.slice(scheme.length)).hostname);
  } catch {
    return false;
  }
}

export function isHttps(value: string) {
  return /^https:\/\//i.test(value);
}

export function standardPortURL(value: string) {
  if (!isShareURL(value)) return null;
  const url = new URL(value);
  return url.port ? null : url;
}

export function secureProductURL(value: string) {
  const url = standardPortURL(value);
  return url?.protocol === 'https:' ? url : null;
}

/** The host without trailing dots, and the path with unreserved characters decoded. */
export function normalizedLocation(url: URL) {
  const host = url.hostname.replace(/\.+$/, '');
  const path = url.pathname.replace(/%([\da-f]{2})/gi, (encoded, hex: string) => {
    const char = String.fromCharCode(Number.parseInt(hex, 16));
    return /^[\w.~-]$/.test(char) ? char : encoded;
  });
  return { host, path };
}
