import { defineConfig } from 'vite-plus';

const ignores = [
  '**/.expo/**',
  '**/ios/**',
  '**/android/**',
  '**/dist/**',
  '**/.tanstack/**',
  '**/routeTree.gen.ts',
];

export default defineConfig({
  lint: { ignorePatterns: ignores },
  fmt: {
    semi: true,
    singleQuote: true,
    ignorePatterns: [...ignores, 'pnpm-lock.yaml'],
  },
});
