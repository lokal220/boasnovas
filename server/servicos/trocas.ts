/**
 * Trocas (SPEC §3): a pessoa pede → escala 'troca' + troca 'aberta'. Outra pessoa do ministério aceita →
 * nova escala dela confirmado/origem troca, a original vira nao_pode, troca 'aceita' com substituto.
 * O solicitante pode cancelar (volta a confirmado). O líder resolve (aceitar com substituto ou cancelar).
 */
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { escalas, membros, ministerioMembros, trocas } from '@shared/schema';
import type { Banco } from '../db';
import { conflito, invalido, naoEncontrado, proibido } from '../http';
import { buscarCulto, type LinhaEscala, type LinhaTroca } from './consultas';
import { cultoJaPassou } from './dominio';
import { buscarEscala } from './escalas';
import { registrar, type Ator } from './registros';

export async function buscarTroca(db: Banco, id: string): Promise<LinhaTroca | null> {
  const [t] = await db.select().from(trocas).where(eq(trocas.id, id)).limit(1);
  return t ?? null;
}

export async function pedirTroca(db: Banco, a: { escala: LinhaEscala; mensagem: string; fuso: string; agora: Date; ator: Ator }): Promise<string> {
  const culto = await buscarCulto(db, a.escala.cultoId);
  if (!culto) throw naoEncontrado('Culto não encontrado.');
  if (cultoJaPassou(culto, a.fuso, a.agora)) throw conflito('Esse culto já passou.');
  if (a.escala.status === 'nao_pode') throw conflito('Você já avisou que não pode nesse culto.');
  if (a.escala.status === 'troca') throw conflito('Você já pediu troca para esse culto.');
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(trocas).values({ id, escalaId: a.escala.id, solicitanteId: a.escala.membroId, status: 'aberta', mensagem: a.mensagem, criadoEm: a.agora });
    await tx.update(escalas).set({ status: 'troca', atualizadoEm: a.agora }).where(eq(escalas.id, a.escala.id));
    await registrar(tx, {
      ator: a.ator, acao: 'troca.pedir', alvo: id, ministerioId: a.escala.ministerioId, quando: a.agora,
      dados: { escalaId: a.escala.id, cultoId: culto.id, membroId: a.escala.membroId },
    });
  });
  return id;
}

/** Efetiva a troca com o substituto (usado pelo membro que aceita e pelo líder que resolve). */
async function efetivarTroca(db: Banco, a: { troca: LinhaTroca; substitutoId: string; fuso: string; agora: Date; ator: Ator; acao: string }): Promise<void> {
  if (a.troca.status !== 'aberta') throw conflito('Essa troca já foi resolvida.');
  if (a.substitutoId === a.troca.solicitanteId) throw invalido('Quem pediu a troca não pode ser o substituto.');
  const original = await buscarEscala(db, a.troca.escalaId);
  if (!original) throw naoEncontrado('Escala não encontrada.');
  const culto = await buscarCulto(db, original.cultoId);
  if (!culto) throw naoEncontrado('Culto não encontrado.');
  if (cultoJaPassou(culto, a.fuso, a.agora)) throw conflito('Esse culto já passou.');
  const [vinculo] = await db.select({ ativo: membros.ativo }).from(ministerioMembros)
    .innerJoin(membros, eq(membros.id, ministerioMembros.membroId))
    .where(and(eq(ministerioMembros.ministerioId, original.ministerioId), eq(ministerioMembros.membroId, a.substitutoId))).limit(1);
  if (!vinculo || !vinculo.ativo) throw proibido('Essa troca é de outro ministério.');

  await db.transaction(async (tx) => {
    // marca a troca primeiro (condicional): duas pessoas aceitando ao mesmo tempo → só uma leva
    const marcadas = await tx.update(trocas).set({ status: 'aceita', substitutoId: a.substitutoId, resolvidoEm: a.agora })
      .where(and(eq(trocas.id, a.troca.id), eq(trocas.status, 'aberta'))).returning({ id: trocas.id });
    if (!marcadas.length) throw conflito('Essa troca já foi resolvida.');

    const [existente] = await tx.select().from(escalas).where(and(
      eq(escalas.cultoId, original.cultoId), eq(escalas.ministerioId, original.ministerioId), eq(escalas.membroId, a.substitutoId),
    )).limit(1);
    if (existente && existente.status !== 'nao_pode') throw conflito('Essa pessoa já está na escala desse culto.');
    if (existente) {
      await tx.update(escalas).set({ status: 'confirmado', origem: 'troca', funcao: original.funcao, ordem: original.ordem, atualizadoEm: a.agora })
        .where(eq(escalas.id, existente.id));
    } else {
      await tx.insert(escalas).values({
        id: randomUUID(), cultoId: original.cultoId, ministerioId: original.ministerioId, membroId: a.substitutoId,
        papel: 'servo', funcao: original.funcao, status: 'confirmado', origem: 'troca', ordem: original.ordem,
        criadoEm: a.agora, atualizadoEm: a.agora,
      });
    }
    await tx.update(escalas).set({ status: 'nao_pode', atualizadoEm: a.agora }).where(eq(escalas.id, original.id));
    await registrar(tx, {
      ator: a.ator, acao: a.acao, alvo: a.troca.id, ministerioId: original.ministerioId, quando: a.agora,
      dados: { escalaId: original.id, cultoId: original.cultoId, solicitanteId: a.troca.solicitanteId, substitutoId: a.substitutoId },
    });
  });
}

