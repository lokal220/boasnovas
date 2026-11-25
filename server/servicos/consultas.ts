/**
 * Consultas de leitura e montagem dos DTOs (contrato em shared/api.ts).
 * Tudo em lote: cultos, escalas, vagas e membros são buscados de uma vez e montados em memória (sem N+1).
 */
import { and, asc, eq, gte, inArray, lte, ne, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  AcessoMinisterio, AgendaFixaDTO, CultoComEscalaDTO, CultoDTO, EscaladoDTO, IgrejaDTO, MembroLiderDTO,
  MembroResumo, MinisterioDTO, MinisterioLiderDTO, OrigemEscala, PapelEscala, PapelMinisterio, StatusEscala,
  StatusTroca, TrocaDTO, Turno, UnidadeComAgendaDTO, UnidadeDTO,
} from '@shared/api';
import {
  agendaFixa, cultos, escalas, membros, ministerioMembros, ministerios, trocas, unidades, vagas,
} from '@shared/schema';
import type { Banco } from '../db';
import { calcularCobertura, compararCultos, compararNomes, diaSemana, horaParaMinutos, vespera } from './dominio';
import { linkPessoal, linkPublico } from './tokens';

export type LinhaUnidade = typeof unidades.$inferSelect;
export type LinhaAgenda = typeof agendaFixa.$inferSelect;
export type LinhaMinisterio = typeof ministerios.$inferSelect;
export type LinhaMembro = typeof membros.$inferSelect;
export type LinhaCulto = typeof cultos.$inferSelect;
export type LinhaEscala = typeof escalas.$inferSelect;
export type LinhaTroca = typeof trocas.$inferSelect;

export const IGREJA: IgrejaDTO = { nome: 'Boas Novas Church', tagline: 'lugar de pessoas improváveis' };

/** Janela padrão das telas (página pública e painel): de hoje−30 a hoje+120 dias. */
export const DIAS_ANTES = 30;
export const DIAS_DEPOIS = 120;

// ───────────────────────── mapeamentos simples ─────────────────────────

export function paraUnidadeDTO(u: LinhaUnidade): UnidadeDTO {
  return { id: u.id, nome: u.nome, endereco: u.endereco, fusoHorario: u.fusoHorario };
}

export function paraAgendaDTO(a: LinhaAgenda): AgendaFixaDTO {
  return { id: a.id, diaSemana: a.diaSemana, hora: a.hora, turno: a.turno as Turno, rotulo: a.rotulo, ativo: a.ativo };
}

export function paraMinisterioDTO(m: LinhaMinisterio): MinisterioDTO {
  return {
    id: m.id, unidadeId: m.unidadeId, nome: m.nome, descricao: m.descricao, icone: m.icone,
    vagasPadrao: m.vagasPadrao, acesso: m.acesso as AcessoMinisterio, aviso: m.aviso, whatsappLider: m.whatsappLider,
    horarios: [...m.horarios], ativo: m.ativo,
  };
}

export function paraMinisterioLiderDTO(m: LinhaMinisterio, base: string): MinisterioLiderDTO {
  return { ...paraMinisterioDTO(m), tokenPublico: m.tokenPublico, linkPublico: linkPublico(base, m.tokenPublico) };
}

export function paraCultoDTO(c: LinhaCulto): CultoDTO {
  return {
    id: c.id, unidadeId: c.unidadeId, data: c.data, hora: c.hora, turno: c.turno as Turno,
    titulo: c.titulo, extra: c.extra, nota: c.nota, vespera: c.extra ? vespera(c.data) : null,
  };
}

export function paraEscaladoDTO(e: LinhaEscala, nome: string): EscaladoDTO {
  return {
    escalaId: e.id, membroId: e.membroId, nome, papel: e.papel as PapelEscala, funcao: e.funcao,
    status: e.status as StatusEscala, origem: e.origem as OrigemEscala, checkinEm: e.checkinEm ? e.checkinEm.toISOString() : null,
  };
}

