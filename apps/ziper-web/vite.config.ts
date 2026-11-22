import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vite-plus';
import { apiDevProxy } from './dev/apiProxy';

// 배포 웹은 api.ziper.cc 를 바로 부르므로 백엔드의 CORS 허용이 필요하다.
const env = loadEnv('development', process.cwd(), '');
// Android 는 앱이 뒤로 가면(카카오 로그인 창 등) 네트워크를 끊고, Vite 는 다시 붙을 때 페이지를 새로고침한다.
// 그러면 진행 중이던 로그인이 사라지므로, Android 로 테스트할 때는 NO_HMR=1 로 연결 자체를 끈다(자동 반영도 꺼진다).
const ws = env.NO_HMR === '1' ? (false as const) : undefined;

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
    // localhost 가 ::1 로만 열리면 Android 에뮬레이터의 10.0.2.2(호스트 127.0.0.1)로 접속할 수 없다.
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    ws,
  },
  // 개발용 /api 프록시는 nitro 보다 앞에 둬야 요청을 먼저 받는다.
  plugins: [apiDevProxy(), vanillaExtractPlugin(), tanstackStart(), nitro(), viteReact()],
});
