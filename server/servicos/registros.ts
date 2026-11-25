/**
 * Histórico de alterações (tabela `registros`): quem fez o quê, inclusive ações anônimas
 * pelo link do grupo (guardadas com um hash do IP, nunca o IP).
 */
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { and, desc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';
import type { RegistroDTO } from '@shared/api';
import { membros, registros, usuarios } from '@shared/schema';
import type { Banco } from '../db';

/** 'usuario:<id>' | 'membro:<id>' | 'anonimo:<hash>' | 'sistema' */
export type Ator = string;

export const ATOR_SISTEMA: Ator = 'sistema';
export const atorUsuario = (id: string): Ator => `usuario:${id}`;
export const atorMembro = (id: string): Ator => `membro:${id}`;

export function atorAnonimo(req: Request): Ator {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'desconhecido';
  return `anonimo:${createHash('sha256').update(`boasnovas:${ip}`).digest('hex').slice(0, 16)}`;
}

export interface NovoRegistro {
  ator: Ator;
  acao: string;
  alvo?: string;
  ministerioId?: string | null;
  dados?: Record<string, unknown>;
  quando?: Date;
}

export async function registrar(db: Banco, r: NovoRegistro): Promise<void> {
  await db.insert(registros).values({
    ator: r.ator,
    acao: r.acao,
    alvo: r.alvo ?? '',
    ministerioId: r.ministerioId ?? null,
    dados: r.dados ?? {},
    ...(r.quando ? { quando: r.quando } : {}),
  });
}

export interface FiltroRegistros {
  /** ministério pedido (já autorizado) */
  ministerioId?: string;
  /** null = sem restrição (admin); lista = ministérios visíveis para o líder */
  ministeriosVisiveis: string[] | null;
  /** id do usuário que consulta: o líder também vê o que ele mesmo fez (ações gerais) */
  usuarioId: string;
  limite: number;
}

export async function listarRegistros(db: Banco, filtro: FiltroRegistros): Promise<RegistroDTO[]> {
  const condicoes: SQL[] = [];
  if (filtro.ministerioId) {
    condicoes.push(eq(registros.ministerioId, filtro.ministerioId));
  } else if (filtro.ministeriosVisiveis) {
    const visiveis = filtro.ministeriosVisiveis.length
      ? or(inArray(registros.ministerioId, filtro.ministeriosVisiveis), and(isNull(registros.ministerioId), eq(registros.ator, atorUsuario(filtro.usuarioId))))
      : and(isNull(registros.ministerioId), eq(registros.ator, atorUsuario(filtro.usuarioId)));
    if (visiveis) condicoes.push(visiveis);
  }
  const linhas = await db
    .select()
    .from(registros)
    .where(condicoes.length ? and(...condicoes) : undefined)
    .orderBy(desc(registros.quando), desc(registros.id))
    .limit(Math.max(1, Math.min(filtro.limite, 500)));

  const idsUsuarios = new Set<string>();
  const idsMembros = new Set<string>();
  for (const l of linhas) {
    const [tipo, id] = separarAtor(l.ator);
    if (tipo === 'usuario' && id) idsUsuarios.add(id);
    if (tipo === 'membro' && id) idsMembros.add(id);
  }
  const nomesUsuarios = new Map<string, string>();
  const nomesMembros = new Map<string, string>();
  if (idsUsuarios.size) {
    for (const u of await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(inArray(usuarios.id, [...idsUsuarios]))) nomesUsuarios.set(u.id, u.nome);
  }
  if (idsMembros.size) {
    for (const m of await db.select({ id: membros.id, nome: membros.nome }).from(membros).where(inArray(membros.id, [...idsMembros]))) nomesMembros.set(m.id, m.nome);
  }

  return linhas.map((l) => {
    const [tipo, id] = separarAtor(l.ator);
    let atorNome = 'Sistema';
    if (tipo === 'usuario') atorNome = nomesUsuarios.get(id) ?? 'Líder removido';
    else if (tipo === 'membro') atorNome = nomesMembros.get(id) ?? 'Pessoa removida';
    else if (tipo === 'anonimo') atorNome = 'Link do grupo';
    return {
      id: l.id,
      quando: l.quando.toISOString(),
      ator: l.ator,
      atorNome,
      acao: l.acao,
      alvo: l.alvo,
      dados: l.ministerioId ? { ...l.dados, ministerioId: l.ministerioId } : { ...l.dados },
    };
  });
}

function separarAtor(ator: string): [string, string] {
  const i = ator.indexOf(':');
  return i < 0 ? [ator, ''] : [ator.slice(0, i), ator.slice(i + 1)];
}
