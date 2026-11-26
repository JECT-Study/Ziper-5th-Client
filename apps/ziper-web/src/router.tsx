import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { createQueryClient } from './shared/query-client';

export function getRouter() {
  // 서버는 요청마다 getRouter 를 부르므로 캐시도 요청마다 새로 생긴다.
  const queryClient = createQueryClient();
  return createRouter({
    routeTree,
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
