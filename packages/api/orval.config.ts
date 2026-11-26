import { defineConfig, type InputOptions } from 'orval';

const input: InputOptions = {
  target: './openapi.json',
  override: { transformer: './orval/transformer.js' },
};

export default defineConfig({
  ziper: {
    input,
    output: {
      target: './src/__generated__/index.ts',
      client: 'react-query',
      httpClient: 'fetch',
      mode: 'split',
      mock: { generators: [{ type: 'msw', delay: false }] },
      urlEncodeParameters: true,
      override: {
        enumGenerationType: 'union',
        mutator: { path: './src/http.ts', name: 'http' },
        operations: {
          getBoardProducts: { query: { useInfinite: true, useInfiniteQueryParam: 'cursor' } },
        },
        query: { usePrefetch: true, useSuspenseQuery: true },
        useDates: true,
      },
    },
    hooks: { afterAllFilesWrite: 'vp fmt' },
  },
});
