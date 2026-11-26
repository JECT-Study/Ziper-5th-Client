import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

export function withQuery(node: ReactNode, client = createTestQueryClient()) {
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}
