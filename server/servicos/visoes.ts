/**
 * Telas montadas pelo servidor: escala pública (link do grupo), minha escala (link pessoal) e painel do líder.
 * Poucas consultas em lote; o resto é montado em memória.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import type {
  EscalaPublicaDTO, MinhaEscalaDTO, MinhaEscalaItemDTO, PainelDTO, PapelEscala, PapelMinisterio, StatusEscala, AcessoMinisterio,
} from '@shared/api';
import { agendaFixa, cultos, escalas, membros, ministerioMembros, ministerios, unidades } from '@shared/schema';
import type { Banco } from '../db';
import { checkinDTO } from './checkin';
import {
  DIAS_ANTES, DIAS_DEPOIS, IGREJA, buscarAgenda, buscarUnidade, carregarTrocas, compararEscalas, compararNomesMinisterio,
  cultosComEscala, membrosLider, membrosResumo, ordenarAgenda, paraCultoDTO, paraMinisterioDTO, paraMinisterioLiderDTO,
  paraUnidadeDTO, type LinhaAgenda, type LinhaCulto, type LinhaEscala, type LinhaMembro, type LinhaMinisterio, type LinhaUnidade,
} from './consultas';
import { FUSO_PADRAO, compararCultos, cultoJaPassou, hojeNoFuso, somarDias } from './dominio';
import { linkPublico } from './tokens';

async function unidadeObrigatoria(db: Banco, id: string): Promise<LinhaUnidade> {
  const u = await buscarUnidade(db, id);
  if (!u) throw new Error(`unidade ${id} não existe`);
  return u;
}

// ───────────────────────── link do grupo ─────────────────────────

export async function escalaPublica(db: Banco, ministerio: LinhaMinisterio, agora: Date): Promise<EscalaPublicaDTO> {
  const unidade = await unidadeObrigatoria(db, ministerio.unidadeId);
  const hoje = hojeNoFuso(unidade.fusoHorario, agora);
  const [agenda, lista, trocasAbertas] = await Promise.all([
    buscarAgenda(db, unidade.id),
    membrosResumo(db, ministerio.id),
    carregarTrocas(db, { status: 'aberta', ministerioIds: [ministerio.id], dataMinima: hoje }),
  ]);
  const listaCultos = await cultosComEscala(db, ministerio, agenda, { de: somarDias(hoje, -DIAS_ANTES), ate: somarDias(hoje, DIAS_DEPOIS) });
  return {
    igreja: IGREJA,
    unidade: paraUnidadeDTO(unidade),
    ministerio: paraMinisterioDTO(ministerio),
    hoje,
    membros: lista,
    cultos: listaCultos,
    trocasAbertas: trocasAbertas.filter((t) => !cultoJaPassou(t.culto, unidade.fusoHorario, agora)),
  };
}

// ───────────────────────── link pessoal ─────────────────────────

interface LinhaMinha { e: LinhaEscala; c: LinhaCulto; ministerioNome: string; ministerioUnidade: string }

/** Monta os itens de "minha escala" com equipe e check-in (1 consulta para todas as equipes). */
async function montarItens(db: Banco, linhas: LinhaMinha[], fusoDe: (unidadeId: string) => string, agora: Date): Promise<MinhaEscalaItemDTO[]> {
  if (!linhas.length) return [];
  const cultoIds = [...new Set(linhas.map((l) => l.c.id))];
  const equipes = await db
    .select({ e: escalas, nome: membros.nome })
    .from(escalas)
    .innerJoin(membros, eq(membros.id, escalas.membroId))
    .where(inArray(escalas.cultoId, cultoIds));
  const porChave = new Map<string, { e: LinhaEscala; nome: string }[]>();
  for (const l of equipes) {
    const chave = `${l.e.cultoId}|${l.e.ministerioId}`;
    const lista = porChave.get(chave);
    if (lista) lista.push(l);
    else porChave.set(chave, [l]);
  }
  return linhas.map(({ e, c, ministerioNome, ministerioUnidade }) => ({
    escalaId: e.id,
    culto: paraCultoDTO(c),
    ministerio: { id: e.ministerioId, nome: ministerioNome },
    papel: e.papel as PapelEscala,
    funcao: e.funcao,
    status: e.status as StatusEscala,
    equipe: (porChave.get(`${c.id}|${e.ministerioId}`) ?? [])
      .sort((a, b) => compararEscalas(a.e, b.e))
      .map((x) => ({ membroId: x.e.membroId, nome: x.nome, papel: x.e.papel as PapelEscala, status: x.e.status as StatusEscala })),
    checkin: checkinDTO(e, c, fusoDe(ministerioUnidade), agora),
  }));
}

