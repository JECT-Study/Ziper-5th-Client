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
  /** Access Token 을 붙인다. 만료(401)되면 한 번 재발급하고 다시 보낸다. */
  auth?: boolean;
  /**
   * 로그인·가입·재발급·로그아웃 요청. Refresh Token 을 본문 대신 HttpOnly 쿠키로 주고받는다.
   * 백엔드는 이 헤더가 있을 때만 쿠키를 쓰고, 허용된 Origin 인지도 함께 본다.
   */
  session?: boolean;
};

function send(
  path: string,
  { method = 'GET', body, session, signal }: RequestOptions,
  accessToken?: string | null,
) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (session) headers['X-Refresh-Token-Mode'] = 'cookie';
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    signal,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: session ? 'include' : 'same-origin',
  });
}

async function parse<T>(response: Response): Promise<T> {
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
    try {
      const { accessToken } = await parse<{ accessToken: string }>(
        await send('/api/v1/auth/reissue', { method: 'POST', session: true }),
      );
      setAccessToken(accessToken);
      return true;
    } catch {
      setAccessToken(null);
      return false;
    } finally {
      checked = true;
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
export async function request<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!options.auth) return parse<T>(await send(path, options));

  const response = await send(path, options, getAccessToken());
  if (response.status !== 401) return parse<T>(response);

  options.signal?.throwIfAborted();
  const renewed = await refreshAccessToken();
  options.signal?.throwIfAborted();
  return parse<T>(renewed ? await send(path, options, getAccessToken()) : response);
}
