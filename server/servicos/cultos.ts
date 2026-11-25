/**
 * Cultos: listar por período, criar (evento extra ou avulso), alterar, remover e gerar os cultos do mês
 * a partir da agenda fixa da unidade (SPEC §3: cria o que não existe; não cria escalas).
 */
import { and, asc, eq, gte, like, lte, or } from 'drizzle-orm';
import type { CultoDTO, CultoNovoReq, Turno } from '@shared/api';
import { cultos } from '@shared/schema';
import type { Banco } from '../db';
import { invalido } from '../http';
import { paraAgendaDTO, paraCultoDTO, type LinhaAgenda, type LinhaCulto } from './consultas';
import { compararCultos, datasDoMes, diaSemana, ehDiaFixo, idCulto, normalizarEvento } from './dominio';
import { registrar, type Ator } from './registros';

export async function listarCultos(db: Banco, unidadeId: string, de?: string, ate?: string): Promise<CultoDTO[]> {
  const linhas = await db.select().from(cultos).where(and(
    eq(cultos.unidadeId, unidadeId),
    de ? gte(cultos.data, de) : undefined,
    ate ? lte(cultos.data, ate) : undefined,
  )).orderBy(asc(cultos.data));
  return linhas.map(paraCultoDTO).sort(compararCultos);
}

/** Hora de costume para o culto: o horário da agenda no mesmo dia da semana e turno (ou '' se não houver). */
export function horaDaAgenda(agenda: LinhaAgenda[], data: string, turno: Turno): string {
  const dia = diaSemana(data);
  const mesmoDia = agenda.filter((a) => a.diaSemana === dia);
  const exato = mesmoDia.find((a) => a.turno === turno && a.ativo) ?? mesmoDia.find((a) => a.turno === turno);
  if (exato) return exato.hora;
  if (turno === 'unico' && mesmoDia.length === 1) return mesmoDia[0]!.hora;
  return '';
}

async function idsDoDia(db: Banco, unidadeId: string, data: string, turno: Turno): Promise<string[]> {
  const base = idCulto(unidadeId, data, turno);
  const linhas = await db.select({ id: cultos.id }).from(cultos).where(or(eq(cultos.id, base), like(cultos.id, `${base}-%`)));
  return linhas.map((l) => l.id);
}

export async function criarCulto(db: Banco, a: { req: CultoNovoReq; agenda: LinhaAgenda[]; agora: Date; ator: Ator }): Promise<CultoDTO> {
  const { req } = a;
  const valores = {
    unidadeId: req.unidadeId,
    data: req.data,
    turno: req.turno,
    hora: req.hora || horaDaAgenda(a.agenda, req.data, req.turno),
    titulo: normalizarEvento(req.titulo ?? ''),
    nota: req.nota ?? '',
    extra: req.extra ?? !ehDiaFixo(req.data, a.agenda.map(paraAgendaDTO)),
    criadoEm: a.agora,
  };
  // o id é derivado da data/turno; numa corrida rara de dois cadastros iguais, tenta o próximo sufixo
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const id = idCulto(req.unidadeId, req.data, req.turno, await idsDoDia(db, req.unidadeId, req.data, req.turno));
    const criado = await db.transaction(async (tx) => {
      const [linha] = await tx.insert(cultos).values({ id, ...valores }).onConflictDoNothing().returning();
      if (!linha) return null;
      await registrar(tx, { ator: a.ator, acao: 'culto.criar', alvo: id, quando: a.agora, dados: { unidadeId: req.unidadeId, data: req.data, turno: req.turno, titulo: valores.titulo, extra: valores.extra } });
      return linha;
    });
    if (criado) return paraCultoDTO(criado);
  }
  throw new Error('não foi possível gerar um id livre para o culto');
}