export async function aceitarTroca(db: Banco, a: { troca: LinhaTroca; membroId: string; fuso: string; agora: Date; ator: Ator }): Promise<void> {
  if (a.troca.solicitanteId === a.membroId) throw invalido('Você não pode aceitar a sua própria troca.');
  await efetivarTroca(db, { troca: a.troca, substitutoId: a.membroId, fuso: a.fuso, agora: a.agora, ator: a.ator, acao: 'troca.aceitar' });
}

export async function cancelarTroca(db: Banco, a: { troca: LinhaTroca; agora: Date; ator: Ator; acao: string }): Promise<void> {
  if (a.troca.status !== 'aberta') throw conflito('Essa troca já foi resolvida.');
  const original = await buscarEscala(db, a.troca.escalaId);
  await db.transaction(async (tx) => {
    const marcadas = await tx.update(trocas).set({ status: 'cancelada', resolvidoEm: a.agora })
      .where(and(eq(trocas.id, a.troca.id), eq(trocas.status, 'aberta'))).returning({ id: trocas.id });
    if (!marcadas.length) throw conflito('Essa troca já foi resolvida.');
    if (original && original.status === 'troca') {
      await tx.update(escalas).set({ status: 'confirmado', atualizadoEm: a.agora }).where(eq(escalas.id, original.id));
    }
    await registrar(tx, {
      ator: a.ator, acao: a.acao, alvo: a.troca.id, ministerioId: original?.ministerioId ?? null, quando: a.agora,
      dados: { escalaId: a.troca.escalaId, cultoId: original?.cultoId ?? null, solicitanteId: a.troca.solicitanteId },
    });
  });
}

export async function resolverTroca(db: Banco, a: { troca: LinhaTroca; acao: 'aceitar' | 'cancelar'; substitutoId?: string; fuso: string; agora: Date; ator: Ator }): Promise<void> {
  if (a.acao === 'cancelar') {
    await cancelarTroca(db, { troca: a.troca, agora: a.agora, ator: a.ator, acao: 'troca.cancelar_lider' });
    return;
  }
  if (!a.substitutoId) throw invalido('Escolha quem vai substituir.');
  await efetivarTroca(db, { troca: a.troca, substitutoId: a.substitutoId, fuso: a.fuso, agora: a.agora, ator: a.ator, acao: 'troca.resolver' });
}
