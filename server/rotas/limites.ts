/**
 * Limites de requisições (SPEC §5), criados por app (cada criarApp tem os seus contadores):
 * - login: 10 tentativas com erro a cada 15 min por IP (login certo não conta);
 * - rotas públicas e do link pessoal que alteram dados: 60 a cada 10 min por IP.
 * Fora de produção, requisições da própria máquina (testes, e2e) não são limitadas.
 */
import type { Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../env';

const LOCAIS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function semLimiteLocal(req: Request): boolean {
  return !env.producao && LOCAIS.has(req.ip ?? '');
}

export function limiteLogin(): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: semLimiteLocal,
    message: { erro: 'Muitas tentativas de entrar. Espere 15 minutos e tente de novo.' },
  });
}

export function limiteAlteracoes(): RequestHandler {
  const limitador = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: semLimiteLocal,
    message: { erro: 'Muitas alterações seguidas. Espere alguns minutos e tente de novo.' },
  });
  // só conta o que altera dados (as leituras da página não entram no limite)
  return async (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') { next(); return; }
    await limitador(req, res, next);
  };
}
