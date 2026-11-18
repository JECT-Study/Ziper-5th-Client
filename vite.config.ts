import { defineConfig } from 'vite-plus';

const ignores = [
  '**/.expo/**',
  '**/.direnv/**',
  '**/ios/**',
  '**/android/**',
  '**/dist/**',
  '**/.tanstack/**',
  '**/.astro/**',
  '**/routeTree.gen.ts',
];

export default defineConfig({
  lint: { ignorePatterns: ignores },
  fmt: {
    semi: true,
    singleQuote: true,
    ignorePatterns: [...ignores, 'pnpm-lock.yaml', '.agents/**', '.github/**'],
  },
});
