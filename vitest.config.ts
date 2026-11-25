import { defineConfig } from 'vitest/config';
import path from 'node:path';

const raiz = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(raiz, 'client/src'),
      '@shared': path.resolve(raiz, 'shared'),
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', pool: 'forks', testTimeout: 30000 },
});
