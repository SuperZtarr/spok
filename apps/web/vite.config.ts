import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// En Docker, le proxy pointe vers le service "api" du réseau Docker
// En local, il pointe vers localhost:3001
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001';

export default defineConfig({
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // Accepte les connexions de tous les hosts (0.0.0.0)
    port: 3000,
    strictPort: true, // Ne pas chercher un autre port si occupé
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    headers: {
      'Cache-Control': 'no-store',
    },
    watch: {
      // Polling nécessaire pour les volumes Docker sur Windows
      usePolling: true,
      interval: 1000,
    },
  },
});
