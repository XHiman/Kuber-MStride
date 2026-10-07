import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:3001';
  const apiPrefix = (env.VITE_API_PREFIX || '').replace(/\/+$/, '');
  const apiPaths = ['/bills', '/budget', '/transfers', '/districts', '/users', '/search', '/adminX/api'];
  const apiProxy = Object.fromEntries(apiPaths.map(path => [
    path,
    {
      target: apiTarget,
      changeOrigin: true,
      rewrite: (requestPath: string) => `${apiPrefix}${requestPath}`,
    },
  ]));

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
      proxy: apiProxy,
    },
  };
});
