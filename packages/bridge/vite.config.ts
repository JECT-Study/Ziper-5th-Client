import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 10000,
    hookTimeout: 20000,
    restoreMocks: true,
  },
});
