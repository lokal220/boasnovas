/**
 * Regras de escrita das escalas (SPEC §3):
 * - disponibilidade pelo link do grupo/pessoal (marcar = confirmado/voluntario; desmarcar = apagar se foi o
 *   voluntário e não tem check-in, senão nao_pode);
 * - escala do culto montada pelo líder (PUT substitui; líder único e fora dos servos);
 * - status com a invariante da troca: status 'troca' ⇔ existe uma troca 'aberta' para a escala.
 */
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { EscalacaoReq, EscaladoDTO, EscalaPatchReq, PapelEscala, StatusEscala } from '@shared/api';
import { escalas, membros, ministerioMembros, trocas, vagas } from '@shared/schema';
import type { Banco } from '../db';
import { conflito, invalido, naoEncontrado } from '../http';
import {
  buscarCulto, ministerioAtende, paraEscaladoDTO,
  type LinhaAgenda, type LinhaCulto, type LinhaEscala, type LinhaMinisterio,
} from './consultas';
import { cultoJaPassou } from './dominio';
import { registrar, type Ator } from './registros';

export async function escalasDoCulto(db: Banco, cultoId: string, ministerioId: string): Promise<LinhaEscala[]> {
  return db.select().from(escalas).where(and(eq(escalas.cultoId, cultoId), eq(escalas.ministerioId, ministerioId)));
}

export async function buscarEscala(db: Banco, id: string): Promise<LinhaEscala | null> {
  const [e] = await db.select().from(escalas).where(eq(escalas.id, id)).limit(1);
  return e ?? null;
}

/**
 * Muda o status mantendo a invariante da troca:
 * sair de 'troca' cancela a troca aberta; entrar em 'troca' abre uma (solicitante = a própria pessoa).
 */
export async function definirStatus(db: Banco, escala: LinhaEscala, novo: StatusEscala, agora: Date): Promise<void> {
  if (escala.status === novo) return;
  if (escala.status === 'troca') {
    await db.update(trocas).set({ status: 'cancelada', resolvidoEm: agora })
      .where(and(eq(trocas.escalaId, escala.id), eq(trocas.status, 'aberta')));
  }
  if (novo === 'troca') {
    const [aberta] = await db.select({ id: trocas.id }).from(trocas)
      .where(and(eq(trocas.escalaId, escala.id), eq(trocas.status, 'aberta'))).limit(1);
    if (!aberta) {
      await db.insert(trocas).values({ id: randomUUID(), escalaId: escala.id, solicitanteId: escala.membroId, status: 'aberta', criadoEm: agora });
    }
  }
  await db.update(escalas).set({ status: novo, atualizadoEm: agora }).where(eq(escalas.id, escala.id));
  escala.status = novo;
  escala.atualizadoEm = agora;
}

/** Culto válido para o ministério (mesma unidade e atendido por ele) — senão 404. */
export async function cultoDoMinisterio(db: Banco, cultoId: string, ministerio: LinhaMinisterio, agenda: LinhaAgenda[]): Promise<LinhaCulto> {
  const culto = await buscarCulto(db, cultoId);
  if (!culto || culto.unidadeId !== ministerio.unidadeId) throw naoEncontrado('Culto não encontrado.');
  if (!ministerioAtende(culto, ministerio, agenda)) {
    const [temEscala] = await db.select({ id: escalas.id }).from(escalas)
      .where(and(eq(escalas.cultoId, culto.id), eq(escalas.ministerioId, ministerio.id))).limit(1);
    const [temVaga] = await db.select({ q: vagas.quantidade }).from(vagas)
      .where(and(eq(vagas.cultoId, culto.id), eq(vagas.ministerioId, ministerio.id))).limit(1);
    if (!temEscala && !temVaga) throw naoEncontrado('Culto não encontrado.');
  }
  return culto;
}

export interface ArgsDisponibilidade {
  ministerio: LinhaMinisterio;
  agenda: LinhaAgenda[];
  fuso: string;
  membroId: string;
  cultoId: string;
  disponivel: boolean;
  agora: Date;
  ator: Ator;
  /** de onde veio (fica no registro) */
  via: 'grupo' | 'pessoal';
}