async function linhasDoMembro(db: Banco, membroId: string, escalaId?: string): Promise<LinhaMinha[]> {
  return db
    .select({ e: escalas, c: cultos, ministerioNome: ministerios.nome, ministerioUnidade: ministerios.unidadeId })
    .from(escalas)
    .innerJoin(cultos, eq(cultos.id, escalas.cultoId))
    .innerJoin(ministerios, eq(ministerios.id, escalas.ministerioId))
    .where(escalaId ? and(eq(escalas.membroId, membroId), eq(escalas.id, escalaId)) : eq(escalas.membroId, membroId));
}

/** Fusos das unidades (para check-in e "hoje"); sem unidade conhecida, o fuso padrão. */
async function mapaDeFusos(db: Banco): Promise<{ fusoDe: (id: string) => string; unidades: LinhaUnidade[] }> {
  const lista = await db.select().from(unidades).orderBy(asc(unidades.nome));
  const mapa = new Map(lista.map((u) => [u.id, u.fusoHorario]));
  return { fusoDe: (id) => mapa.get(id) ?? FUSO_PADRAO, unidades: lista };
}

/** Um item de "minha escala" (resposta das ações do link pessoal). */
export async function minhaEscalaItem(db: Banco, membroId: string, escalaId: string, agora: Date): Promise<MinhaEscalaItemDTO> {
  const linhas = await linhasDoMembro(db, membroId, escalaId);
  const { fusoDe } = await mapaDeFusos(db);
  const [item] = await montarItens(db, linhas, fusoDe, agora);
  if (!item) throw new Error(`escala ${escalaId} sumiu`);
  return item;
}

