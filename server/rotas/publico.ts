/**
 * Link do grupo do ministério (/api/publico/:token): vê a escala, marca disponibilidade escolhendo o nome
 * e entra na lista ("não estou na lista"). Só nomes saem daqui — nunca telefone nem tokens.
 */
import { Router, type Request } from 'express';
import { disponibilidadeZ, novoMembroPublicoZ } from '@shared/validacao';
import type { ContextoApp } from '../app';
import type { Banco } from '../db';
import { agoraDe, naoEncontrado, param, proibido, validar } from '../http';
import { buscarAgenda, buscarMinisterioPorToken, buscarUnidade, cultoComEscala, type LinhaMinisterio } from '../servicos/consultas';
import { FUSO_PADRAO } from '../servicos/dominio';
import { marcarDisponibilidade } from '../servicos/escalas';
import { criarMembroPublico } from '../servicos/membros';
import { atorAnonimo } from '../servicos/registros';
import { tokenValido } from '../servicos/tokens';
import { escalaPublica } from '../servicos/visoes';
import { limiteAlteracoes } from './limites';

async function ministerioDoLink(db: Banco, req: Request): Promise<LinhaMinisterio> {
  const token = param(req, 'token');
  const ministerio = tokenValido(token) ? await buscarMinisterioPorToken(db, token) : null;
  if (!ministerio || !ministerio.ativo) throw naoEncontrado('Este link não está mais ativo. Peça o link novo ao seu líder.');
  return ministerio;
}

function exigirAberto(ministerio: LinhaMinisterio): void {
  if (ministerio.acesso !== 'aberto') throw proibido('Neste ministério cada pessoa marca a disponibilidade pelo próprio link. Peça o seu ao líder.');
}

export function rotasPublico(ctx: ContextoApp): Router {
  const r = Router();
  const { db } = ctx;
  r.use(limiteAlteracoes());

  r.get('/:token', async (req, res) => {
    const ministerio = await ministerioDoLink(db, req);
    res.json(await escalaPublica(db, ministerio, agoraDe(ctx)));
  });

  r.post('/:token/disponibilidade', async (req, res) => {
    const ministerio = await ministerioDoLink(db, req);
    exigirAberto(ministerio);
    const corpo = validar(disponibilidadeZ, req.body);
    const [unidade, agenda] = await Promise.all([buscarUnidade(db, ministerio.unidadeId), buscarAgenda(db, ministerio.unidadeId)]);
    await marcarDisponibilidade(db, {
      ministerio, agenda, fuso: unidade?.fusoHorario ?? FUSO_PADRAO, membroId: corpo.membroId, cultoId: corpo.cultoId,
      disponivel: corpo.disponivel, agora: agoraDe(ctx), ator: atorAnonimo(req), via: 'grupo',
    });
    res.json(await cultoComEscala(db, ministerio, corpo.cultoId));
  });

  r.post('/:token/membros', async (req, res) => {
    const ministerio = await ministerioDoLink(db, req);
    exigirAberto(ministerio);
    const { nome } = validar(novoMembroPublicoZ, req.body);
    const { membro, criado } = await criarMembroPublico(db, { ministerio, nome, agora: agoraDe(ctx), ator: atorAnonimo(req) });
    res.status(criado ? 201 : 200).json(membro);
  });

  return r;
}
