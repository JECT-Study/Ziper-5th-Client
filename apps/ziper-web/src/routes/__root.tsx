import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { BridgeProvider, type BridgeProviderConfig } from '../bridge/provider';
import { Toaster } from '../components';
import { webAuth } from '../features/auth';
import { ShareEntry } from '../features/product-save/incoming-share';
import '../styles/global.css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Ziper' },
      { name: 'description', content: 'Ziper 웹 스타터' },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
      },
    ],
  }),
  component: RootComponent,
});

// BridgeProvider 는 config 가 바뀌면 브릿지를 다시 만들므로 모듈에 한 번만 둔다.
const bridgeConfig: BridgeProviderConfig = { auth: webAuth };

function RootComponent() {
  return (
    <html lang="ko">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="frame-src 'none'; object-src 'none'; base-uri 'none'"
        />
        <HeadContent />
      </head>
      <body>
        <BridgeProvider config={bridgeConfig}>
          <ShareEntry />
          <Outlet />
          <Toaster />
        </BridgeProvider>
        <Scripts />
      </body>
    </html>
  );
}
