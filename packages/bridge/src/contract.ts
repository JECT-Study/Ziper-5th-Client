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
  navigation: WebNavigation;
  sheets: {
    actions(input: SheetInput, signal?: AbortSignal): Promise<SheetResult>;
    // Changes when the web route leaves, including while native support is still being negotiated.
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
