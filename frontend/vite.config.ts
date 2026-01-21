import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    watch: {
      usePolling: true,
    },
    hmr: {
      host: process.env.VITE_HMR_HOST || 'localhost',
    },
    proxy: {
      '/graphql': {
        target: 'http://host.docker.internal:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
