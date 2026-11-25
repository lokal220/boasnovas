/**
 * Ministérios (equipes) e unidades com a agenda fixa.
 * Líder só vê/edita os ministérios dele; criar ministério, mudar unidade/ativo e editar unidades é do admin.
 */
import { asc, eq, inArray } from 'drizzle-orm';
import type { MinisterioReq, UnidadeReq } from '@shared/api';
import { agendaFixa, ministerios, unidades } from '@shared/schema';
import type { Banco } from '../db';
import { ehAdmin } from '../auth/middleware';
import type { LinhaUsuario } from '../auth/sessao';
import { invalido, naoEncontrado, proibido } from '../http';
import { buscarAgenda, compararNomesMinisterio, type LinhaAgenda, type LinhaMinisterio, type LinhaUnidade } from './consultas';
import { idLivre, slugOuPadrao } from './dominio';
import { registrar, type Ator } from './registros';
import { gerarToken } from './tokens';

/** Ministérios que o usuário pode gerir (admin: todos), ativos primeiro e por nome. */
export async function ministeriosDoUsuario(db: Banco, usuario: Pick<LinhaUsuario, 'papel' | 'ministerios'>): Promise<LinhaMinisterio[]> {
  if (!ehAdmin(usuario) && !usuario.ministerios.length) return [];
  const linhas = await db.select().from(ministerios).where(ehAdmin(usuario) ? undefined : inArray(ministerios.id, usuario.ministerios));
  return linhas.sort(compararNomesMinisterio);
}

/**
 * Ministério pedido (com autorização) ou, sem pedido, o primeiro que o usuário gere.
 * 404 se não existir; 403 se for de outro líder.
 */
export async function ministerioDoUsuario(db: Banco, usuario: Pick<LinhaUsuario, 'papel' | 'ministerios'>, id?: string): Promise<LinhaMinisterio> {
  if (id) {
    const [m] = await db.select().from(ministerios).where(eq(ministerios.id, id)).limit(1);
    if (!m) throw naoEncontrado('Ministério não encontrado.');
    if (!ehAdmin(usuario) && !usuario.ministerios.includes(m.id)) throw proibido('Você não tem acesso a este ministério.');
    return m;
  }
  const [primeiro] = await ministeriosDoUsuario(db, usuario);
  if (!primeiro) throw naoEncontrado('Nenhum ministério ligado à sua conta ainda. Fale com o administrador.');
  return primeiro;
}

async function validarHorarios(db: Banco, unidadeId: string, horarios: number[] | undefined): Promise<number[] | undefined> {
  if (horarios === undefined) return undefined;
  const unicos = [...new Set(horarios)];
  if (!unicos.length) return [];
  const agenda = await buscarAgenda(db, unidadeId);
  const ids = new Set(agenda.map((a) => a.id));
  if (unicos.some((id) => !ids.has(id))) throw invalido('Algum horário escolhido não existe na agenda desta unidade.');
  return unicos;
}

async function unidadeOuPadrao(db: Banco, unidadeId: string | undefined): Promise<LinhaUnidade> {
  if (unidadeId) {
    const [u] = await db.select().from(unidades).where(eq(unidades.id, unidadeId)).limit(1);
    if (!u) throw invalido('Unidade não encontrada.');
    return u;
  }
  const [primeira] = await db.select().from(unidades).orderBy(asc(unidades.nome)).limit(1);
  if (!primeira) throw invalido('Cadastre uma unidade primeiro.');
  return primeira;
}

export async function criarMinisterio(db: Banco, a: { req: MinisterioReq; agora: Date; ator: Ator }): Promise<LinhaMinisterio> {
  const { req } = a;
  const unidade = await unidadeOuPadrao(db, req.unidadeId);
  const horarios = (await validarHorarios(db, unidade.id, req.horarios)) ?? [];
  return db.transaction(async (tx) => {
    const usados = new Set((await tx.select({ id: ministerios.id }).from(ministerios)).map((l) => l.id));
    const id = idLivre(slugOuPadrao(req.nome, 'ministerio'), usados);
    const [criado] = await tx.insert(ministerios).values({
      id, unidadeId: unidade.id, nome: req.nome, descricao: req.descricao ?? '', icone: req.icone || 'maos',
      vagasPadrao: req.vagasPadrao ?? 3, acesso: req.acesso ?? 'aberto', tokenPublico: gerarToken(), horarios,
      aviso: req.aviso ?? '', whatsappLider: req.whatsappLider ?? '', ativo: req.ativo ?? true, criadoEm: a.agora,
    }).returning();
    if (!criado) throw new Error('ministério não criado');
    await registrar(tx, { ator: a.ator, acao: 'ministerio.criar', alvo: id, ministerioId: id, quando: a.agora, dados: { nome: req.nome, unidadeId: unidade.id } });
    return criado;
  });
}

