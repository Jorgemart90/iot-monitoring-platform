import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api/v1/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api/v1/devices': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/v1/analytics': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/v1/rules': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/api/v1/alerts': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/api/v1/notifications': {
        target: 'http://localhost:3004',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
