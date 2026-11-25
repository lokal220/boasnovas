/**
 * Importar a lista do WhatsApp: analisar (prévia do que muda, sem gravar) e aplicar.
 * O texto é lido por shared/dominio/whatsapp/parser.ts (analisarTexto) com os membros do ministério.
 * - substituir: a escala de cada culto do texto fica exatamente como no texto;
 * - adicionar: só acrescenta quem não está (mensagem de disponibilidade).
 * Escalas importadas: status confirmado, origem importacao.
 */
import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import type {
  CultoImportadoDTO, PreviaCultoDTO, RefNomeDTO, ResultadoImportacaoDTO, ResultadoParserDTO, ResumoImportacaoDTO,
} from '@shared/api';
import { analisarTexto } from '@shared/dominio/whatsapp/parser';
import { cultos, escalas, membros, ministerioMembros } from '@shared/schema';
import type { Banco } from '../db';
import { invalido } from '../http';
import {
  buscarAgenda, buscarUnidade, compararEscalas, paraAgendaDTO,
  type LinhaAgenda, type LinhaCulto, type LinhaEscala, type LinhaMinisterio,
} from './consultas';
import { horaDaAgenda } from './cultos';
import { FUSO_PADRAO, compararCultos, ehDiaFixo, hojeNoFuso, idCulto, normalizar, partesData } from './dominio';
import { inserirMembro } from './membros';
import { registrar, type Ator } from './registros';

type Modo = 'substituir' | 'adicionar';

interface Contexto {
  resultado: ResultadoParserDTO;
  agenda: LinhaAgenda[];
  /** cultos existentes da unidade nas datas do texto */
  existentes: LinhaCulto[];
  /** escalas do ministério nesses cultos (com nome) */
  escalasPorCulto: Map<string, { e: LinhaEscala; nome: string }[]>;
}

async function ler(db: Banco, ministerio: LinhaMinisterio, texto: string, agora: Date): Promise<Contexto> {
  const [unidade, agenda, lista] = await Promise.all([
    buscarUnidade(db, ministerio.unidadeId),
    buscarAgenda(db, ministerio.unidadeId),
    db.select({ id: membros.id, nome: membros.nome, apelidos: membros.apelidos })
      .from(ministerioMembros)
      .innerJoin(membros, eq(membros.id, ministerioMembros.membroId))
      .where(eq(ministerioMembros.ministerioId, ministerio.id)),
  ]);
  const hoje = hojeNoFuso(unidade?.fusoHorario ?? FUSO_PADRAO, agora);
  const resultado = analisarTexto(texto, { membros: lista, anoPadrao: partesData(hoje).ano, hoje });
  const datas = resultado.cultos.map((c) => c.data).sort();
  let existentes: LinhaCulto[] = [];
  const escalasPorCulto = new Map<string, { e: LinhaEscala; nome: string }[]>();
  if (datas.length) {
    existentes = await db.select().from(cultos).where(and(
      eq(cultos.unidadeId, ministerio.unidadeId), gte(cultos.data, datas[0]!), lte(cultos.data, datas[datas.length - 1]!),
    ));
    const ids = existentes.map((c) => c.id);
    if (ids.length) {
      const linhas = await db.select({ e: escalas, nome: membros.nome }).from(escalas)
        .innerJoin(membros, eq(membros.id, escalas.membroId))
        .where(and(eq(escalas.ministerioId, ministerio.id), inArray(escalas.cultoId, ids)));
      for (const l of linhas) {
        const lista2 = escalasPorCulto.get(l.e.cultoId);
        if (lista2) lista2.push(l);
        else escalasPorCulto.set(l.e.cultoId, [l]);
      }
    }
  }
  return { resultado, agenda, existentes, escalasPorCulto };
}

/** Culto existente da mesma data e turno (o de id sem sufixo primeiro). */
function cultoExistente(existentes: LinhaCulto[], c: Pick<CultoImportadoDTO, 'data' | 'turno'>): LinhaCulto | null {
  const candidatos = existentes.filter((x) => x.data === c.data && x.turno === c.turno).sort((a, b) => a.id.length - b.id.length || (a.id < b.id ? -1 : 1));
  return candidatos[0] ?? null;
}

function chaveRef(ref: RefNomeDTO): string {
  return ref.novo ? `novo:${normalizar(ref.nome)}` : `id:${ref.membroId}`;
}

