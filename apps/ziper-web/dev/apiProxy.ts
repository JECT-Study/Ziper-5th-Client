import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';

const API = 'https://api.ziper.cc';

// 백엔드에 넘길 요청 헤더. 브라우저의 Origin(localhost 등)은 백엔드 허용 목록에 없어서 넘기지 않는다.
const FORWARD_HEADERS = [
  'content-type',
  'accept',
  'authorization',
  'user-agent',
  'if-none-match',
  'cookie',
  'x-refresh-token-mode',
];

// 쿠키 모드(로그인·재발급·로그아웃)는 백엔드가 Origin 을 허용 목록과 맞춰 본다. 배포 웹 주소로 대신 보낸다.
const SESSION_ORIGIN = 'https://app.ziper.cc';

// 백엔드 쿠키는 Secure 라서 http 주소(LAN IP, Android 에뮬레이터 10.0.2.2)에서는 브라우저가 저장하지 않는다.
// 개발 서버에서만 Secure 를 빼서 돌려준다.
const devCookie = (cookie: string) => cookie.replace(/;\s*Secure/gi, '');

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

/**
 * 개발 서버에서만 /api 요청을 백엔드로 넘긴다. 브라우저는 같은 주소로 보내므로 CORS 가 생기지 않는다.
 * nitro 가 요청을 먼저 가로채서 Vite 의 server.proxy 가 동작하지 않으므로 nitro 보다 앞에 둔다.
 */
export function apiDevProxy(mockTarget?: string): Plugin {
  const target = mockTarget ?? API;
  return {
    name: 'ziper:api-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        // The fixture probe must never leave the dev server in normal mode.
        if (!mockTarget && req.url?.split('?', 1)[0] === '/_jec23/ready') {
          res.statusCode = 404;
          res.end();
          return;
        }
        const headers = new Headers();
        for (const name of FORWARD_HEADERS) {
          const value = req.headers[name];
          if (typeof value === 'string') headers.set(name, value);
        }
        if (headers.has('x-refresh-token-mode')) headers.set('origin', SESSION_ORIGIN);
        const method = req.method ?? 'GET';
        try {
          const response = await fetch(`${target}/api${req.url}`, {
            method,
            headers,
            // A mock response must not redirect a request outside loopback.
            redirect: mockTarget ? 'error' : undefined,
            body: method === 'GET' || method === 'HEAD' ? undefined : await readBody(req),
          });
          res.statusCode = response.status;
          for (const name of ['content-type', 'etag', 'cache-control', 'retry-after']) {
            const value = response.headers.get(name);
            if (value) res.setHeader(name, value);
          }
          const cookies = response.headers.getSetCookie();
          if (cookies.length) res.setHeader('set-cookie', cookies.map(devCookie));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          res.statusCode = 502;
          res.end(String(error));
        }
      });
    },
  };
}
