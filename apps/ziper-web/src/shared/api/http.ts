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
let refreshing: Promise<boolean> | null = null;
// 이번 페이지에서 쿠키로 세션을 확인해 봤는지. 로그아웃 상태로 화면을 옮길 때마다 재발급을 보내지 않으려고 둔다.
let checked = false;

function refreshAccessToken() {
  refreshing ??= (async () => {
    // Bound the shared rotation independently, within the URL-check wait that can follow rules.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const { accessToken } = await parseResponse<{ accessToken: string }>(
        await send('/api/v1/auth/reissue', {
          method: 'POST',
          session: true,
          signal: controller.signal,
        }),
      );
      setAccessToken(accessToken);
      return true;
    } catch {
      setAccessToken(null);
      controller.signal.throwIfAborted(); // A timeout is not a confirmed sign-out.
      return false;
    } finally {
      clearTimeout(timer);
      checked = !controller.signal.aborted;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** 로그인되어 있는지. 메모리에 Access Token 이 없으면(새로고침 등) 쿠키로 한 번 재발급해 본다. */
export async function ensureSession(): Promise<boolean> {
  if (getAccessToken()) return true;
  if (checked) return false;
  return refreshAccessToken();
}

/** 로그인·가입 응답의 Access Token 을 세션으로 쓴다. null 이면 로그아웃 상태로 둔다. */
export function startSession(accessToken: string | null) {
  setAccessToken(accessToken);
  checked = true;
}

/**
 * API 요청. 실패하면 ApiError 를 던진다.
 * auth 요청이 재발급까지 실패하면 401 을 던진다. 로그인 화면으로 보낼지는 쓰는 쪽이 정한다.
 */
export async function requestResponse(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  if (!options.auth) return send(path, options);

  const response = await send(path, options, getAccessToken());
  if (response.status !== 401) return response;

  const { signal } = options;
  signal?.throwIfAborted();
  const refresh = refreshAccessToken();
  let renewed: boolean;
  if (!signal) renewed = await refresh;
  else {
    // A caller's deadline must not cancel token rotation shared with other requests.
    const resume = options.onRefreshWait?.();
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
  return renewed ? send(path, options, getAccessToken()) : response;
}

export async function request<T = void>(path: string, options?: RequestOptions): Promise<T> {
  return parseResponse<T>(await requestResponse(path, options));
}
