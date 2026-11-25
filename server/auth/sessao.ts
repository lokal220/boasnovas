/**
 * Sessões de login dos líderes: cookie httpOnly `bn_sessao` com um token aleatório;
 * no banco fica só o SHA-256 do token (tabela `sessoes`). Validade de 30 dias.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions } from 'express';
import { and, eq, gt, lte, ne } from 'drizzle-orm';
import { sessoes, usuarios } from '@shared/schema';
import type { Banco } from '../db';
import { env } from '../env';

export const COOKIE_SESSAO = 'bn_sessao';
export const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;

export type LinhaUsuario = typeof usuarios.$inferSelect;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function opcoesCookieSessao(): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: env.producao, path: '/', maxAge: DURACAO_SESSAO_MS };
}

export function opcoesLimparCookie(): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: env.producao, path: '/' };
}

/** Cria a sessão e devolve o token (vai só no cookie). Aproveita para limpar sessões vencidas do usuário. */
export async function criarSessao(db: Banco, usuarioId: string, agora: Date): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.delete(sessoes).where(and(eq(sessoes.usuarioId, usuarioId), lte(sessoes.expiraEm, agora)));
  await db.insert(sessoes).values({
    id: hashToken(token),
    usuarioId,
    criadoEm: agora,
    expiraEm: new Date(agora.getTime() + DURACAO_SESSAO_MS),
  });
  return token;
}

/** Usuário ativo dono da sessão válida, ou null. */
export async function usuarioDaSessao(db: Banco, token: string, agora: Date): Promise<LinhaUsuario | null> {
  if (!token || token.length > 200) return null;
  const linhas = await db
    .select({ usuario: usuarios })
    .from(sessoes)
    .innerJoin(usuarios, eq(usuarios.id, sessoes.usuarioId))
    .where(and(eq(sessoes.id, hashToken(token)), gt(sessoes.expiraEm, agora), eq(usuarios.ativo, true)))
    .limit(1);
  return linhas[0]?.usuario ?? null;
}

export async function encerrarSessao(db: Banco, token: string): Promise<void> {
  if (!token) return;
  await db.delete(sessoes).where(eq(sessoes.id, hashToken(token)));
}

/** Encerra todas as sessões do usuário (troca de senha, conta desativada), exceto a indicada. */
export async function encerrarSessoesDoUsuario(db: Banco, usuarioId: string, excetoToken?: string): Promise<void> {
  await db.delete(sessoes).where(excetoToken
    ? and(eq(sessoes.usuarioId, usuarioId), ne(sessoes.id, hashToken(excetoToken)))
    : eq(sessoes.usuarioId, usuarioId));
}
