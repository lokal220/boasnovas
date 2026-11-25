/**
 * Membros (pessoas que servem) e o vínculo com os ministérios.
 * Ids legíveis (slug do nome, com sufixo se repetir); link pessoal por token regenerável.
 */
import { and, eq, like, ne, or } from 'drizzle-orm';
import type { MembroReq, MembroResumo, PapelMinisterio } from '@shared/api';
import { escalas, membros, ministerioMembros } from '@shared/schema';
import type { Banco } from '../db';
import type { LinhaMembro, LinhaMinisterio } from './consultas';
import { idLivre, normalizar, slugOuPadrao, tituloNome } from './dominio';
import { registrar, type Ator } from './registros';
import { gerarToken } from './tokens';

/** Nome como a pessoa escreveu; tudo minúsculo ou tudo maiúsculo vira "Nome Próprio". */
export function arrumarNome(nome: string): string {
  const limpo = nome.replace(/\s+/g, ' ').trim();
  if (limpo === limpo.toLocaleLowerCase('pt-BR') || limpo === limpo.toLocaleUpperCase('pt-BR')) return tituloNome(limpo);
  return limpo;
}

async function idLivreParaMembro(db: Banco, nome: string): Promise<string> {
  const base = slugOuPadrao(nome, 'membro');
  const linhas = await db.select({ id: membros.id }).from(membros).where(or(eq(membros.id, base), like(membros.id, `${base}-%`)));
  return idLivre(base, new Set(linhas.map((l) => l.id)));
}

export interface NovoMembro {
  nome: string;
  apelidos?: string[];
  telefone?: string;
  ativo?: boolean;
  ministerioId?: string;
  papel?: PapelMinisterio;
}

/** Cria o membro (e o vínculo com o ministério, se houver) dentro da transação/conexão recebida. */
export async function inserirMembro(db: Banco, dados: NovoMembro, agora: Date): Promise<LinhaMembro> {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const id = await idLivreParaMembro(db, dados.nome);
    const [criado] = await db.insert(membros).values({
      id, nome: arrumarNome(dados.nome), apelidos: dados.apelidos ?? [], telefone: dados.telefone ?? '',
      ativo: dados.ativo ?? true, tokenAcesso: gerarToken(), criadoEm: agora,
    }).onConflictDoNothing().returning();
    if (!criado) continue;
    if (dados.ministerioId) {
      await db.insert(ministerioMembros).values({ ministerioId: dados.ministerioId, membroId: id, papel: dados.papel ?? 'servo', criadoEm: agora });
    }
    return criado;
  }
  throw new Error('não foi possível gerar um id livre para o membro');
}

export async function criarMembro(db: Banco, a: { dados: NovoMembro; agora: Date; ator: Ator }): Promise<LinhaMembro> {
  return db.transaction(async (tx) => {
    const criado = await inserirMembro(tx, a.dados, a.agora);
    await registrar(tx, {
      ator: a.ator, acao: 'membro.criar', alvo: criado.id, ministerioId: a.dados.ministerioId ?? null, quando: a.agora,
      dados: { nome: criado.nome, papel: a.dados.papel ?? 'servo' },
    });
    return criado;
  });
}

/** "Não estou na lista" pelo link do grupo: devolve a pessoa se o nome já estiver na lista do ministério. */
export async function criarMembroPublico(db: Banco, a: { ministerio: LinhaMinisterio; nome: string; agora: Date; ator: Ator }): Promise<{ membro: MembroResumo; criado: boolean }> {
  const daLista = await db
    .select({ id: membros.id, nome: membros.nome, apelidos: membros.apelidos, papel: ministerioMembros.papel })
    .from(ministerioMembros)
    .innerJoin(membros, eq(membros.id, ministerioMembros.membroId))
    .where(and(eq(ministerioMembros.ministerioId, a.ministerio.id), eq(membros.ativo, true)));
  const procurado = normalizar(a.nome);
  const igual = daLista.find((m) => normalizar(m.nome) === procurado || m.apelidos.some((ap) => normalizar(ap) === procurado));
  if (igual) return { membro: { id: igual.id, nome: igual.nome, papel: igual.papel as PapelMinisterio }, criado: false };
  const criado = await db.transaction(async (tx) => {
    const m = await inserirMembro(tx, { nome: a.nome, ministerioId: a.ministerio.id, papel: 'servo' }, a.agora);
    await registrar(tx, { ator: a.ator, acao: 'membro.criar_pelo_grupo', alvo: m.id, ministerioId: a.ministerio.id, quando: a.agora, dados: { nome: m.nome } });
    return m;
  });
  return { membro: { id: criado.id, nome: criado.nome, papel: 'servo' }, criado: true };
}

