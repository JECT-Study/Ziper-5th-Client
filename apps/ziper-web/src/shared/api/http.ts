import { getAccessToken, setAccessToken } from './session';

// 개발 서버는 /api 를 백엔드로 넘겨(vite.config.ts 프록시) CORS 를 피한다. 배포 웹은 백엔드를 바로 부른다.
const BASE_URL = import.meta.env.DEV ? '' : 'https://api.ziper.cc';

/** 백엔드 오류 응답(RFC 7807): { status, code: "EMAIL_FLOW_INVALID", detail: "인증을 다시 시작해 주세요." } */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
    public readonly detail?: string,
  ) {
    super(detail ?? `API ${status}`);
  }
}

/** An HTTP failure from reissue, not from the requested resource. */
export class SessionRenewalError extends Error {
  constructor(cause: ApiError) {
    super('Session renewal failed', { cause });
    this.name = 'SessionRenewalError';
  }
}

/** 화면에 띄울 문구. 서버가 준 한국어 설명이 있으면 그걸, 없으면 fallback 을 쓴다. */
export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.detail ? error.detail : fallback;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  cache?: RequestCache;
  headers?: Record<string, string>;
  /** Access Token 을 붙인다. 만료(401)되면 한 번 재발급하고 다시 보낸다. */
  auth?: boolean;
  /** Pause a caller's network budget while waiting for the separately bounded cookie rotation. */
  onRefreshWait?: () => (() => void) | undefined;
  /**
   * 로그인·가입·재발급·로그아웃 요청. Refresh Token 을 본문 대신 HttpOnly 쿠키로 주고받는다.
   * 백엔드는 이 헤더가 있을 때만 쿠키를 쓰고, 허용된 Origin 인지도 함께 본다.
   */
  session?: boolean;
};

function send(
  path: string,
  { method = 'GET', body, session, signal, cache, headers: extraHeaders }: RequestOptions,
  accessToken?: string | null,
) {
  const headers = { ...extraHeaders };
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (session) headers['X-Refresh-Token-Mode'] = 'cookie';
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    signal,
    cache,
    body: multipart || body === undefined ? body : JSON.stringify(body),
    credentials: session ? 'include' : 'same-origin',
  });
}

export async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (response.ok) return data as T;
  const problem = (data ?? {}) as { code?: unknown; detail?: unknown };
  throw new ApiError(
    response.status,
    typeof problem.code === 'string' ? problem.code : undefined,
    typeof problem.detail === 'string' ? problem.detail : undefined,
  );
}

// Refresh Token 은 쓰면 바로 바뀌어서, 요청 여러 개가 동시에 401 을 받아도 재발급은 한 번만 보낸다.
let sessionRevision = 0;
let refreshing: { revision: number; result: Promise<boolean> } | null = null;
// 이번 페이지에서 쿠키로 세션을 확인해 봤는지. 로그아웃 상태로 화면을 옮길 때마다 재발급을 보내지 않으려고 둔다.
let checked = false;

function refreshAccessToken() {
  const revision = sessionRevision;
  if (refreshing?.revision === revision) return refreshing.result;
  const result = (async () => {
    // Bound the shared rotation independently, within the URL-check wait that can follow rules.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const result = await parseResponse<{ accessToken?: unknown } | undefined>(
        await send('/api/v1/auth/reissue', {
          method: 'POST',
          session: true,
          signal: controller.signal,
        }),
      );
      if (revision !== sessionRevision) return false;
      if (typeof result?.accessToken !== 'string' || !result.accessToken.trim()) {
        throw new Error('Invalid session response');
      }
      setAccessToken(result.accessToken);
      checked = true;
      return true;
    } catch (error) {
      if (revision !== sessionRevision) return false;
      // An explicit 401 ends this session, including requests still awaiting a response.
      if (error instanceof ApiError && error.status === 401) {
        startSession(null);
        return false;
      }
      setAccessToken(null);
      checked = false;
      throw error instanceof ApiError ? new SessionRenewalError(error) : error;
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    if (refreshing?.revision === revision) refreshing = null;
  });
  refreshing = { revision, result };
  return result;
}

/** 로그인되어 있는지. 메모리에 Access Token 이 없으면(새로고침 등) 쿠키로 한 번 재발급해 본다. */
export async function ensureSession(): Promise<boolean> {
  if (getAccessToken()) return true;
  if (checked) return false;
  return refreshAccessToken();
}

/** 로그인·가입 응답의 Access Token 을 세션으로 쓴다. null 이면 로그아웃 상태로 둔다. */
export function startSession(accessToken: string | null) {
  sessionRevision += 1;
  setAccessToken(accessToken);
  checked = true;
}

/**
 * API 요청. 실패하면 ApiError 를 던진다.
 * 재발급이 401 을 반환하면 원래 401 응답을 유지한다. 다른 재발급 HTTP 오류는 별도 유형으로 전파한다.
 */
export async function requestResponse(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  if (!options.auth) return send(path, options);

  const revision = sessionRevision;
  const token = getAccessToken();
  const response = await send(path, options, token);
  if (response.status !== 401 || revision !== sessionRevision) return response;

  const { signal } = options;
  signal?.throwIfAborted();
  const latest = getAccessToken();
  // A slower 401 can arrive after a parallel request already rotated the token.
  const renewed = latest && latest !== token ? latest : await awaitRenewal(options);
  if (!renewed || revision !== sessionRevision) return response;
  const retried = await send(path, options, renewed);
  // A rejected renewal must not bounce the login screen back to the app.
  if (retried.status === 401 && revision === sessionRevision && getAccessToken() === renewed) {
    startSession(null);
  }
  return retried;
}

async function awaitRenewal({ signal, onRefreshWait }: RequestOptions) {
  const refresh = refreshAccessToken();
  let renewed: boolean;
  if (!signal) renewed = await refresh;
  else {
    // A caller's deadline must not cancel token rotation shared with other requests.
    const resume = onRefreshWait?.();
    let cancel!: () => void;
    const aborted = new Promise<never>((_, reject) => {
      cancel = () => reject(signal.reason);
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    });
    try {
      renewed = await Promise.race([refresh, aborted]);
      signal.throwIfAborted();
    } finally {
      signal.removeEventListener('abort', cancel);
      resume?.();
    }
  }
  return renewed ? getAccessToken() : null;
}

export async function request<T = void>(path: string, options?: RequestOptions): Promise<T> {
  return parseResponse<T>(await requestResponse(path, options));
}
