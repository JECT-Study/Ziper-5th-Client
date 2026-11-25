import { z } from 'zod';

export const providers = ['naver', 'kakao', 'apple'] as const;

export type Provider = (typeof providers)[number];

export const capability = {
  login: (provider: Provider) => `auth.${provider}.v1`,
  browser: 'auth.browser.v1',
  restore: 'auth.session.restore.v1',
  adopt: 'auth.session.adopt.v1',
  logout: 'auth.logout.v1',
  push: 'navigation.push.v1',
  replace: 'navigation.replace.v1',
  back: 'navigation.back.v1',
  history: 'navigation.history.v1',
  sheet: 'sheet.actions.v1',
  incomingShare: 'share.incoming.v1',
  external: 'external.open.v1',
  productExtraction: 'product.extract.v1',
} as const;

export function isInternalPath(path: unknown): path is string {
  if (
    typeof path !== 'string' ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\')
  )
    return false;
  if ([...path].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127))
    return false;
  try {
    return new URL(path, 'https://internal.invalid').origin === 'https://internal.invalid';
  } catch {
    return false;
  }
}

export const pathSchema = z
  .string()
  .max(4096)
  .refine(isInternalPath, 'Expected a service-relative path');

const idSchema = z.string().min(1).max(128);

export const errorSchema = z.object({
  code: z.enum(['UNSUPPORTED', 'PERMISSION_DENIED', 'AUTH_FAILED', 'INVALID_REQUEST', 'INTERNAL']),
  message: z.string().max(300).optional(),
});

export type NativeErrorCode = z.infer<typeof errorSchema>['code'];

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: NativeErrorCode; message?: string } };

export const resultSchema = <S extends z.ZodType>(value: S) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value }),
    z.object({ ok: z.literal(false), error: errorSchema }),
  ]);

export const infoSchema = z.object({
  protocolVersion: z.literal(1),
  appVersion: z.string().min(1).max(100),
  platform: z.enum(['ios', 'android']),
  methods: z.array(z.string().max(100)).max(100),
  capabilities: z.array(z.string().max(100)).max(100),
});

export type BridgeInfo = z.infer<typeof infoSchema>;

export const profileSchema = z.object({
  id: idSchema,
  displayName: z.string().max(100).nullable(),
  avatarUrl: z.url().max(2048).nullable().optional(),
});

export const sessionSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('signedIn'), profile: profileSchema }),
  z.object({ status: z.literal('signupRequired'), profile: profileSchema.nullable() }),
]);

export type Session = z.infer<typeof sessionSchema>;

export const loginSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('completed'), handoffCode: z.string().min(1).max(2048) }),
  z.object({ status: z.literal('cancelled') }),
]);

export type LoginResult = z.infer<typeof loginSchema>;