/** Marca/desmarca a disponibilidade de um membro num culto (link do grupo ou link pessoal). */
export async function marcarDisponibilidade(db: Banco, a: ArgsDisponibilidade): Promise<void> {
  const [vinculo] = await db
    .select({ ativo: membros.ativo })
    .from(ministerioMembros)
    .innerJoin(membros, eq(membros.id, ministerioMembros.membroId))
    .where(and(eq(ministerioMembros.ministerioId, a.ministerio.id), eq(ministerioMembros.membroId, a.membroId)))
    .limit(1);
  if (!vinculo || !vinculo.ativo) throw naoEncontrado('Não encontramos esse nome na lista do ministério.');
  const culto = await cultoDoMinisterio(db, a.cultoId, a.ministerio, a.agenda);
  if (cultoJaPassou(culto, a.fuso, a.agora)) throw conflito('Esse culto já passou.');

  await db.transaction(async (tx) => {
    const atuais = await escalasDoCulto(tx, culto.id, a.ministerio.id);
    const minha = atuais.find((e) => e.membroId === a.membroId);
    const base = { ator: a.ator, ministerioId: a.ministerio.id, quando: a.agora };
    if (a.disponivel) {
      if (!minha) {
        const ordem = atuais.reduce((max, e) => Math.max(max, e.ordem), -1) + 1;
        const id = randomUUID();
        const criadas = await tx.insert(escalas).values({
          id, cultoId: culto.id, ministerioId: a.ministerio.id, membroId: a.membroId, papel: 'servo',
          status: 'confirmado', origem: 'voluntario', ordem, criadoEm: a.agora, atualizadoEm: a.agora,
        }).onConflictDoNothing().returning({ id: escalas.id });
        if (criadas.length) {
          await registrar(tx, { ...base, acao: 'disponibilidade.marcar', alvo: id, dados: { cultoId: culto.id, membroId: a.membroId, via: a.via } });
        }
      } else if (minha.status !== 'confirmado') {
        const antes = minha.status;
        await definirStatus(tx, minha, 'confirmado', a.agora);
        await registrar(tx, { ...base, acao: 'disponibilidade.marcar', alvo: minha.id, dados: { cultoId: culto.id, membroId: a.membroId, antes, depois: 'confirmado', via: a.via } });
      }
      return;
    }
    if (!minha) return;
    if (minha.origem === 'voluntario' && !minha.checkinEm) {
      await tx.delete(escalas).where(eq(escalas.id, minha.id));
      await registrar(tx, { ...base, acao: 'disponibilidade.desmarcar', alvo: minha.id, dados: { cultoId: culto.id, membroId: a.membroId, removida: true, via: a.via } });
    } else if (minha.status !== 'nao_pode') {
      const antes = minha.status;
      await definirStatus(tx, minha, 'nao_pode', a.agora);
      await registrar(tx, { ...base, acao: 'disponibilidade.desmarcar', alvo: minha.id, dados: { cultoId: culto.id, membroId: a.membroId, antes, depois: 'nao_pode', via: a.via } });
    }
  });
}

/** Confirmar / "não consigo dessa vez" pelo link pessoal. */
export async function responderEscala(db: Banco, a: { escala: LinhaEscala; culto: LinhaCulto; fuso: string; status: 'confirmado' | 'nao_pode'; agora: Date; ator: Ator }): Promise<void> {
  if (cultoJaPassou(a.culto, a.fuso, a.agora)) throw conflito('Esse culto já passou.');
  if (a.escala.status === a.status) return;
  const antes = a.escala.status;
  await db.transaction(async (tx) => {
    await definirStatus(tx, a.escala, a.status, a.agora);
    await registrar(tx, {
      ator: a.ator, acao: a.status === 'confirmado' ? 'escala.confirmar' : 'escala.nao_pode', alvo: a.escala.id,
      ministerioId: a.escala.ministerioId, quando: a.agora, dados: { cultoId: a.culto.id, membroId: a.escala.membroId, antes, depois: a.status },
    });
  });
}

interface Desejado { membroId: string; papel: PapelEscala; status?: StatusEscala; funcao?: string }

