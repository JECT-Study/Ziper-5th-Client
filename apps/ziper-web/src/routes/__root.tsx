import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import '../styles/global.css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Ziper' },
      { name: 'description', content: 'Ziper 웹 스타터' },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
