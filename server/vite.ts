/**
 * Entrega o cliente React: em desenvolvimento via Vite (com recarga automática);
 * em produção, os arquivos de dist/public com fallback de SPA.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import express, { type Express } from 'express';
import { env } from './env';

export async function configurarCliente(app: Express, servidor: Server): Promise<void> {
  if (env.producao) {
    const pasta = path.resolve(import.meta.dirname, 'public');
    if (!fs.existsSync(pasta)) throw new Error(`Build do cliente não encontrado em ${pasta}. Rode "npm run build".`);
    app.use(express.static(pasta, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(pasta, 'index.html'));
    });
    return;
  }
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
    server: { middlewareMode: true, hmr: { server: servidor } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
