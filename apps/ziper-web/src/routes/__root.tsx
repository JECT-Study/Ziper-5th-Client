import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { BridgeProvider } from '../bridge/provider';
import '../styles/global.css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
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
        <BridgeProvider>
          <Outlet />
        </BridgeProvider>
        <Scripts />
      </body>
    </html>
  );
}
