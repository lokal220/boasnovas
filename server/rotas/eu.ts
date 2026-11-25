/**
 * Link pessoal do membro (/api/eu/:token): minha escala, confirmar, "não consigo dessa vez", pedir/aceitar/cancelar
 * troca, check-in, inscrever-se num culto e agenda .ics. Cada rota só enxerga os dados daquele membro.
 */
import { Router, type Request } from 'express';
import { disponibilidadeMembroZ, pedirTrocaZ } from '@shared/validacao';
import type { ContextoApp } from '../app';
import type { Banco } from '../db';
import { agoraDe, naoEncontrado, param, proibido, validar } from '../http';
import { fazerCheckin } from '../servicos/checkin';
import {
  buscarAgenda, buscarCulto, buscarMembroPorToken, buscarMinisterio, buscarUnidade, papelNoMinisterio, trocaPorId,
  type LinhaCulto, type LinhaEscala, type LinhaMembro,
} from '../servicos/consultas';
import { FUSO_PADRAO } from '../servicos/dominio';
import { buscarEscala, marcarDisponibilidade, responderEscala } from '../servicos/escalas';
import { atorMembro } from '../servicos/registros';
import { tokenValido, urlBase } from '../servicos/tokens';
import { aceitarTroca, buscarTroca, cancelarTroca, pedirTroca } from '../servicos/trocas';
import { minhaEscala, minhaEscalaItem } from '../servicos/visoes';
import { enviarAgendaIcs } from '../servicos/agenda-ics';
import { limiteAlteracoes } from './limites';

async function membroDoLink(db: Banco, req: Request): Promise<LinhaMembro> {
  const token = param(req, 'token');
  const membro = tokenValido(token) ? await buscarMembroPorToken(db, token) : null;
  if (!membro || !membro.ativo) throw naoEncontrado('Este link não está mais ativo. Peça o link novo ao seu líder.');
  return membro;
}

async function fusoDaUnidade(db: Banco, unidadeId: string): Promise<string> {
  return (await buscarUnidade(db, unidadeId))?.fusoHorario ?? FUSO_PADRAO;
}

/** Escala do próprio membro (de outra pessoa = não encontrada) com o culto e o fuso da unidade. */
async function minhaEscalaDoLink(db: Banco, req: Request, membro: LinhaMembro): Promise<{ escala: LinhaEscala; culto: LinhaCulto; fuso: string }> {
  const escala = await buscarEscala(db, param(req, 'escalaId'));
  if (!escala || escala.membroId !== membro.id) throw naoEncontrado('Escala não encontrada.');
  const culto = await buscarCulto(db, escala.cultoId);
  if (!culto) throw naoEncontrado('Escala não encontrada.');
  return { escala, culto, fuso: await fusoDaUnidade(db, culto.unidadeId) };
}

export function rotasEu(ctx: ContextoApp): Router {
  const r = Router();
  const { db } = ctx;
  r.use(limiteAlteracoes());

  r.get('/:token', async (req, res) => {
    const membro = await membroDoLink(db, req);
    res.json(await minhaEscala(db, membro, urlBase(req), agoraDe(ctx)));
  });

  r.get('/:token/agenda.ics', async (req, res) => {
    const membro = await membroDoLink(db, req);
    await enviarAgendaIcs(db, res, membro, urlBase(req), agoraDe(ctx));
  });

  for (const [acao, status] of [['confirmar', 'confirmado'], ['nao-posso', 'nao_pode']] as const) {
    r.post(`/:token/escalas/:escalaId/${acao}`, async (req, res) => {
      const membro = await membroDoLink(db, req);
      const { escala, culto, fuso } = await minhaEscalaDoLink(db, req, membro);
      const agora = agoraDe(ctx);
      await responderEscala(db, { escala, culto, fuso, status, agora, ator: atorMembro(membro.id) });
      res.json(await minhaEscalaItem(db, membro.id, escala.id, agora));
    });
  }

  r.post('/:token/escalas/:escalaId/troca', async (req, res) => {
    const membro = await membroDoLink(db, req);
    const { mensagem } = validar(pedirTrocaZ, req.body);
    const { escala, fuso } = await minhaEscalaDoLink(db, req, membro);
    const id = await pedirTroca(db, { escala, mensagem: mensagem ?? '', fuso, agora: agoraDe(ctx), ator: atorMembro(membro.id) });
    res.status(201).json(await trocaPorId(db, id));
  });

  r.post('/:token/escalas/:escalaId/checkin', async (req, res) => {
    const membro = await membroDoLink(db, req);
    const { escala, culto, fuso } = await minhaEscalaDoLink(db, req, membro);
    const agora = agoraDe(ctx);
    await fazerCheckin(db, { escala, culto, fuso, agora, ator: atorMembro(membro.id) });
    res.json(await minhaEscalaItem(db, membro.id, escala.id, agora));
  });

  r.post('/:token/disponibilidade', async (req, res) => {
    const membro = await membroDoLink(db, req);
    const corpo = validar(disponibilidadeMembroZ, req.body);
    const ministerio = await buscarMinisterio(db, corpo.ministerioId);
    if (!ministerio || !ministerio.ativo || !(await papelNoMinisterio(db, ministerio.id, membro.id))) {
      throw proibido('Você não faz parte desse ministério.');
    }
    const [fuso, agenda] = await Promise.all([fusoDaUnidade(db, ministerio.unidadeId), buscarAgenda(db, ministerio.unidadeId)]);
    const agora = agoraDe(ctx);
    await marcarDisponibilidade(db, {
      ministerio, agenda, fuso, membroId: membro.id, cultoId: corpo.cultoId, disponivel: corpo.disponivel,
      agora, ator: atorMembro(membro.id), via: 'pessoal',
    });
    res.json(await minhaEscala(db, membro, urlBase(req), agora));
  });

  r.post('/:token/trocas/:trocaId/aceitar', async (req, res) => {
    const membro = await membroDoLink(db, req);
    const troca = await buscarTroca(db, param(req, 'trocaId'));
    if (!troca) throw naoEncontrado('Troca não encontrada.');
    const original = await buscarEscala(db, troca.escalaId);
    const culto = original ? await buscarCulto(db, original.cultoId) : null;
    if (!original || !culto) throw naoEncontrado('Troca não encontrada.');
    await aceitarTroca(db, { troca, membroId: membro.id, fuso: await fusoDaUnidade(db, culto.unidadeId), agora: agoraDe(ctx), ator: atorMembro(membro.id) });
    res.json(await trocaPorId(db, troca.id));
  });

  r.post('/:token/trocas/:trocaId/cancelar', async (req, res) => {
    const membro = await membroDoLink(db, req);
    const troca = await buscarTroca(db, param(req, 'trocaId'));
    if (!troca) throw naoEncontrado('Troca não encontrada.');
    if (troca.solicitanteId !== membro.id) throw proibido('Só quem pediu a troca pode cancelar.');
    await cancelarTroca(db, { troca, agora: agoraDe(ctx), ator: atorMembro(membro.id), acao: 'troca.cancelar' });
    res.json(await trocaPorId(db, troca.id));
  });

  return r;
}
