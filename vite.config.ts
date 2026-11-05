import { defineConfig } from 'vite-plus';

export default defineConfig({
  lint: {
    ignorePatterns: ['**/.expo/**', '**/ios/**', '**/android/**', '**/dist/**'],
  },
  fmt: {
    semi: true,
    singleQuote: true,
    ignorePatterns: ['**/.expo/**', '**/ios/**', '**/android/**', '**/dist/**', 'pnpm-lock.yaml'],
  },
});
