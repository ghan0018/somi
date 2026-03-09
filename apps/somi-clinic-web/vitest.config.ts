import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Forward VIEWPORT_WIDTH so the setup file can configure window.innerWidth
    // and matchMedia. Default is 1280 (desktop).
    env: {
      VIEWPORT_WIDTH: process.env.VIEWPORT_WIDTH || '1280',
    },
  },
});
