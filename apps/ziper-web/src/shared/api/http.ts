import { clearTokens, loadTokens, saveTokens, type Tokens } from './tokens';

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
  /** Access Token 을 붙인다. 만료(401)되면 한 번 재발급하고 다시 보낸다. */
  auth?: boolean;
};

function send(path: string, { method = 'GET', body }: RequestOptions, accessToken?: string) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
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
let refreshing: Promise<string | null> | null = null;

function refreshAccessToken() {
  refreshing ??= (async () => {
    const refreshToken = loadTokens()?.refreshToken;
    if (!refreshToken) return null;
    try {
      const tokens = await parse<Tokens>(
        await send('/api/v1/auth/reissue', { method: 'POST', body: { refreshToken } }),
      );
      saveTokens(tokens);
      return tokens.accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * API 요청. 실패하면 ApiError 를 던진다.
 * auth 요청이 재발급까지 실패하면 토큰을 지우고 401 을 던진다. 로그인 화면으로 보낼지는 쓰는 쪽이 정한다.
 */
export async function request<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!options.auth) return parse<T>(await send(path, options));

  const response = await send(path, options, loadTokens()?.accessToken);
  if (response.status !== 401) return parse<T>(response);

  const renewed = await refreshAccessToken();
  if (!renewed) {
    clearTokens();
    return parse<T>(response);
  }
  return parse<T>(await send(path, options, renewed));
}
