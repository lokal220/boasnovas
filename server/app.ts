/**
 * Monta o app Express (sem escutar porta) — usado pelo servidor e pelos testes (supertest).
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Banco } from './db';
import { env } from './env';
import { registrarRotas } from './rotas';

export interface ContextoApp {
  db: Banco;
  /** relógio injetável (testes); padrão: new Date() */
  agora?: () => Date;
}

/** Exige o cabeçalho `X-BN: 1` em requisições que alteram dados (proteção CSRF simples e eficaz). */
function protecaoCsrf(req: Request, res: Response, next: NextFunction): void {
  const alteraDados = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (alteraDados && req.get('x-bn') !== '1') {
    res.status(403).json({ erro: 'Requisição recusada.' });
    return;
  }
  next();
}

export function criarApp(ctx: ContextoApp): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: env.producao ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'self'", 'https://*.replit.com', 'https://*.replit.dev'],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use('/api', protecaoCsrf);

  app.get('/api/saude', (_req, res) => { res.json({ ok: true, versao: env.versao }); });
  registrarRotas(app, ctx);

  app.use('/api', (_req, res) => { res.status(404).json({ erro: 'Rota não encontrada.' }); });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(erro);
    if (res.headersSent) return;
    res.status(500).json({ erro: 'Não deu certo. Tente de novo em instantes.' });
  });
  return app;
}
