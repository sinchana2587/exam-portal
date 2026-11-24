import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: Number(process.env.DEFAULT_APP_PORT || 3000),
      strictPort: true,
      allowedHosts: true as const,
      proxy: {
        '/api/converter': {
          target: 'http://127.0.0.1:5001',
          changeOrigin: true,
        },
        '/api/question-paper': {
          target: 'http://127.0.0.1:5001',
          changeOrigin: true,
        },
        '/api/student-list': {
          target: 'http://127.0.0.1:5001',
          changeOrigin: true,
        },
        '/api/smart-upload': {
          target: 'http://127.0.0.1:5001',
          changeOrigin: true,
        },
        '/api/templates': {
          target: 'http://127.0.0.1:5001',
          changeOrigin: true,
        },
        '/api/health': {
          target: 'http://127.0.0.1:5001',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
