import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';

const API = 'https://api.ziper.cc';

// 백엔드에 넘길 요청 헤더. Origin 은 빼야 한다(백엔드는 Origin 이 붙으면 값과 상관없이 403 을 준다).
const FORWARD_HEADERS = ['content-type', 'accept', 'authorization', 'user-agent'];

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

/**
 * 개발 서버에서만 /api 요청을 백엔드로 넘긴다. 브라우저는 같은 주소로 보내므로 CORS 가 생기지 않는다.
 * nitro 가 요청을 먼저 가로채서 Vite 의 server.proxy 가 동작하지 않으므로 nitro 보다 앞에 둔다.
 */
export function apiDevProxy(): Plugin {
  return {
    name: 'ziper:api-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        const headers = new Headers();
        for (const name of FORWARD_HEADERS) {
          const value = req.headers[name];
          if (typeof value === 'string') headers.set(name, value);
        }
        const method = req.method ?? 'GET';
        try {
          const response = await fetch(`${API}/api${req.url}`, {
            method,
            headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : await readBody(req),
          });
          res.statusCode = response.status;
          const type = response.headers.get('content-type');
          if (type) res.setHeader('content-type', type);
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          res.statusCode = 502;
          res.end(String(error));
        }
      });
    },
  };
}
