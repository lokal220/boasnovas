import type { Express } from 'express';
import type { ContextoApp } from '../app';

/** Registra todas as rotas da API (ver contrato em shared/api.ts). */
export function registrarRotas(_app: Express, _ctx: ContextoApp): void {
  // implementado pelos módulos de rotas: publico, eu, auth, lider
}