export async function minhaEscala(db: Banco, membro: LinhaMembro, base: string, agora: Date): Promise<MinhaEscalaDTO> {
  const [vinculos, { fusoDe, unidades: listaUnidades }, minhas] = await Promise.all([
    db.select({ m: ministerios, papel: ministerioMembros.papel })
      .from(ministerioMembros)
      .innerJoin(ministerios, eq(ministerios.id, ministerioMembros.ministerioId))
      .where(eq(ministerioMembros.membroId, membro.id)),
    mapaDeFusos(db),
    linhasDoMembro(db, membro.id),
  ]);
  const meus = vinculos.filter((v) => v.m.ativo).sort((a, b) => compararNomesMinisterio(a.m, b.m));
  const unidadePrincipal = listaUnidades.find((u) => u.id === meus[0]?.m.unidadeId) ?? listaUnidades[0];
  if (!unidadePrincipal) throw new Error('nenhuma unidade cadastrada');
  const fuso = unidadePrincipal.fusoHorario;
  const hoje = hojeNoFuso(fuso, agora);

  const ordenarPorCulto = (a: LinhaMinha, b: LinhaMinha) => compararCultos(paraCultoDTO(a.c), paraCultoDTO(b.c));
  const proximasLinhas = minhas.filter((l) => l.c.data >= hoje).sort(ordenarPorCulto);
  const passadasTodas = minhas.filter((l) => l.c.data < hoje).sort((a, b) => ordenarPorCulto(b, a));
  const [proximas, passadas] = await Promise.all([
    montarItens(db, proximasLinhas, fusoDe, agora),
    montarItens(db, passadasTodas.slice(0, 12), fusoDe, agora),
  ]);

  // oportunidades: cultos futuros dos meus ministérios em que ainda não estou
  const agendaPorUnidade = new Map<string, LinhaAgenda[]>();
  const idsUnidades = [...new Set(meus.map((v) => v.m.unidadeId))];
  if (idsUnidades.length) {
    const agenda = await db.select().from(agendaFixa).where(inArray(agendaFixa.unidadeId, idsUnidades));
    for (const id of idsUnidades) agendaPorUnidade.set(id, ordenarAgenda(agenda.filter((a) => a.unidadeId === id)));
  }
  const jaEstou = new Set(minhas.map((l) => `${l.c.id}|${l.e.ministerioId}`));
  const porMinisterio = await Promise.all(meus.map((v) =>
    cultosComEscala(db, v.m, agendaPorUnidade.get(v.m.unidadeId) ?? [], { de: hoje, ate: somarDias(hoje, DIAS_DEPOIS) })));
  const oportunidades = porMinisterio.flat()
    .filter((c) => !jaEstou.has(`${c.id}|${c.ministerioId}`) && !cultoJaPassou(c, fusoDe(c.unidadeId), agora))
    .sort(compararCultos);

  const idsMinisterios = meus.map((v) => v.m.id);
  const [abertas, minhasTrocas] = await Promise.all([
    carregarTrocas(db, { status: 'aberta', ministerioIds: idsMinisterios, dataMinima: hoje }),
    carregarTrocas(db, { solicitanteId: membro.id, dataMinima: somarDias(hoje, -DIAS_ANTES) }),
  ]);
  const ocupado = new Set(minhas.filter((l) => l.e.status !== 'nao_pode').map((l) => `${l.c.id}|${l.e.ministerioId}`));
  const trocasParaMim = abertas.filter((t) => t.solicitante.id !== membro.id
    && !ocupado.has(`${t.culto.id}|${t.ministerio.id}`)
    && !cultoJaPassou(t.culto, fusoDe(t.culto.unidadeId), agora));

  const servidas = minhas.filter((l) => l.e.status !== 'nao_pode');
  const desde = servidas.reduce<string | null>((min, l) => (min === null || l.c.data < min ? l.c.data : min), null);

  return {
    igreja: IGREJA,
    unidade: paraUnidadeDTO(unidadePrincipal),
    hoje,
    membro: { id: membro.id, nome: membro.nome },
    ministerios: meus.map((v) => ({
      id: v.m.id, nome: v.m.nome, papel: v.papel as PapelMinisterio,
      linkPublico: linkPublico(base, v.m.tokenPublico), acesso: v.m.acesso as AcessoMinisterio,
    })),
    proximas,
    passadas,
    oportunidades,
    trocasParaMim,
    minhasTrocas: minhasTrocas.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0)),
    estatisticas: {
      servidos: servidas.filter((l) => l.c.data < hoje).length,
      proximos: servidas.filter((l) => l.c.data >= hoje).length,
      desde,
    },
  };
}

// ───────────────────────── painel do líder ─────────────────────────

export async function painel(db: Banco, ministerio: LinhaMinisterio, base: string, agora: Date, periodo: { de?: string; ate?: string }): Promise<PainelDTO> {
  const unidade = await unidadeObrigatoria(db, ministerio.unidadeId);
  const hoje = hojeNoFuso(unidade.fusoHorario, agora);
  const de = periodo.de ?? somarDias(hoje, -DIAS_ANTES);
  const ate = periodo.ate ?? somarDias(hoje, DIAS_DEPOIS);
  const agenda = await buscarAgenda(db, unidade.id);
  const [listaCultos, trocasAbertas, equipe] = await Promise.all([
    cultosComEscala(db, ministerio, agenda, { de, ate }),
    carregarTrocas(db, { status: 'aberta', ministerioIds: [ministerio.id], dataMinima: hoje }),
    membrosLider(db, ministerio.id, base, hoje),
  ]);
  const futuros = listaCultos.filter((c) => c.data >= hoje);
  return {
    ministerio: paraMinisterioLiderDTO(ministerio, base),
    unidade: paraUnidadeDTO(unidade),
    hoje,
    cultos: listaCultos,
    resumo: {
      cultosFuturos: futuros.length,
      vagasAbertas: futuros.reduce((s, c) => s + c.cobertura.faltam, 0),
      pendentes: futuros.reduce((s, c) => s + c.cobertura.pendentes, 0),
      trocasAbertas: trocasAbertas.length,
      semData: equipe.filter((m) => m.ativo && !m.estatisticas.proximaData).length,
    },
    trocasAbertas,
    membros: equipe,
  };
}