export async function atualizarMinisterio(db: Banco, a: { ministerio: LinhaMinisterio; patch: Partial<MinisterioReq>; admin: boolean; agora: Date; ator: Ator }): Promise<LinhaMinisterio> {
  const { ministerio: m, patch } = a;
  const mudaUnidade = patch.unidadeId !== undefined && patch.unidadeId !== m.unidadeId;
  const mudaAtivo = patch.ativo !== undefined && patch.ativo !== m.ativo;
  if (!a.admin && (mudaUnidade || mudaAtivo)) throw proibido('Só o administrador pode mudar a unidade ou desativar um ministério.');
  const unidadeId = mudaUnidade ? (await unidadeOuPadrao(db, patch.unidadeId)).id : m.unidadeId;
  const horarios = await validarHorarios(db, unidadeId, patch.horarios);
  const campos: Partial<LinhaMinisterio> = {};
  if (patch.nome !== undefined) campos.nome = patch.nome;
  if (patch.descricao !== undefined) campos.descricao = patch.descricao;
  if (patch.icone !== undefined) campos.icone = patch.icone || 'maos';
  if (patch.vagasPadrao !== undefined) campos.vagasPadrao = patch.vagasPadrao;
  if (patch.acesso !== undefined) campos.acesso = patch.acesso;
  if (patch.aviso !== undefined) campos.aviso = patch.aviso;
  if (patch.whatsappLider !== undefined) campos.whatsappLider = patch.whatsappLider;
  if (mudaAtivo) campos.ativo = patch.ativo;
  if (mudaUnidade) campos.unidadeId = unidadeId;
  if (horarios !== undefined) campos.horarios = horarios;
  else if (mudaUnidade) campos.horarios = []; // horários da unidade antiga não valem na nova
  if (!Object.keys(campos).length) return m;
  return db.transaction(async (tx) => {
    const [atualizado] = await tx.update(ministerios).set(campos).where(eq(ministerios.id, m.id)).returning();
    await registrar(tx, { ator: a.ator, acao: 'ministerio.alterar', alvo: m.id, ministerioId: m.id, quando: a.agora, dados: { campos: Object.keys(campos) } });
    return atualizado ?? m;
  });
}

export async function novoTokenMinisterio(db: Banco, a: { ministerio: LinhaMinisterio; agora: Date; ator: Ator }): Promise<LinhaMinisterio> {
  return db.transaction(async (tx) => {
    const [atualizado] = await tx.update(ministerios).set({ tokenPublico: gerarToken() }).where(eq(ministerios.id, a.ministerio.id)).returning();
    await registrar(tx, { ator: a.ator, acao: 'ministerio.novo_link', alvo: a.ministerio.id, ministerioId: a.ministerio.id, quando: a.agora, dados: {} });
    return atualizado ?? a.ministerio;
  });
}

type ItemAgendaReq = NonNullable<UnidadeReq['agenda']>[number];

/**
 * Atualiza nome/endereço e substitui a agenda fixa preservando os ids dos horários que continuam
 * (casando por id, depois por dia+hora+turno, depois por dia+turno) — assim os ministérios que atendem
 * um horário não o perdem quando só a hora ou o rótulo mudam. Horários removidos saem dos ministérios.
 */
export async function atualizarUnidade(db: Banco, a: { unidade: LinhaUnidade; req: UnidadeReq; agora: Date; ator: Ator }): Promise<void> {
  const { unidade, req } = a;
  if (req.agenda) {
    const chaves = new Set<string>();
    for (const item of req.agenda) {
      const chave = `${item.diaSemana}:${item.hora}:${item.turno}`;
      if (chaves.has(chave)) throw invalido('Há um horário repetido na agenda.');
      chaves.add(chave);
    }
  }
  await db.transaction(async (tx) => {
    const campos: Partial<LinhaUnidade> = {};
    if (req.nome !== undefined) campos.nome = req.nome;
    if (req.endereco !== undefined) campos.endereco = req.endereco;
    if (Object.keys(campos).length) await tx.update(unidades).set(campos).where(eq(unidades.id, unidade.id));

    let resumoAgenda: Record<string, number> | null = null;
    if (req.agenda) {
      const atuais = await buscarAgenda(tx, unidade.id);
      const livres = new Map<number, LinhaAgenda>(atuais.map((l) => [l.id, l]));
      const pares: { item: ItemAgendaReq; existente: LinhaAgenda | null }[] = req.agenda.map((item) => ({ item, existente: null }));
      const casar = (criterio: (item: ItemAgendaReq, l: LinhaAgenda) => boolean) => {
        for (const par of pares) {
          if (par.existente) continue;
          for (const l of livres.values()) {
            if (criterio(par.item, l)) { par.existente = l; livres.delete(l.id); break; }
          }
        }
      };
      casar((item, l) => item.id !== undefined && item.id === l.id);
      casar((item, l) => item.diaSemana === l.diaSemana && item.hora === l.hora && item.turno === l.turno);
      casar((item, l) => item.diaSemana === l.diaSemana && item.turno === l.turno);
      let alterados = 0;
      let criados = 0;
      for (const { item, existente } of pares) {
        const valores = { diaSemana: item.diaSemana, hora: item.hora, turno: item.turno, rotulo: item.rotulo ?? '', ativo: item.ativo ?? true };
        if (existente) {
          const igual = existente.diaSemana === valores.diaSemana && existente.hora === valores.hora && existente.turno === valores.turno
            && existente.rotulo === valores.rotulo && existente.ativo === valores.ativo;
          if (!igual) { await tx.update(agendaFixa).set(valores).where(eq(agendaFixa.id, existente.id)); alterados++; }
        } else {
          await tx.insert(agendaFixa).values({ unidadeId: unidade.id, ...valores });
          criados++;
        }
      }
      const removidos = [...livres.keys()];
      if (removidos.length) {
        await tx.delete(agendaFixa).where(inArray(agendaFixa.id, removidos));
        const afetados = await tx.select().from(ministerios).where(eq(ministerios.unidadeId, unidade.id));
        for (const m of afetados) {
          if (m.horarios.some((id) => removidos.includes(id))) {
            await tx.update(ministerios).set({ horarios: m.horarios.filter((id) => !removidos.includes(id)) }).where(eq(ministerios.id, m.id));
          }
        }
      }
      resumoAgenda = { criados, alterados, removidos: removidos.length };
    }
    await registrar(tx, {
      ator: a.ator, acao: 'unidade.alterar', alvo: unidade.id, quando: a.agora,
      dados: { campos: Object.keys(campos), ...(resumoAgenda ? { agenda: resumoAgenda } : {}) },
    });
  });
}
