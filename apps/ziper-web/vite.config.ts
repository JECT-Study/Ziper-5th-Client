import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite-plus';
import { apiDevProxy } from './dev/apiProxy';

// 배포 웹은 api.ziper.cc 를 바로 부르므로 백엔드의 CORS 허용이 필요하다.

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
  // 개발용 /api 프록시는 nitro 보다 앞에 둬야 요청을 먼저 받는다.
  plugins: [apiDevProxy(), vanillaExtractPlugin(), tanstackStart(), nitro(), viteReact()],
});