/** Ordem canônica dos escalados: líder do culto primeiro, depois a ordem da lista. */
export function compararEscalas(a: Pick<LinhaEscala, 'papel' | 'ordem' | 'criadoEm' | 'id'>, b: Pick<LinhaEscala, 'papel' | 'ordem' | 'criadoEm' | 'id'>): number {
  const pa = a.papel === 'lider' ? 0 : 1;
  const pb = b.papel === 'lider' ? 0 : 1;
  if (pa !== pb) return pa - pb;
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  const t = a.criadoEm.getTime() - b.criadoEm.getTime();
  if (t !== 0) return t;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Ministérios ativos primeiro, depois por nome. */
export function compararNomesMinisterio(a: Pick<LinhaMinisterio, 'ativo' | 'nome'>, b: Pick<LinhaMinisterio, 'ativo' | 'nome'>): number {
  if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
  return compararNomes(a.nome, b.nome);
}

// ───────────────────────── buscas básicas ─────────────────────────

export async function buscarUnidade(db: Banco, id: string): Promise<LinhaUnidade | null> {
  const [u] = await db.select().from(unidades).where(eq(unidades.id, id)).limit(1);
  return u ?? null;
}

export async function buscarAgenda(db: Banco, unidadeId: string): Promise<LinhaAgenda[]> {
  const linhas = await db.select().from(agendaFixa).where(eq(agendaFixa.unidadeId, unidadeId));
  return ordenarAgenda(linhas);
}

export function ordenarAgenda<T extends Pick<LinhaAgenda, 'diaSemana' | 'hora' | 'id'>>(linhas: T[]): T[] {
  const minutos = (hora: string) => horaParaMinutos(hora) || 0;
  return [...linhas].sort((a, b) => a.diaSemana - b.diaSemana || minutos(a.hora) - minutos(b.hora) || a.id - b.id);
}

export async function buscarMinisterio(db: Banco, id: string): Promise<LinhaMinisterio | null> {
  const [m] = await db.select().from(ministerios).where(eq(ministerios.id, id)).limit(1);
  return m ?? null;
}

export async function buscarMinisterioPorToken(db: Banco, token: string): Promise<LinhaMinisterio | null> {
  const [m] = await db.select().from(ministerios).where(eq(ministerios.tokenPublico, token)).limit(1);
  return m ?? null;
}

export async function buscarMembroPorToken(db: Banco, token: string): Promise<LinhaMembro | null> {
  const [m] = await db.select().from(membros).where(eq(membros.tokenAcesso, token)).limit(1);
  return m ?? null;
}

export async function buscarCulto(db: Banco, id: string): Promise<LinhaCulto | null> {
  const [c] = await db.select().from(cultos).where(eq(cultos.id, id)).limit(1);
  return c ?? null;
}

export async function papelNoMinisterio(db: Banco, ministerioId: string, membroId: string): Promise<PapelMinisterio | null> {
  const [l] = await db.select({ papel: ministerioMembros.papel }).from(ministerioMembros)
    .where(and(eq(ministerioMembros.ministerioId, ministerioId), eq(ministerioMembros.membroId, membroId))).limit(1);
  return l ? (l.papel as PapelMinisterio) : null;
}

/** Membros ativos do ministério, ordenados por nome (para a página pública). */
export async function membrosResumo(db: Banco, ministerioId: string): Promise<MembroResumo[]> {
  const linhas = await db
    .select({ id: membros.id, nome: membros.nome, papel: ministerioMembros.papel })
    .from(ministerioMembros)
    .innerJoin(membros, eq(membros.id, ministerioMembros.membroId))
    .where(and(eq(ministerioMembros.ministerioId, ministerioId), eq(membros.ativo, true)));
  return linhas
    .map((l) => ({ id: l.id, nome: l.nome, papel: l.papel as PapelMinisterio }))
    .sort((a, b) => compararNomes(a.nome, b.nome));
}

export async function unidadesComAgenda(db: Banco, ids: string[] | null): Promise<UnidadeComAgendaDTO[]> {
  if (ids && !ids.length) return [];
  const lista = await db.select().from(unidades).where(ids ? inArray(unidades.id, ids) : undefined).orderBy(asc(unidades.nome));
  if (!lista.length) return [];
  const agenda = await db.select().from(agendaFixa).where(inArray(agendaFixa.unidadeId, lista.map((u) => u.id)));
  return lista.map((u) => ({
    ...paraUnidadeDTO(u),
    agenda: ordenarAgenda(agenda.filter((a) => a.unidadeId === u.id)).map(paraAgendaDTO),
  }));
}

// ───────────────────────── cultos com escala ─────────────────────────

/**
 * O ministério atende este culto? Sem horários definidos = todos os cultos da unidade.
 * Eventos extras sempre entram. Senão, precisa de um horário do ministério no mesmo dia da semana
 * e no mesmo turno (culto `unico` casa com qualquer turno daquele dia, e vice-versa).
 */
export function ministerioAtende(culto: Pick<LinhaCulto, 'data' | 'turno' | 'extra'>, ministerio: Pick<LinhaMinisterio, 'horarios'>, agenda: LinhaAgenda[]): boolean {
  if (!ministerio.horarios.length || culto.extra) return true;
  const dia = diaSemana(culto.data);
  const porId = new Map(agenda.map((a) => [a.id, a]));
  return ministerio.horarios.some((id) => {
    const h = porId.get(id);
    return !!h && h.diaSemana === dia && (h.turno === culto.turno || h.turno === 'unico' || culto.turno === 'unico');
  });
}

export interface FiltroCultos {
  de?: string;
  ate?: string;
  /** cultos específicos (não aplica o filtro de "o ministério atende") */
  cultoIds?: string[];
}

export function vagasDoCulto(ministerio: Pick<LinhaMinisterio, 'vagasPadrao'>, override: number | undefined): number {
  return override ?? ministerio.vagasPadrao;
}

export function montarCultoComEscala(culto: LinhaCulto, ministerio: LinhaMinisterio, linhas: { e: LinhaEscala; nome: string }[], override: number | undefined): CultoComEscalaDTO {
  const escalados = [...linhas].sort((a, b) => compararEscalas(a.e, b.e)).map((l) => paraEscaladoDTO(l.e, l.nome));
  const quantidade = vagasDoCulto(ministerio, override);
  return { ...paraCultoDTO(culto), ministerioId: ministerio.id, vagas: quantidade, escalados, cobertura: calcularCobertura(escalados, quantidade) };
}

/** Cultos de um ministério com a escala montada (3 consultas, qualquer período). */
export async function cultosComEscala(db: Banco, ministerio: LinhaMinisterio, agenda: LinhaAgenda[], filtro: FiltroCultos): Promise<CultoComEscalaDTO[]> {
  const condicoes: SQL[] = [eq(cultos.unidadeId, ministerio.unidadeId)];
  if (filtro.de) condicoes.push(gte(cultos.data, filtro.de));
  if (filtro.ate) condicoes.push(lte(cultos.data, filtro.ate));
  if (filtro.cultoIds) {
    if (!filtro.cultoIds.length) return [];
    condicoes.push(inArray(cultos.id, filtro.cultoIds));
  }
  const ondeCulto = and(...condicoes);
  const [listaCultos, listaEscalas, listaVagas] = await Promise.all([
    db.select().from(cultos).where(ondeCulto),
    db.select({ e: escalas, nome: membros.nome })
      .from(escalas)
      .innerJoin(cultos, eq(cultos.id, escalas.cultoId))
      .innerJoin(membros, eq(membros.id, escalas.membroId))
      .where(and(eq(escalas.ministerioId, ministerio.id), ondeCulto)),
    db.select({ cultoId: vagas.cultoId, quantidade: vagas.quantidade })
      .from(vagas)
      .innerJoin(cultos, eq(cultos.id, vagas.cultoId))
      .where(and(eq(vagas.ministerioId, ministerio.id), ondeCulto)),
  ]);
  const escalasPorCulto = new Map<string, { e: LinhaEscala; nome: string }[]>();
  for (const l of listaEscalas) {
    const lista = escalasPorCulto.get(l.e.cultoId);
    if (lista) lista.push(l);
    else escalasPorCulto.set(l.e.cultoId, [l]);
  }
  const vagasPorCulto = new Map(listaVagas.map((v) => [v.cultoId, v.quantidade]));
  return listaCultos
    .filter((c) => filtro.cultoIds || escalasPorCulto.has(c.id) || vagasPorCulto.has(c.id) || ministerioAtende(c, ministerio, agenda))
    .sort((a, b) => compararCultos(paraCultoDTO(a), paraCultoDTO(b)))
    .map((c) => montarCultoComEscala(c, ministerio, escalasPorCulto.get(c.id) ?? [], vagasPorCulto.get(c.id)));
}

/** Um culto com a escala do ministério (depois de uma alteração). */
export async function cultoComEscala(db: Banco, ministerio: LinhaMinisterio, cultoId: string): Promise<CultoComEscalaDTO> {
  const [dto] = await cultosComEscala(db, ministerio, [], { cultoIds: [cultoId] });
  if (!dto) throw new Error(`culto ${cultoId} sumiu`);
  return dto;
}

// ───────────────────────── trocas ─────────────────────────

const solicitante = alias(membros, 'solicitante');
const substituto = alias(membros, 'substituto');

export interface FiltroTrocas {
  ids?: string[];
  status?: StatusTroca;
  ministerioIds?: string[];
  solicitanteId?: string;
  /** só trocas de cultos a partir desta data */
  dataMinima?: string;
  /** só trocas de cultos até esta data */
  dataMaxima?: string;
}

export async function carregarTrocas(db: Banco, filtro: FiltroTrocas): Promise<TrocaDTO[]> {
  const condicoes: SQL[] = [];
  if (filtro.ids) {
    if (!filtro.ids.length) return [];
    condicoes.push(inArray(trocas.id, filtro.ids));
  }
  if (filtro.ministerioIds) {
    if (!filtro.ministerioIds.length) return [];
    condicoes.push(inArray(escalas.ministerioId, filtro.ministerioIds));
  }
  if (filtro.status) condicoes.push(eq(trocas.status, filtro.status));
  if (filtro.solicitanteId) condicoes.push(eq(trocas.solicitanteId, filtro.solicitanteId));
  if (filtro.dataMinima) condicoes.push(gte(cultos.data, filtro.dataMinima));
  if (filtro.dataMaxima) condicoes.push(lte(cultos.data, filtro.dataMaxima));
  const linhas = await db
    .select({
      t: trocas, c: cultos, ministerioId: ministerios.id, ministerioNome: ministerios.nome,
      solicitanteNome: solicitante.nome, substitutoId: substituto.id, substitutoNome: substituto.nome,
    })
    .from(trocas)
    .innerJoin(escalas, eq(escalas.id, trocas.escalaId))
    .innerJoin(cultos, eq(cultos.id, escalas.cultoId))
    .innerJoin(ministerios, eq(ministerios.id, escalas.ministerioId))
    .innerJoin(solicitante, eq(solicitante.id, trocas.solicitanteId))
    .leftJoin(substituto, eq(substituto.id, trocas.substitutoId))
    .where(condicoes.length ? and(...condicoes) : undefined);
  return linhas
    .sort((a, b) => compararCultos(paraCultoDTO(a.c), paraCultoDTO(b.c)) || a.t.criadoEm.getTime() - b.t.criadoEm.getTime())
    .map((l) => ({
      id: l.t.id,
      escalaId: l.t.escalaId,
      status: l.t.status as StatusTroca,
      mensagem: l.t.mensagem,
      criadoEm: l.t.criadoEm.toISOString(),
      resolvidoEm: l.t.resolvidoEm ? l.t.resolvidoEm.toISOString() : null,
      culto: paraCultoDTO(l.c),
      ministerio: { id: l.ministerioId, nome: l.ministerioNome },
      solicitante: { id: l.t.solicitanteId, nome: l.solicitanteNome },
      substituto: l.substitutoId && l.substitutoNome !== null ? { id: l.substitutoId, nome: l.substitutoNome } : null,
    }));
}

export async function trocaPorId(db: Banco, id: string): Promise<TrocaDTO> {
  const [t] = await carregarTrocas(db, { ids: [id] });
  if (!t) throw new Error(`troca ${id} sumiu`);
  return t;
}

// ───────────────────────── membros (visão do líder) ─────────────────────────

/** Membros do ministério com papel, link pessoal e estatísticas (2 consultas). */
export async function membrosLider(db: Banco, ministerioId: string, base: string, hoje: string, ids?: string[]): Promise<MembroLiderDTO[]> {
  if (ids && !ids.length) return [];
  const condicoesMembros: SQL[] = [eq(ministerioMembros.ministerioId, ministerioId)];
  if (ids) condicoesMembros.push(inArray(membros.id, ids));
  const condicoesEscalas: SQL[] = [eq(escalas.ministerioId, ministerioId), ne(escalas.status, 'nao_pode')];
  if (ids) condicoesEscalas.push(inArray(escalas.membroId, ids));
  const [linhas, estatisticas] = await Promise.all([
    db.select({ m: membros, papel: ministerioMembros.papel })
      .from(ministerioMembros)
      .innerJoin(membros, eq(membros.id, ministerioMembros.membroId))
      .where(and(...condicoesMembros)),
    db.select({
      membroId: escalas.membroId,
      total: sql<number>`(count(*))::int`,
      futuros: sql<number>`(count(*) filter (where ${cultos.data} >= ${hoje}))::int`,
      liderancas: sql<number>`(count(*) filter (where ${escalas.papel} = 'lider'))::int`,
      proxima: sql<string | null>`(min(${cultos.data}) filter (where ${cultos.data} >= ${hoje}))::text`,
      ultima: sql<string | null>`(max(${cultos.data}) filter (where ${cultos.data} < ${hoje}))::text`,
    })
      .from(escalas)
      .innerJoin(cultos, eq(cultos.id, escalas.cultoId))
      .where(and(...condicoesEscalas))
      .groupBy(escalas.membroId),
  ]);
  const porMembro = new Map(estatisticas.map((e) => [e.membroId, e]));
  return linhas
    .map(({ m, papel }) => {
      const e = porMembro.get(m.id);
      return {
        id: m.id, nome: m.nome, apelidos: [...m.apelidos], telefone: m.telefone, ativo: m.ativo,
        papel: papel as PapelMinisterio, tokenAcesso: m.tokenAcesso, linkPessoal: linkPessoal(base, m.tokenAcesso),
        estatisticas: {
          total: Number(e?.total ?? 0), futuros: Number(e?.futuros ?? 0), liderancas: Number(e?.liderancas ?? 0),
          proximaData: e?.proxima ?? null, ultimaData: e?.ultima ?? null,
        },
      };
    })
    .sort((a, b) => compararNomes(a.nome, b.nome));
}