function nomesNovos(resultado: ResultadoParserDTO): string[] {
  const vistos = new Map<string, string>();
  const refs: RefNomeDTO[] = [];
  if (resultado.pessoa) refs.push(resultado.pessoa);
  for (const c of resultado.cultos) {
    if (c.lider) refs.push(c.lider);
    refs.push(...c.servos);
  }
  for (const r of refs) if (r.novo && !vistos.has(normalizar(r.nome))) vistos.set(normalizar(r.nome), r.nome);
  return [...vistos.values()];
}

function modoSugerido(resultado: ResultadoParserDTO): Modo {
  return resultado.tipo === 'disponibilidade' ? 'adicionar' : 'substituir';
}

/** Pessoas que contam na escala atual (nao_pode fica de fora). */
function ativosDaEscala(linhas: { e: LinhaEscala; nome: string }[]): { e: LinhaEscala; nome: string }[] {
  return linhas.filter((l) => l.e.status !== 'nao_pode').sort((a, b) => compararEscalas(a.e, b.e));
}

export async function analisarImportacao(db: Banco, a: { ministerio: LinhaMinisterio; texto: string; agora: Date }): Promise<ResultadoImportacaoDTO> {
  const { resultado, existentes, escalasPorCulto } = await ler(db, a.ministerio, a.texto, a.agora);
  const modo = modoSugerido(resultado);
  const previa: PreviaCultoDTO[] = [...resultado.cultos].sort(compararCultos).map((c) => {
    const existente = cultoExistente(existentes, c);
    const atuais = existente ? ativosDaEscala(escalasPorCulto.get(existente.id) ?? []) : [];
    const importados = [...(c.lider ? [c.lider] : []), ...c.servos];
    const chavesImportadas = new Set(importados.map(chaveRef));
    const chavesAtuais = new Set(atuais.map((l) => `id:${l.e.membroId}`));
    const liderAtual = atuais.find((l) => l.e.papel === 'lider');
    return {
      data: c.data,
      turno: c.turno,
      titulo: c.titulo,
      cultoId: existente?.id ?? null,
      existe: !!existente,
      adicionados: importados.filter((r) => !chavesAtuais.has(chaveRef(r))).map((r) => r.nome),
      removidos: modo === 'substituir' ? atuais.filter((l) => !chavesImportadas.has(`id:${l.e.membroId}`)).map((l) => l.nome) : [],
      mantidos: atuais.filter((l) => chavesImportadas.has(`id:${l.e.membroId}`)).map((l) => l.nome),
      lider: {
        antes: liderAtual?.nome ?? null,
        depois: modo === 'substituir' ? (c.lider?.nome ?? null) : (liderAtual?.nome ?? c.lider?.nome ?? null),
      },
    };
  });
  return { ...resultado, modoSugerido: modo, previa, nomesNovos: nomesNovos(resultado) };
}