export const sheetInputSchema = z
  .object({
    title: z.string().max(200),
    operationId: idSchema,
    actions: z
      .array(
        z
          .object({
            id: idSchema,
            label: z.string().min(1).max(100),
            destructive: z.boolean().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine(
    (input) => new Set(input.actions.map((action) => action.id)).size === input.actions.length,
    'Duplicate action ids',
  );

export type SheetInput = z.infer<typeof sheetInputSchema>;

export const sheetResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('selected'), actionId: idSchema }),
  z.object({ status: z.literal('cancelled') }),
]);

export type SheetResult = z.infer<typeof sheetResultSchema>;

const authInput = z.object({ provider: z.enum(providers), transactionId: idSchema }).strict();

const restoreInput = z.object({ transactionId: idSchema }).strict();

const restoreOutput = z.object({ handoffCode: z.string().min(1).max(2048).nullable() });

const navigateInput = z.object({ path: pathSchema, operationId: idSchema }).strict();

const navigationOutput = z.object({ handled: z.boolean() });

const historyInput = z.object({ depth: z.number().int().min(0).max(10000) }).strict();

const adoptInput = z.object({ handoffCode: z.string().min(1).max(2048) }).strict();

const done = z.object({ done: z.literal(true) });

export const incomingShareEvent = 'ziper:incoming-share';

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

// Match the deployed URL-check registry; the observed Ably redirect is only a navigation alias.
export const ablyProductRedirectHost = 'mobile.a-bly.com';
const zigzagProductBase = 'https://zigzag.kr/catalog/products/';
const zigzagHosts = ['zigzag.kr', 'www.zigzag.kr', 's.zigzag.kr', 'store.zigzag.kr'];
const productRoutes = [
  {
    hosts: ['musinsa.com', 'www.musinsa.com', 'm.musinsa.com', 'store.musinsa.com'],
    path: /^\/(?:products|app\/goods)\/(\d+)(?:\/|$)/,
    canonical: 'https://www.musinsa.com/products/',
  },
  {
    hosts: ['a-bly.com', 'www.a-bly.com', 'm.a-bly.com', ablyProductRedirectHost],
    // Ably renders padded paths but publishes the unpadded retailer ID and canonical URL.
    path: /^\/goods\/0*([1-9]\d*|0)(?:\/|$)/,
    canonical: 'https://m.a-bly.com/goods/',
  },
  {
    hosts: zigzagHosts,
    path: /^\/catalog\/products\/(\d+)(?:\/|$)/,
    canonical: zigzagProductBase,
  },
];
const shortLinkShops = new Map([
  ['musinsa.onelink.me', 'www.musinsa.com'],
  ['applink.a-bly.com', 'm.a-bly.com'],
  ['s.zigzag.kr', 'zigzag.kr'],
]);

export function productShortLinkShop(value: string) {
  const url = secureProductURL(value);
  return url ? shortLinkShops.get(url.hostname) : undefined;
}

function standardPortURL(value: string) {
  if (!isShareURL(value)) return null;
  const url = new URL(value);
  return url.port ? null : url;
}

function secureProductURL(value: string) {
  const url = standardPortURL(value);
  return url?.protocol === 'https:' ? url : null;
}

// The affiliate landing page and the app-only URL identify a product but are not its web PDP.
function zigzagAlternateProduct(url: URL | null) {
  if (!url || !zigzagHosts.includes(url.hostname)) return null;
  const ids =
    url.pathname === '/bridges/creator-lounge/pdp'
      ? url.searchParams.getAll('product_id')
      : [/^\/app\/catalog\/products\/(\d+)\/?$/.exec(url.pathname)?.[1]];
  const id = ids[0];
  return ids.length === 1 && id && /^\d+$/.test(id) ? zigzagProductBase + id : null;
}

// Ably publishes this app-facing address as its first Open Graph URL.
export function ablyAppProductURL(url: URL) {
  if (!/^(?:www\.)?a-bly\.com\.?$/.test(url.hostname)) return null;
  // The storefront accepts encoded product digits, but not an encoded /app route.
  const id = /^\/app\/goods\/0*([1-9]\d*|0)\/?$/.exec(url.pathname.replace(/%3(\d)/g, '$1'))?.[1];
  return id ? `https://m.a-bly.com/goods/${id}` : null;
}

function alternateProduct(url: URL) {
  return ablyAppProductURL(url) ?? zigzagAlternateProduct(url);
}

function directProduct(url: URL) {
  const host = url.hostname.replace(/\.+$/, '');
  const path = url.pathname.replace(/%([\da-f]{2})/gi, (encoded, hex: string) => {
    const char = String.fromCharCode(Number.parseInt(hex, 16));
    return /^[\w.~-]$/.test(char) ? char : encoded;
  });
  const route = productRoutes.find(({ hosts }) => hosts.includes(host));
  const id = route?.path.exec(path)?.[1];
  return route && id ? route.canonical + id : null;
}

export function alternateProductExtractionURL(value: string) {
  const url = standardPortURL(value);
  if (!url) return null;
  // Let Ably redirect offer-bearing app links. Dropping the query changes the price;
  // copying it ourselves would send arbitrary parameters across hosts.
  if (url.search && ablyAppProductURL(url)) {
    // WKWebView can fail TLS on the trailing-dot spelling of the same DNS name.
    if (url.protocol === 'https:' && !url.hostname.endsWith('.')) return null;
    return `https://${url.hostname.replace(/\.$/, '')}${url.pathname}${url.search}${url.hash}`;
  }
  // Recognize legacy addresses without ever navigating to a non-HTTPS product page.
  if (url.protocol === 'http:' || url.hostname.endsWith('.') || url.pathname.includes('%')) {
    const direct = directProduct(url);
    if (direct && url.search) {
      const host = url.hostname.replace(/\.+$/, '');
      const pdp = new URL(direct);
      // Ably also serves /goods/{id} via redirects. Upgrade and decode the path
      // on the submitted host so the shop handles its offer query.
      if (host === pdp.hostname || pdp.hostname === 'm.a-bly.com')
        return `https://${host}${pdp.pathname}${url.search}`;
    }
    return direct ?? alternateProduct(url);
  }
  return alternateProduct(url);
}

export function ablyAirbridgeProductURL(value: string) {
  const url = secureProductURL(value);
  const id = url?.hostname === 'ably.airbridge.io' && /^\/goods\/(\d+)\/?$/.exec(url.pathname)?.[1];
  return id ? `https://m.a-bly.com/goods/${id}` : null;
}

export function zigzagAffiliateProductURL(value: string) {
  const url = secureProductURL(value);
  if (url?.hostname !== 'abr.ge' || url.pathname !== '/@zigzag/affiliate') return null;
  const links = url.searchParams.getAll('deeplink_url');
  if (links.length !== 1) return null;
  try {
    const link = new URL(links[0]!);
    if (
      link.protocol !== 'zigzag:' ||
      link.host !== 'open' ||
      link.username ||
      link.password ||
      link.pathname !== '/full_screen_simple_browser'
    )
      return null;
    const targets = link.searchParams.getAll('url');
    const ids = link.searchParams.getAll('product_id');
    const target = targets.length === 1 ? secureProductURL(targets[0]!) : null;
    const product =
      target?.pathname === '/bridges/creator-lounge/pdp' ? zigzagAlternateProduct(target) : null;
    return ids.length === 1 && product === zigzagProductBase + ids[0] ? product : null;
  } catch {
    return null;
  }
}

export function canonicalProductExtractionURL(value: string) {
  const url = standardPortURL(value);
  return url ? (directProduct(url) ?? alternateProduct(url)) : null;
}

// Only known product pages or short-link hosts may load in the extraction WebView.
export function isProductExtractionURL(value: string, allowShortLinks = false): boolean {
  return Boolean(
    canonicalProductExtractionURL(value) || (allowShortLinks && productShortLinkShop(value)),
  );
}

export function findSharedURL(text: string): string | null {
  if (text.length > 16384) return null;
  const plain = text.trim();
  const trimPunctuation = (url: string) => url.replace(/[)\]}>.,!?。！？，]+$/u, '');
  if (isShareURL(plain)) {
    // A bare paste can contain a trailing sentence mark. Preserve valid product queries and opaque short links.
    if (canonicalProductExtractionURL(plain)) return plain;
    const candidate = trimPunctuation(plain);
    return candidate !== plain && canonicalProductExtractionURL(candidate) ? candidate : plain;
  }

  let firstURL: string | null = null;
  let firstShortLink: string | null = null;
  const brackets: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const links = /“(https?:\/\/[^\s”<>]+)”|‘(https?:\/\/[^\s’<>]+)’|https?:\/\/[^\s<>"'`]+/giu;
  for (const match of text.matchAll(links)) {
    const [token, doubleQuoted, singleQuoted] = match;
    const before = text[match.index - 1];
    const after = text[match.index + token.length];
    const enclosed =
      (before === '<' && after === '>') ||
      ((before === '"' || before === "'" || before === '`') && before === after);
    // Inside paired delimiters the boundary is known: punctuation may select a different offer.
    const close = before && brackets[before];
    const bracketed = close ? token.replace(/[.,!?。！？，]+$/u, '') : '';
    const bounded =
      doubleQuoted ??
      singleQuoted ??
      (close && bracketed.endsWith(close) ? bracketed.slice(0, -1) : undefined);
    const keepToken = enclosed || (/[?#]/.test(token) && canonicalProductExtractionURL(token));
    const url = bounded ?? (keepToken ? token : trimPunctuation(token));
    if (!isShareURL(url)) continue;
    if (canonicalProductExtractionURL(url)) return url;
    if (productShortLinkShop(url)) firstShortLink ??= url;
    firstURL ??= url;
  }
  return firstShortLink ?? firstURL;
}

export const productExtractionTimeout = 8_000;
export const shortProductExtractionTimeout = 12_000;

export function productExtractionMaxDuration(url: string) {
  if (productShortLinkShop(url)) return shortProductExtractionTimeout;
  return canonicalProductExtractionURL(url)?.startsWith('https://m.a-bly.com/goods/')
    ? 12_000
    : productExtractionTimeout;
}

const selectors = z.array(z.string().min(1).max(200)).max(8);
const shopRule = z.object({
  hosts: z.array(z.string().max(100)).max(12),
  fields: z.object({ title: selectors, price: selectors, image: selectors }),
  imageHosts: z.array(z.string().max(100)).max(12),
  imageStrategy: z.enum(['SERVER_MIRROR', 'CLIENT_UPLOAD']),
});
export const productExtractionRules = z.object({ shops: z.array(shopRule).max(12) });
// The server allows 200 Unicode code points; an astral character occupies two UTF-16 units.
export const maxExtractedTitleUnits = 400;
export const productMetadata = z
  .object({
    url: z
      .string()
      .refine((value) => secureProductURL(value) !== null && isProductExtractionURL(value)),
    name: z.string().max(maxExtractedTitleUnits),
    price: z.number().int().min(0).max(1_000_000_000).nullable(),
    imageURL: z
      .string()
      .max(2048)
      .refine((value) => isShareURL(value) && /^https:\/\//i.test(value))
      .nullable(),
  })
  .strict();

const incomingShare = z.object({
  id: idSchema,
  url: z.string().refine(isShareURL).nullable(),
});
export type IncomingShare = z.infer<typeof incomingShare>;

export const methods = {
  getBridgeInfoV1: { input: z.undefined(), output: infoSchema },
  authLoginV1: { input: authInput, output: loginSchema },
  authOpenBrowserV1: { input: authInput, output: loginSchema },
  authGetWebSessionV1: { input: restoreInput, output: restoreOutput },
  authAdoptWebSessionV1: { input: adoptInput, output: done },
  authLogoutV1: { input: z.undefined(), output: done },
  navigationPushV1: { input: navigateInput, output: navigationOutput },
  navigationReplaceV1: { input: navigateInput, output: navigationOutput },
  navigationBackV1: { input: z.undefined(), output: navigationOutput },
  navigationSetWebHistoryV1: { input: historyInput, output: done },
  sheetActionsV1: { input: sheetInputSchema, output: sheetResultSchema },
  externalOpenV1: {
    input: z.object({ url: z.string().refine(isShareURL), operationId: idSchema }).strict(),
    output: done,
  },
  extractProductV1: {
    input: productExtractionRules
      .extend({
        url: z.string().refine((value) => isProductExtractionURL(value, true)),
      })
      .strict(),
    output: productMetadata.nullable(),
  },
  shareReadV1: { input: z.undefined(), output: incomingShare.nullable() },
  shareDismissV1: { input: z.object({ id: idSchema }).strict(), output: done },
};

export type Method = keyof typeof methods;

export type Input<M extends Method> = z.infer<(typeof methods)[M]['input']>;

export type Output<M extends Method> = z.infer<(typeof methods)[M]['output']>;

export const success = <T>(value: T): Result<T> => ({ ok: true, value });

export const failure = (code: NativeErrorCode): Result<never> => ({ ok: false, error: { code } });

export type BridgeErrorCode =
  | NativeErrorCode
  | 'BRIDGE_NOT_READY'
  | 'BRIDGE_CLOSED'
  | 'RESULT_UNKNOWN'
  | 'NATIVE_ERROR'
  | 'AUTH_NOT_CONFIGURED';

export class BridgeError extends Error {
  constructor(public readonly code: BridgeErrorCode) {
    super(code);
    this.name = 'BridgeError';
  }
}

export interface NativeAuthService {
  providers: readonly Provider[];
  login(input: Input<'authLoginV1'>): Promise<LoginResult>;
  openBrowser?(input: Input<'authOpenBrowserV1'>): Promise<LoginResult>;
  restore(input: Input<'authGetWebSessionV1'>): Promise<Output<'authGetWebSessionV1'>>;
  adopt(input: Input<'authAdoptWebSessionV1'>): Promise<void>;
  logout(): Promise<void>;
}

export interface SessionClient {
  createTransaction(): Promise<{ transactionId: string }>;
  exchange(input: { transactionId: string; handoffCode: string }): Promise<Session>;
  current(): Promise<Session | null>;
  nativeHandoff(): Promise<{ handoffCode: string }>;
  logout(): Promise<void>;
}

export interface WebAuthService {
  // Implement popup/redirect policy in the actual provider adapter, never in the transport.
  login(input: { provider: Provider }): Promise<Session | { status: 'cancelled' }>;
  session: SessionClient;
}

export interface WebNavigation {
  push(path: string): Promise<void>;
  replace(path: string): Promise<void>;
  back(): Promise<void>;
  depth(): number;
}

export interface WebServices {
  auth?: WebAuthService;
  openExternal?: (url: string) => Promise<void>;
  navigation: WebNavigation;
  sheets: {
    actions(input: SheetInput, signal?: AbortSignal): Promise<SheetResult>;
    // Changes on route exit so a delayed fallback can't open on the next page.
    getScope?(): number;
  };
}

export type RuntimeStatus = 'initializing' | 'web' | 'native' | 'unavailable' | 'closed';

export interface Runtime {
  readonly status: RuntimeStatus;
  initialize(): Promise<void>;
  supports(capability: string, method: Method): boolean;
  invoke<M extends Method>(
    method: M,
    input: Input<M>,
    options?: { signal?: AbortSignal; timeoutMs?: number },
  ): Promise<Output<M>>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}
