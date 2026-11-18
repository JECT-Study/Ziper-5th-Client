import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 10000,
    hookTimeout: 20000,
    restoreMocks: true,
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  plugins: [vanillaExtractPlugin(), tanstackStart(), nitro(), viteReact()],
});
