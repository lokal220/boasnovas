import type { Express } from 'express';
import type { ContextoApp } from '../app';
import { rotasAuth } from './auth';
import { rotasEu } from './eu';
import { rotasLider } from './lider';
import { rotasPublico } from './publico';

/** Registra todas as rotas da API (ver contrato em shared/api.ts). */
export function registrarRotas(app: Express, ctx: ContextoApp): void {
  app.use('/api/auth', rotasAuth(ctx));
  app.use('/api/publico', rotasPublico(ctx));
  app.use('/api/eu', rotasEu(ctx));
  app.use('/api/lider', rotasLider(ctx));
}
