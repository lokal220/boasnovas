/**
 * Middlewares de autenticação/autorização das rotas do líder.
 * - exigirLogin: lê o cookie `bn_sessao`, carrega o usuário ativo (401 sem sessão válida).
 * - exigirAdmin: só administradores (403).
 * Regra de acesso: líder só nos ministérios dele (`usuarios.ministerios`); admin em tudo.
 */
import type { Request, RequestHandler } from 'express';
import type { UsuarioDTO, PapelUsuario } from '@shared/api';
import type { ContextoApp } from '../app';
import { agoraDe, ErroHttp } from '../http';
import { COOKIE_SESSAO, usuarioDaSessao, type LinhaUsuario } from './sessao';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** usuário logado (preenchido por exigirLogin) */
      usuario?: LinhaUsuario;
      /** token do cookie de sessão (preenchido por exigirLogin) */
      tokenSessao?: string;
    }
  }
}

export function lerTokenSessao(req: Request): string {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const valor = cookies?.[COOKIE_SESSAO];
  return typeof valor === 'string' ? valor : '';
}

export function exigirLogin(ctx: ContextoApp): RequestHandler {
  return async (req, _res, next) => {
    const token = lerTokenSessao(req);
    const usuario = token ? await usuarioDaSessao(ctx.db, token, agoraDe(ctx)) : null;
    if (!usuario) throw new ErroHttp(401, 'Entre com seu login para continuar.');
    req.usuario = usuario;
    req.tokenSessao = token;
    next();
  };
}

export const exigirAdmin: RequestHandler = (req, _res, next) => {
  if (req.usuario?.papel !== 'admin') throw new ErroHttp(403, 'Só o administrador pode fazer isso.');
  next();
};

/** Usuário logado da requisição (as rotas do líder passam antes por exigirLogin). */
export function usuarioLogado(req: Request): LinhaUsuario {
  if (!req.usuario) throw new ErroHttp(401, 'Entre com seu login para continuar.');
  return req.usuario;
}

export function ehAdmin(usuario: Pick<LinhaUsuario, 'papel'>): boolean {
  return usuario.papel === 'admin';
}

/** O usuário pode gerir este ministério? (admin: todos; líder: os da lista dele) */
export function podeGerir(usuario: Pick<LinhaUsuario, 'papel' | 'ministerios'>, ministerioId: string): boolean {
  return ehAdmin(usuario) || usuario.ministerios.includes(ministerioId);
}

export function paraUsuarioDTO(u: LinhaUsuario): UsuarioDTO {
  return {
    id: u.id,
    nome: u.nome,
    login: u.login,
    papel: u.papel as PapelUsuario,
    ministerios: [...u.ministerios],
    deveTrocarSenha: u.deveTrocarSenha,
    ativo: u.ativo,
  };
}
