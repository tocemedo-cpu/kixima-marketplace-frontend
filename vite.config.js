/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Para onde o servidor de desenvolvimento reencaminha a API e o tempo real. O backend Java corre por omissão
// em http://localhost:4001; API_PROXY_TARGET aponta o proxy a outro anfitrião/porta sem mexer no código.
// O proxy mantém a mesma origem (o cookie de sessão httpOnly funciona sem CORS em desenvolvimento).
const alvoApi = process.env.API_PROXY_TARGET || 'http://localhost:4001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target: alvoApi, changeOrigin: true },
      '/ws': { target: alvoApi, changeOrigin: true, ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas de terceiros em chunks próprios e cacheáveis: mudam raramente.
        manualChunks: { 'vendor-react': ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
});
