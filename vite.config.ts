import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const raiz = import.meta.dirname;

export default defineConfig({
  root: path.resolve(raiz, 'client'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(raiz, 'client/src'),
      '@shared': path.resolve(raiz, 'shared'),
    },
  },
  build: { outDir: path.resolve(raiz, 'dist/public'), emptyOutDir: true },
  server: { host: '0.0.0.0', allowedHosts: true },
});