/** PUT da escala do culto: o resultado é exatamente líder + servos (na ordem enviada). */
export async function substituirEscala(db: Banco, a: { culto: LinhaCulto; ministerio: LinhaMinisterio; req: EscalacaoReq; agora: Date; ator: Ator }): Promise<void> {
  const desejados: Desejado[] = [];
  const vistos = new Set<string>();
  if (a.req.lider) {
    desejados.push({ membroId: a.req.lider, papel: 'lider' });
    vistos.add(a.req.lider);
  }
  for (const s of a.req.servos) {
    if (vistos.has(s.membroId)) continue; // líder fora dos servos; sem repetição
    vistos.add(s.membroId);
    desejados.push({ membroId: s.membroId, papel: 'servo', status: s.status, funcao: s.funcao });
  }

  await db.transaction(async (tx) => {
    const atuais = await escalasDoCulto(tx, a.culto.id, a.ministerio.id);
    const porMembro = new Map(atuais.map((e) => [e.membroId, e]));
    const novos = desejados.filter((d) => !porMembro.has(d.membroId)).map((d) => d.membroId);
    if (novos.length) {
      const doMinisterio = await tx.select({ id: ministerioMembros.membroId }).from(ministerioMembros)
        .where(and(eq(ministerioMembros.ministerioId, a.ministerio.id), inArray(ministerioMembros.membroId, novos)));
      const ok = new Set(doMinisterio.map((l) => l.id));
      const fora = novos.filter((id) => !ok.has(id));
      if (fora.length) throw invalido('Só dá para escalar pessoas da equipe deste ministério.', { membros: fora });
    }

    const manter = new Set(desejados.map((d) => d.membroId));
    const removidas = atuais.filter((e) => !manter.has(e.membroId));
    if (removidas.length) await tx.delete(escalas).where(inArray(escalas.id, removidas.map((e) => e.id)));

    const adicionados: string[] = [];
    const alterados: string[] = [];
    for (const [ordem, d] of desejados.entries()) {
      const atual = porMembro.get(d.membroId);
      if (!atual) {
        const id = randomUUID();
        const status = d.status ?? 'confirmado';
        await tx.insert(escalas).values({
          id, cultoId: a.culto.id, ministerioId: a.ministerio.id, membroId: d.membroId, papel: d.papel,
          funcao: d.funcao ?? '', status: status === 'troca' ? 'confirmado' : status, origem: 'lider', ordem,
          criadoEm: a.agora, atualizadoEm: a.agora,
        });
        if (status === 'troca') {
          const [criada] = await tx.select().from(escalas).where(eq(escalas.id, id));
          if (criada) await definirStatus(tx, criada, 'troca', a.agora);
        }
        adicionados.push(d.membroId);
        continue;
      }
      const mudou = atual.papel !== d.papel || atual.ordem !== ordem || (d.funcao !== undefined && d.funcao !== atual.funcao) || (d.status !== undefined && d.status !== atual.status);
      if (!mudou) continue;
      if (d.status !== undefined) await definirStatus(tx, atual, d.status, a.agora);
      await tx.update(escalas).set({
        papel: d.papel, ordem, ...(d.funcao !== undefined ? { funcao: d.funcao } : {}), atualizadoEm: a.agora,
      }).where(eq(escalas.id, atual.id));
      alterados.push(d.membroId);
    }

    if (adicionados.length || alterados.length || removidas.length) {
      await registrar(tx, {
        ator: a.ator, acao: 'escala.substituir', alvo: a.culto.id, ministerioId: a.ministerio.id, quando: a.agora,
        dados: { cultoId: a.culto.id, lider: a.req.lider, adicionados, removidos: removidas.map((e) => e.membroId), alterados },
      });
    }
  });
}

export async function definirVagas(db: Banco, a: { culto: LinhaCulto; ministerio: LinhaMinisterio; quantidade: number; agora: Date; ator: Ator }): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(vagas).values({ cultoId: a.culto.id, ministerioId: a.ministerio.id, quantidade: a.quantidade })
      .onConflictDoUpdate({ target: [vagas.cultoId, vagas.ministerioId], set: { quantidade: a.quantidade } });
    await registrar(tx, {
      ator: a.ator, acao: 'vagas.definir', alvo: a.culto.id, ministerioId: a.ministerio.id, quando: a.agora,
      dados: { cultoId: a.culto.id, quantidade: a.quantidade },
    });
  });
}

export async function alterarEscala(db: Banco, a: { escala: LinhaEscala; patch: EscalaPatchReq; agora: Date; ator: Ator }): Promise<EscaladoDTO> {
  const { escala, patch } = a;
  const antes = { status: escala.status, papel: escala.papel, funcao: escala.funcao };
  await db.transaction(async (tx) => {
    if (patch.papel === 'lider' && escala.papel !== 'lider') {
      // no máximo um líder por culto/ministério: o anterior volta a ser servo
      await tx.update(escalas).set({ papel: 'servo', atualizadoEm: a.agora }).where(and(
        eq(escalas.cultoId, escala.cultoId), eq(escalas.ministerioId, escala.ministerioId),
        eq(escalas.papel, 'lider'), ne(escalas.id, escala.id),
      ));
    }
    if (patch.status !== undefined) await definirStatus(tx, escala, patch.status, a.agora);
    const campos: Partial<Pick<LinhaEscala, 'papel' | 'funcao'>> = {};
    if (patch.papel !== undefined) campos.papel = patch.papel;
    if (patch.funcao !== undefined) campos.funcao = patch.funcao;
    if (Object.keys(campos).length) {
      await tx.update(escalas).set({ ...campos, atualizadoEm: a.agora }).where(eq(escalas.id, escala.id));
    }
    await registrar(tx, {
      ator: a.ator, acao: 'escala.alterar', alvo: escala.id, ministerioId: escala.ministerioId, quando: a.agora,
      dados: { cultoId: escala.cultoId, membroId: escala.membroId, antes, depois: { ...antes, ...patch } },
    });
  });
  const [linha] = await db.select({ e: escalas, nome: membros.nome }).from(escalas)
    .innerJoin(membros, eq(membros.id, escalas.membroId)).where(eq(escalas.id, escala.id));
  if (!linha) throw naoEncontrado('Escala não encontrada.');
  return paraEscaladoDTO(linha.e, linha.nome);
}

export async function removerEscala(db: Banco, a: { escala: LinhaEscala; agora: Date; ator: Ator }): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(escalas).where(eq(escalas.id, a.escala.id));
    await registrar(tx, {
      ator: a.ator, acao: 'escala.remover', alvo: a.escala.id, ministerioId: a.escala.ministerioId, quando: a.agora,
      dados: { cultoId: a.escala.cultoId, membroId: a.escala.membroId, status: a.escala.status },
    });
  });
}
