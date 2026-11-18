import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import type { ViteUserConfig } from 'astro';
import { defineConfig } from 'astro/config';

// vanilla-extract 플러그인 타입이 Astro 쪽 Vite 타입과 어긋나서 맞춰 준다. 실행에는 영향 없음.
const plugins = [vanillaExtractPlugin()] as unknown as ViteUserConfig['plugins'];

export default defineConfig({
  server: { port: 4321 },
  vite: { plugins },
});
