import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { onUserChange } from '@ziper/api/http';
import { useEffect } from 'react';
import { BridgeProvider, type BridgeProviderConfig } from '../bridge/provider';
import { Toaster } from '../components';
import { webAuth } from '../features/auth';
import { ShareEntry } from '../features/product-save/incoming-share';
import '../styles/global.css';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      // maximum-scale=1: iOS 는 16px 보다 작은 입력칸(디자인 14px)을 누르면 화면을 확대한다. 앱처럼 쓰는 화면이라 막는다.
      // iOS Safari 는 이 값이 있어도 손가락으로 벌리는 확대는 허용한다.
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
      },
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
  const { queryClient } = Route.useRouteContext();
  useEffect(() => onUserChange(() => queryClient.clear()), [queryClient]);

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
