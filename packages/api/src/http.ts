// 개발 서버는 vite 프록시로 CORS 를 피한다.
const BASE_URL = import.meta.env.DEV ? '' : 'https://api.ziper.cc';
const REQUEST_TIMEOUT_MS = 15_000;
const REISSUE_TIMEOUT_MS = 5_000;

/** RFC 7807 오류 응답 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
    public readonly detail?: string,
  ) {
    super(detail ?? `API ${status}`);
    this.name = 'ApiError';
  }
}

export class SessionRenewalError extends Error {
  constructor(cause: ApiError) {
    super('Session renewal failed', { cause });
    this.name = 'SessionRenewalError';
  }
}

export type ErrorType<_Error> = ApiError | SessionRenewalError | Error;

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.detail ? error.detail : fallback;
}

/** 서버가 거절해 아무것도 바뀌지 않았는지. 5xx·응답 유실은 반영됐을 수 있어 다시 보내지 않는다. */
export function isRejected(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status < 500;
}

// Access Token 은 메모리에만 두고, 새로고침하면 HttpOnly 쿠키로 재발급한다.
let accessToken: string | null = null;
// Refresh Token 은 쓰면 바뀌므로 동시에 401 을 받아도 재발급은 한 번만 보낸다.
let sessionRevision = 0;
let refreshing: { revision: number; result: Promise<boolean> } | null = null;
let checked = false;
let signedInUser: string | null = null;
const userChangeListeners = new Set<() => void>();

export const getAccessToken = () => accessToken;

export function userIdOf(token: string): string | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const sub = (JSON.parse(atob(payload)) as { sub?: unknown }).sub;
    return sub == null ? null : String(sub);
  } catch {
    return null;
  }
}

/** 다른 계정으로 로그인하면 이전 계정의 캐시를 지우도록 알린다. */
export function onUserChange(listener: () => void) {
  userChangeListeners.add(listener);
  return () => void userChangeListeners.delete(listener);
}

export function startSession(token: string | null) {
  sessionRevision += 1;
  accessToken = token;
  checked = true;
  const user = token && userIdOf(token);
  if (!user) return;
  if (signedInUser && signedInUser !== user) userChangeListeners.forEach((listener) => listener());
  signedInUser = user;
}

export async function ensureSession(): Promise<boolean> {
  if (accessToken) return true;
  if (checked) return false;
  return refreshAccessToken();
}

// 백엔드는 이 헤더가 있을 때만 Refresh Token 을 쿠키로 주고받는다.
const sessionPaths = /^\/api\/v1\/auth\/(reissue|logout|oauth\/|email\/(login|signup))/;
// 인증 API 의 401 은 세션 만료가 아니라 요청 거절이다(잘못된 비밀번호 등).
const authPaths = /^\/api\/v1\/auth\//;

function send(url: string, init: RequestInit, token: string | null) {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const session = sessionPaths.test(url);
  if (session) headers.set('X-Refresh-Token-Mode', 'cookie');
  return fetch(`${BASE_URL}${url}`, {
    ...init,
    headers,
    credentials: session ? 'include' : 'same-origin',
  });
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function problem(status: number, body: unknown) {
  const { code, detail } = (body ?? {}) as { code?: unknown; detail?: unknown };
  return new ApiError(
    status,
    typeof code === 'string' ? code : undefined,
    typeof detail === 'string' ? detail : undefined,
  );
}

function refreshAccessToken() {
  const revision = sessionRevision;
  if (refreshing?.revision === revision) return refreshing.result;
  const result = (async () => {
    const deadline = timeout(REISSUE_TIMEOUT_MS);
    try {
      const response = await send(
        '/api/v1/auth/reissue',
        { method: 'POST', signal: deadline.signal },
        null,
      );
      const body = await readBody(response);
      if (!response.ok) throw problem(response.status, body);
      if (revision !== sessionRevision) return false;
      const token = (body as { accessToken?: unknown } | null)?.accessToken;
      if (typeof token !== 'string' || !token.trim()) throw new Error('Invalid session response');
      accessToken = token;
      checked = true;
      return true;
    } catch (error) {
      if (revision !== sessionRevision) return false;
      // An explicit 401 ends this session, including requests still awaiting a response.
      if (error instanceof ApiError && error.status === 401) {
        startSession(null);
        return false;
      }
      accessToken = null;
      checked = false;
      throw error instanceof ApiError ? new SessionRenewalError(error) : error;
    } finally {
      deadline.clear();
    }
  })().finally(() => {
    if (refreshing?.revision === revision) refreshing = null;
  });
  refreshing = { revision, result };
  return result;
}

async function awaitRenewal(signal: AbortSignal) {
  let cancel!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    cancel = () => reject(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
  try {
    const renewed = await Promise.race([refreshAccessToken(), aborted]);
    return renewed ? accessToken : null;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

async function authorized(url: string, init: RequestInit): Promise<Response> {
  const revision = sessionRevision;
  const token = accessToken;
  const response = await send(url, init, token);
  if (response.status !== 401 || authPaths.test(url) || revision !== sessionRevision) {
    return response;
  }
  init.signal?.throwIfAborted();
  // A slower 401 can arrive after a parallel request already rotated the token.
  const latest = accessToken;
  const renewed =
    latest && latest !== token
      ? latest
      : await awaitRenewal(init.signal ?? new AbortController().signal);
  if (!renewed || revision !== sessionRevision) return response;
  const retried = await send(url, init, renewed);
  // A rejected renewal must not bounce the login screen back to the app.
  if (retried.status === 401 && revision === sessionRevision && accessToken === renewed) {
    startSession(null);
  }
  return retried;
}

function timeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

const isoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d*)?(?:[-+]\d{2}:?\d{2}|Z)?$/;

function handleDates(value: unknown): unknown {
  if (typeof value === 'string') return isoDate.test(value) ? new Date(value) : value;
  if (Array.isArray(value)) return value.map(handleDates);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, handleDates(item)]));
  }
  return value;
}

export const http = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
  const deadline = timeout(REQUEST_TIMEOUT_MS);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline.signal]) : deadline.signal;
  let response: Response;
  let body: unknown;
  try {
    response = await authorized(url, { ...init, signal });
    body = await readBody(response);
  } finally {
    deadline.clear();
  }
  if (!response.ok && response.status !== 304) throw problem(response.status, body);
  return { data: handleDates(body), status: response.status, headers: response.headers } as T;
};