export async function aplicarImportacao(db: Banco, a: { ministerio: LinhaMinisterio; texto: string; modo: Modo; criarMembros: string[]; agora: Date; ator: Ator }): Promise<ResumoImportacaoDTO> {
  const { resultado, agenda, existentes, escalasPorCulto } = await ler(db, a.ministerio, a.texto, a.agora);
  if (!resultado.cultos.length) throw invalido('Não encontrei nenhuma escala nesse texto. Confira se as datas estão como dd/mm.');
  const criar = new Set(a.criarMembros.map(normalizar));
  const agendaDTO = agenda.map(paraAgendaDTO);

  return db.transaction(async (tx) => {
    // 1. nomes novos: cria os autorizados; os outros ficam de fora (ignorados)
    const idsNovos = new Map<string, string>();
    const ignorados: string[] = [];
    let membrosCriados = 0;
    for (const nome of nomesNovos(resultado)) {
      if (criar.has(normalizar(nome))) {
        const m = await inserirMembro(tx, { nome, ministerioId: a.ministerio.id, papel: 'servo' }, a.agora);
        idsNovos.set(normalizar(nome), m.id);
        membrosCriados++;
      } else {
        ignorados.push(nome);
      }
    }
    const idDaRef = (ref: RefNomeDTO): string | null => (ref.novo ? idsNovos.get(normalizar(ref.nome)) ?? null : ref.membroId || null);

    // 2. cultos e escalas
    const usados = new Set(existentes.map((c) => c.id));
    const criadosAgora = new Set<string>();
    let cultosCriados = 0;
    let cultosAlterados = 0;
    for (const c of [...resultado.cultos].sort(compararCultos)) {
      let culto = cultoExistente(existentes, c);
      if (!culto) {
        const id = idCulto(a.ministerio.unidadeId, c.data, c.turno, usados);
        usados.add(id);
        const [criado] = await tx.insert(cultos).values({
          id, unidadeId: a.ministerio.unidadeId, data: c.data, turno: c.turno, hora: horaDaAgenda(agenda, c.data, c.turno),
          titulo: c.titulo, extra: !ehDiaFixo(c.data, agendaDTO), nota: '', criadoEm: a.agora,
        }).returning();
        if (!criado) continue;
        culto = criado;
        existentes.push(criado);
        criadosAgora.add(criado.id);
        cultosCriados++;
      }
      let mudou = false;
      if (c.titulo && c.titulo !== culto.titulo && (a.modo === 'substituir' || !culto.titulo)) {
        await tx.update(cultos).set({ titulo: c.titulo }).where(eq(cultos.id, culto.id));
        mudou = true;
      }

      // pessoas desejadas, na ordem do texto (líder primeiro), sem repetição
      const desejados: { membroId: string; papel: 'lider' | 'servo' }[] = [];
      const vistos = new Set<string>();
      const liderId = c.lider ? idDaRef(c.lider) : null;
      if (liderId) { desejados.push({ membroId: liderId, papel: 'lider' }); vistos.add(liderId); }
      for (const ref of c.servos) {
        const id = idDaRef(ref);
        if (id && !vistos.has(id)) { desejados.push({ membroId: id, papel: 'servo' }); vistos.add(id); }
      }

      const atuais = (escalasPorCulto.get(culto.id) ?? []).map((l) => l.e);
      const porMembro = new Map(atuais.map((e) => [e.membroId, e]));
      const temLider = atuais.some((e) => e.papel === 'lider' && e.status !== 'nao_pode');

      if (a.modo === 'substituir') {
        const manter = new Set(desejados.map((d) => d.membroId));
        const sair = atuais.filter((e) => !manter.has(e.membroId));
        if (sair.length) { await tx.delete(escalas).where(inArray(escalas.id, sair.map((e) => e.id))); mudou = true; }
        for (const [ordem, d] of desejados.entries()) {
          const atual = porMembro.get(d.membroId);
          if (!atual) {
            await tx.insert(escalas).values({
              id: randomUUID(), cultoId: culto.id, ministerioId: a.ministerio.id, membroId: d.membroId, papel: d.papel,
              status: 'confirmado', origem: 'importacao', ordem, criadoEm: a.agora, atualizadoEm: a.agora,
            });
            mudou = true;
          } else if (atual.papel !== d.papel || atual.ordem !== ordem || atual.status === 'nao_pode') {
            await tx.update(escalas).set({
              papel: d.papel, ordem, ...(atual.status === 'nao_pode' ? { status: 'confirmado' } : {}), atualizadoEm: a.agora,
            }).where(eq(escalas.id, atual.id));
            mudou = true;
          }
        }
      } else {
        let proxima = atuais.reduce((max, e) => Math.max(max, e.ordem), -1) + 1;
        for (const d of desejados) {
          const papel = d.papel === 'lider' && temLider ? 'servo' : d.papel;
          const atual = porMembro.get(d.membroId);
          if (!atual) {
            await tx.insert(escalas).values({
              id: randomUUID(), cultoId: culto.id, ministerioId: a.ministerio.id, membroId: d.membroId, papel,
              status: 'confirmado', origem: 'importacao', ordem: proxima++, criadoEm: a.agora, atualizadoEm: a.agora,
            });
            mudou = true;
          } else if (atual.status === 'nao_pode') {
            await tx.update(escalas).set({ status: 'confirmado', atualizadoEm: a.agora }).where(eq(escalas.id, atual.id));
            mudou = true;
          }
        }
      }
      if (mudou && !criadosAgora.has(culto.id)) cultosAlterados++;
    }

    await registrar(tx, {
      ator: a.ator, acao: 'importacao.aplicar', alvo: a.ministerio.id, ministerioId: a.ministerio.id, quando: a.agora,
      dados: { modo: a.modo, tipo: resultado.tipo, cultos: resultado.cultos.length, cultosCriados, cultosAlterados, membrosCriados, ignorados },
    });
    return { cultosCriados, cultosAlterados, membrosCriados, ignorados };
  });
}
