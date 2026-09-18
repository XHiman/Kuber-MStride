import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/bills': { target: 'http://localhost:3001', changeOrigin: true },
      '/budget': { target: 'http://localhost:3001', changeOrigin: true },
      '/transfers': { target: 'http://localhost:3001', changeOrigin: true },
      '/districts': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