export async function atualizarMembro(db: Banco, a: { membro: LinhaMembro; patch: Partial<MembroReq>; ministerioId: string; agora: Date; ator: Ator }): Promise<void> {
  const { membro, patch } = a;
  const campos: Partial<LinhaMembro> = {};
  if (patch.nome !== undefined) campos.nome = arrumarNome(patch.nome);
  if (patch.apelidos !== undefined) campos.apelidos = patch.apelidos;
  if (patch.telefone !== undefined) campos.telefone = patch.telefone;
  if (patch.ativo !== undefined) campos.ativo = patch.ativo;
  await db.transaction(async (tx) => {
    if (Object.keys(campos).length) await tx.update(membros).set(campos).where(eq(membros.id, membro.id));
    // garante o vínculo com o ministério do contexto (permite trazer alguém de outro ministério)
    const vinculo = { ministerioId: a.ministerioId, membroId: membro.id, papel: patch.papel ?? 'servo', criadoEm: a.agora };
    if (patch.papel !== undefined) {
      await tx.insert(ministerioMembros).values(vinculo)
        .onConflictDoUpdate({ target: [ministerioMembros.ministerioId, ministerioMembros.membroId], set: { papel: patch.papel } });
    } else if (patch.ministerioId !== undefined) {
      await tx.insert(ministerioMembros).values(vinculo).onConflictDoNothing();
    }
    // sem telefone no histórico: só quais campos mudaram
    const alterados = [...Object.keys(campos), ...(patch.papel !== undefined ? ['papel'] : [])];
    await registrar(tx, {
      ator: a.ator, acao: 'membro.alterar', alvo: membro.id, ministerioId: a.ministerioId, quando: a.agora,
      dados: { nome: campos.nome ?? membro.nome, campos: alterados, ...(patch.papel !== undefined ? { papel: patch.papel } : {}), ...(patch.ativo !== undefined ? { ativo: patch.ativo } : {}) },
    });
  });
}

export async function novoTokenMembro(db: Banco, a: { membro: LinhaMembro; ministerioId: string; agora: Date; ator: Ator }): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(membros).set({ tokenAcesso: gerarToken() }).where(eq(membros.id, a.membro.id));
    await registrar(tx, { ator: a.ator, acao: 'membro.novo_link', alvo: a.membro.id, ministerioId: a.ministerioId, quando: a.agora, dados: { nome: a.membro.nome } });
  });
}

/**
 * Tirar da equipe: sem histórico de escalas, sai do ministério (e é apagado se não estiver em outro);
 * com histórico, fica desativado se não estiver em outro ministério, senão só sai deste.
 */
export async function removerMembro(db: Banco, a: { membro: LinhaMembro; ministerioId: string; agora: Date; ator: Ator }): Promise<{ removido: boolean; desativado: boolean }> {
  return db.transaction(async (tx) => {
    const [temEscala] = await tx.select({ id: escalas.id }).from(escalas).where(eq(escalas.membroId, a.membro.id)).limit(1);
    const outros = await tx.select({ id: ministerioMembros.ministerioId }).from(ministerioMembros)
      .where(and(eq(ministerioMembros.membroId, a.membro.id), ne(ministerioMembros.ministerioId, a.ministerioId)));
    let resultado: { removido: boolean; desativado: boolean };
    if (temEscala && !outros.length) {
      if (a.membro.ativo) await tx.update(membros).set({ ativo: false }).where(eq(membros.id, a.membro.id));
      resultado = { removido: false, desativado: true };
    } else if (!temEscala && !outros.length) {
      await tx.delete(membros).where(eq(membros.id, a.membro.id));
      resultado = { removido: true, desativado: false };
    } else {
      await tx.delete(ministerioMembros).where(and(eq(ministerioMembros.membroId, a.membro.id), eq(ministerioMembros.ministerioId, a.ministerioId)));
      resultado = { removido: true, desativado: false };
    }
    await registrar(tx, { ator: a.ator, acao: 'membro.remover', alvo: a.membro.id, ministerioId: a.ministerioId, quando: a.agora, dados: { nome: a.membro.nome, ...resultado } });
    return resultado;
  });
}
