import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
  },
  plugins: [vanillaExtractPlugin(), tanstackStart(), viteReact()],
});