export async function atualizarCulto(db: Banco, a: { culto: LinhaCulto; patch: Partial<CultoNovoReq>; agenda: LinhaAgenda[]; agora: Date; ator: Ator }): Promise<CultoDTO> {
  const { culto, patch } = a;
  if (patch.unidadeId !== undefined && patch.unidadeId !== culto.unidadeId) throw invalido('Não dá para mudar a unidade de um culto.');
  const campos: Partial<LinhaCulto> = {};
  if (patch.data !== undefined) campos.data = patch.data;
  if (patch.turno !== undefined) campos.turno = patch.turno;
  if (patch.hora !== undefined) campos.hora = patch.hora;
  if (patch.titulo !== undefined) campos.titulo = normalizarEvento(patch.titulo);
  if (patch.nota !== undefined) campos.nota = patch.nota;
  if (patch.extra !== undefined) campos.extra = patch.extra;
  else if (patch.data !== undefined && patch.data !== culto.data) campos.extra = !ehDiaFixo(patch.data, a.agenda.map(paraAgendaDTO));
  if (!Object.keys(campos).length) return paraCultoDTO(culto);
  const atualizado = await db.transaction(async (tx) => {
    const [linha] = await tx.update(cultos).set(campos).where(eq(cultos.id, culto.id)).returning();
    await registrar(tx, {
      ator: a.ator, acao: 'culto.alterar', alvo: culto.id, quando: a.agora,
      dados: { unidadeId: culto.unidadeId, antes: { data: culto.data, turno: culto.turno, hora: culto.hora, titulo: culto.titulo, extra: culto.extra, nota: culto.nota }, depois: campos },
    });
    return linha;
  });
  return paraCultoDTO(atualizado ?? culto);
}

export async function removerCulto(db: Banco, a: { culto: LinhaCulto; agora: Date; ator: Ator }): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(cultos).where(eq(cultos.id, a.culto.id)); // escalas, vagas e trocas saem em cascata
    await registrar(tx, {
      ator: a.ator, acao: 'culto.remover', alvo: a.culto.id, quando: a.agora,
      dados: { unidadeId: a.culto.unidadeId, data: a.culto.data, turno: a.culto.turno, titulo: a.culto.titulo },
    });
  });
}

/** Cria os cultos do mês para cada horário ativo da agenda fixa que ainda não tem culto (não cria escalas). */
export async function gerarCultosDoMes(db: Banco, a: { unidadeId: string; ano: number; mes: number; agenda: LinhaAgenda[]; agora: Date; ator: Ator }): Promise<{ criados: CultoDTO[]; existentes: number }> {
  const ocorrencias = datasDoMes(a.ano, a.mes, a.agenda.map(paraAgendaDTO));
  if (!ocorrencias.length) return { criados: [], existentes: 0 };
  const primeiro = ocorrencias[0]!.data;
  const ultimo = ocorrencias[ocorrencias.length - 1]!.data;
  return db.transaction(async (tx) => {
    const doMes = await tx.select().from(cultos).where(and(eq(cultos.unidadeId, a.unidadeId), gte(cultos.data, primeiro), lte(cultos.data, ultimo)));
    const usados = new Set((await tx.select({ id: cultos.id }).from(cultos).where(like(cultos.id, `${a.unidadeId}:${primeiro.slice(0, 8)}%`))).map((l) => l.id));
    // dois horários no mesmo dia e turno (raro) só se distinguem pela hora
    const repetidos = new Set<string>();
    const contagem = new Map<string, number>();
    for (const h of a.agenda.filter((x) => x.ativo)) {
      const chave = `${h.diaSemana}:${h.turno}`;
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
      if ((contagem.get(chave) ?? 0) > 1) repetidos.add(chave);
    }
    const novos: (typeof cultos.$inferInsert)[] = [];
    let existentes = 0;
    for (const o of ocorrencias) {
      const ambiguo = repetidos.has(`${diaSemana(o.data)}:${o.turno}`);
      const existe = doMes.some((c) => c.data === o.data && c.turno === o.turno && (!ambiguo || c.hora === o.hora))
        || novos.some((c) => c.data === o.data && c.turno === o.turno && (!ambiguo || c.hora === o.hora));
      if (existe) { existentes++; continue; }
      const id = idCulto(a.unidadeId, o.data, o.turno, usados);
      usados.add(id);
      novos.push({ id, unidadeId: a.unidadeId, data: o.data, hora: o.hora, turno: o.turno, titulo: '', extra: false, nota: '', criadoEm: a.agora });
    }
    const criados = novos.length ? await tx.insert(cultos).values(novos).onConflictDoNothing().returning() : [];
    existentes += novos.length - criados.length;
    if (criados.length) {
      await registrar(tx, {
        ator: a.ator, acao: 'cultos.gerar', alvo: `${a.unidadeId}:${a.ano}-${String(a.mes).padStart(2, '0')}`, quando: a.agora,
        dados: { unidadeId: a.unidadeId, ano: a.ano, mes: a.mes, criados: criados.length, existentes },
      });
    }
    return { criados: criados.map(paraCultoDTO).sort(compararCultos), existentes };
  });
}
