import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      {
        name: 'admin-route-document',
        writeBundle(options) {
          if (!options.dir) {
            throw new Error('Could not emit the admin route without a build output directory.');
          }
          const indexPath = resolve(options.dir, 'index.html');
          const adminDirectory = resolve(options.dir, 'adminX');
          mkdirSync(adminDirectory, { recursive: true });
          copyFileSync(indexPath, resolve(adminDirectory, 'index.html'));
        },
      },
    ],
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/bills': { target: 'http://localhost:3001', changeOrigin: true },
        '/budget': { target: 'http://localhost:3001', changeOrigin: true },
        '/transfers': { target: 'http://localhost:3001', changeOrigin: true },
        '/districts': { target: 'http://localhost:3001', changeOrigin: true },
        '/users': { target: 'http://localhost:3001', changeOrigin: true },
        '/search': { target: 'http://localhost:3001', changeOrigin: true },
        '/adminX/api': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
  };
});
