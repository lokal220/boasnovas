/**
 * Rotas do líder (/api/lider/*): exigem sessão. Líder só nos ministérios dele (usuarios.ministerios); admin em tudo.
 * Toda alteração fica registrada em `registros`.
 */
import { Router, type Request } from 'express';
import { eq } from 'drizzle-orm';
import { escalas, membros, ministerioMembros } from '@shared/schema';
import {
  cultoNovoZ, cultoPatchZ, escalacaoZ, escalaPatchZ, gerarCultosZ, importarAplicarZ, importarZ, membroPatchZ, membroZ,
  ministerioPatchZ, ministerioZ, resolverTrocaZ, unidadeZ, usuarioPatchZ, usuarioZ, vagasZ,
} from '@shared/validacao';
import type { ContextoApp } from '../app';
import { ehAdmin, exigirAdmin, exigirLogin, podeGerir, usuarioLogado } from '../auth/middleware';
import type { LinhaUsuario } from '../auth/sessao';
import { agoraDe, invalido, naoEncontrado, param, proibido, textoQuery, validar } from '../http';
import {
  buscarAgenda, buscarCulto, buscarUnidade, cultoComEscala, membrosLider, paraMinisterioLiderDTO,
  trocaPorId, unidadesComAgenda, type LinhaCulto, type LinhaMembro, type LinhaMinisterio,
} from '../servicos/consultas';
import { atualizarCulto, criarCulto, gerarCultosDoMes, listarCultos, removerCulto } from '../servicos/cultos';
import { FUSO_PADRAO, dataValida, hojeNoFuso } from '../servicos/dominio';
import { alterarEscala, buscarEscala, definirVagas, removerEscala, substituirEscala } from '../servicos/escalas';
import { exportarEscala } from '../servicos/exportacao';
import { analisarImportacao, aplicarImportacao } from '../servicos/importacao';
import { listarLembretes } from '../servicos/lembretes';
import { atualizarMembro, criarMembro, novoTokenMembro, removerMembro } from '../servicos/membros';
import {
  atualizarMinisterio, atualizarUnidade, criarMinisterio, ministerioDoUsuario, ministeriosDoUsuario, novoTokenMinisterio,
} from '../servicos/ministerios';
import { atorUsuario, listarRegistros } from '../servicos/registros';
import { urlBase } from '../servicos/tokens';
import { buscarTroca, resolverTroca } from '../servicos/trocas';
import { atualizarUsuario, buscarUsuario, criarUsuario, listarUsuarios } from '../servicos/usuarios';
import { painel } from '../servicos/visoes';

/** Parâmetro de data opcional ('AAAA-MM-DD'); inválido → 400. */
function dataQuery(req: Request, nome: string): string | undefined {
  const valor = textoQuery(req, nome);
  if (valor === undefined) return undefined;
  if (!dataValida(valor)) throw invalido('Use a data no formato AAAA-MM-DD.');
  return valor;
}

/** Parâmetro inteiro opcional com limites; inválido → 400. */
function inteiroQuery(req: Request, nome: string, padrao: number, min: number, max: number): number {
  const valor = textoQuery(req, nome);
  if (valor === undefined) return padrao;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) throw invalido(`O parâmetro ${nome} precisa ser um número entre ${min} e ${max}.`);
  return n;
}

export function rotasLider(ctx: ContextoApp): Router {
  const r = Router();
  const { db } = ctx;
  r.use(exigirLogin(ctx));

  const ator = (req: Request) => atorUsuario(usuarioLogado(req).id);

  async function hojeDaUnidade(unidadeId: string): Promise<string> {
    const u = await buscarUnidade(db, unidadeId);
    return hojeNoFuso(u?.fusoHorario ?? FUSO_PADRAO, agoraDe(ctx));
  }

  async function fusoDaUnidade(unidadeId: string): Promise<string> {
    return (await buscarUnidade(db, unidadeId))?.fusoHorario ?? FUSO_PADRAO;
  }

  /** Unidades em que o usuário atua (null = todas, para o admin). */
  async function unidadesDoUsuario(usuario: LinhaUsuario): Promise<string[] | null> {
    if (ehAdmin(usuario)) return null;
    return [...new Set((await ministeriosDoUsuario(db, usuario)).map((m) => m.unidadeId))];
  }

  /** Unidade pedida (com autorização) ou a primeira do usuário. */
  async function unidadeDoUsuario(usuario: LinhaUsuario, pedida?: string): Promise<string> {
    const permitidas = await unidadesDoUsuario(usuario);
    if (pedida) {
      if (!(await buscarUnidade(db, pedida))) throw naoEncontrado('Unidade não encontrada.');
      if (permitidas && !permitidas.includes(pedida)) throw proibido('Você não tem acesso a esta unidade.');
      return pedida;
    }
    const [primeira] = await unidadesComAgenda(db, permitidas);
    if (!primeira) throw naoEncontrado('Nenhuma unidade disponível para a sua conta.');
    return primeira.id;
  }

  async function cultoAutorizado(req: Request, id: string): Promise<LinhaCulto> {
    const culto = await buscarCulto(db, id);
    if (!culto) throw naoEncontrado('Culto não encontrado.');
    await unidadeDoUsuario(usuarioLogado(req), culto.unidadeId);
    return culto;
  }

  /** Ministério + culto da mesma unidade (para as rotas de escala/vagas do culto). */
  async function cultoDoMinisterio(req: Request): Promise<{ culto: LinhaCulto; ministerio: LinhaMinisterio }> {
    const ministerio = await ministerioDoUsuario(db, usuarioLogado(req), param(req, 'ministerioId'));
    const culto = await buscarCulto(db, param(req, 'cultoId'));
    if (!culto || culto.unidadeId !== ministerio.unidadeId) throw naoEncontrado('Culto não encontrado.');
    return { culto, ministerio };
  }

  /**
   * Membro visível para o usuário: admin vê todos; líder só quem está em algum ministério dele.
   * Devolve também o ministério de contexto (o pedido, ou o primeiro em comum).
   */
  async function membroAutorizado(req: Request, id: string, ministerioPedido?: string): Promise<{ membro: LinhaMembro; ministerio: LinhaMinisterio; vinculado: boolean }> {
    const usuario = usuarioLogado(req);
    const [membro] = await db.select().from(membros).where(eq(membros.id, id)).limit(1);
    if (!membro) throw naoEncontrado('Pessoa não encontrada.');
    const vinculos = (await db.select({ ministerioId: ministerioMembros.ministerioId }).from(ministerioMembros)
      .where(eq(ministerioMembros.membroId, membro.id))).map((v) => v.ministerioId);
    const emComum = vinculos.filter((m) => podeGerir(usuario, m));
    if (!ehAdmin(usuario) && !emComum.length) throw naoEncontrado('Pessoa não encontrada.');
    const contexto = ministerioPedido ?? emComum[0] ?? vinculos[0];
    const ministerio = await ministerioDoUsuario(db, usuario, contexto);
    return { membro, ministerio, vinculado: vinculos.includes(ministerio.id) };
  }

  async function membroLiderDTO(req: Request, ministerio: LinhaMinisterio, membroId: string) {
    const [dto] = await membrosLider(db, ministerio.id, urlBase(req), await hojeDaUnidade(ministerio.unidadeId), [membroId]);
    if (!dto) throw naoEncontrado('Pessoa não encontrada neste ministério.');
    return dto;
  }

  // ───────────────────────── ministérios ─────────────────────────

  r.get('/ministerios', async (req, res) => {
    const lista = await ministeriosDoUsuario(db, usuarioLogado(req));
    const base = urlBase(req);
    res.json(lista.map((m) => paraMinisterioLiderDTO(m, base)));
  });

  r.post('/ministerios', exigirAdmin, async (req, res) => {
    const corpo = validar(ministerioZ, req.body);
    const criado = await criarMinisterio(db, { req: corpo, agora: agoraDe(ctx), ator: ator(req) });
    res.status(201).json(paraMinisterioLiderDTO(criado, urlBase(req)));
  });

  r.patch('/ministerios/:id', async (req, res) => {
    const patch = validar(ministerioPatchZ, req.body);
    const usuario = usuarioLogado(req);
    const ministerio = await ministerioDoUsuario(db, usuario, param(req, 'id'));
    const atualizado = await atualizarMinisterio(db, { ministerio, patch, admin: ehAdmin(usuario), agora: agoraDe(ctx), ator: ator(req) });
    res.json(paraMinisterioLiderDTO(atualizado, urlBase(req)));
  });

  r.post('/ministerios/:id/token', async (req, res) => {
    const ministerio = await ministerioDoUsuario(db, usuarioLogado(req), param(req, 'id'));
    const atualizado = await novoTokenMinisterio(db, { ministerio, agora: agoraDe(ctx), ator: ator(req) });
    res.json(paraMinisterioLiderDTO(atualizado, urlBase(req)));
  });

  // ───────────────────────── painel ─────────────────────────

  r.get('/painel', async (req, res) => {
    const ministerio = await ministerioDoUsuario(db, usuarioLogado(req), textoQuery(req, 'ministerio') ?? textoQuery(req, 'm'));
    const de = dataQuery(req, 'de');
    const ate = dataQuery(req, 'ate');
    if (de && ate && de > ate) throw invalido('A data inicial precisa ser antes da final.');
    res.json(await painel(db, ministerio, urlBase(req), agoraDe(ctx), { de, ate }));
  });

  // ───────────────────────── unidades ─────────────────────────

  r.get('/unidades', async (req, res) => {
    res.json(await unidadesComAgenda(db, await unidadesDoUsuario(usuarioLogado(req))));
  });

  r.patch('/unidades/:id', exigirAdmin, async (req, res) => {
    const corpo = validar(unidadeZ, req.body);
    const unidade = await buscarUnidade(db, param(req, 'id'));
    if (!unidade) throw naoEncontrado('Unidade não encontrada.');
    await atualizarUnidade(db, { unidade, req: corpo, agora: agoraDe(ctx), ator: ator(req) });
    const [dto] = await unidadesComAgenda(db, [unidade.id]);
    res.json(dto);
  });

  // ───────────────────────── cultos ─────────────────────────

  r.get('/cultos', async (req, res) => {
    const unidadeId = await unidadeDoUsuario(usuarioLogado(req), textoQuery(req, 'unidade'));
    const de = dataQuery(req, 'de');
    const ate = dataQuery(req, 'ate');
    res.json(await listarCultos(db, unidadeId, de, ate));
  });

  r.post('/cultos/gerar', async (req, res) => {
    const corpo = validar(gerarCultosZ, req.body);
    const unidadeId = await unidadeDoUsuario(usuarioLogado(req), corpo.unidadeId);
    const agenda = await buscarAgenda(db, unidadeId);
    res.json(await gerarCultosDoMes(db, { unidadeId, ano: corpo.ano, mes: corpo.mes, agenda, agora: agoraDe(ctx), ator: ator(req) }));
  });

  r.post('/cultos', async (req, res) => {
    const corpo = validar(cultoNovoZ, req.body);
    if (!dataValida(corpo.data)) throw invalido('Data inválida.');
    const unidadeId = await unidadeDoUsuario(usuarioLogado(req), corpo.unidadeId);
    const agenda = await buscarAgenda(db, unidadeId);
    res.status(201).json(await criarCulto(db, { req: { ...corpo, unidadeId }, agenda, agora: agoraDe(ctx), ator: ator(req) }));
  });

  r.patch('/cultos/:id', async (req, res) => {
    const patch = validar(cultoPatchZ, req.body);
    if (patch.data !== undefined && !dataValida(patch.data)) throw invalido('Data inválida.');
    const culto = await cultoAutorizado(req, param(req, 'id'));
    const agenda = await buscarAgenda(db, culto.unidadeId);
    res.json(await atualizarCulto(db, { culto, patch, agenda, agora: agoraDe(ctx), ator: ator(req) }));
  });

  r.delete('/cultos/:id', async (req, res) => {
    const culto = await cultoAutorizado(req, param(req, 'id'));
    const usuario = usuarioLogado(req);
    if (!ehAdmin(usuario)) {
      // apagar o culto apaga a escala de todos os ministérios: líder só apaga se não houver escala de outro
      const comEscala = await db.selectDistinct({ ministerioId: escalas.ministerioId }).from(escalas).where(eq(escalas.cultoId, culto.id));
      if (comEscala.some((o) => !podeGerir(usuario, o.ministerioId))) {
        throw proibido('Este culto tem escala de outro ministério. Peça ao administrador para apagar.');
      }
    }
    await removerCulto(db, { culto, agora: agoraDe(ctx), ator: ator(req) });
    res.json({ ok: true });
  });

  // ───────────────────────── escala do culto ─────────────────────────

  r.put('/cultos/:cultoId/escala/:ministerioId', async (req, res) => {
    const corpo = validar(escalacaoZ, req.body);
    const { culto, ministerio } = await cultoDoMinisterio(req);
    await substituirEscala(db, { culto, ministerio, req: corpo, agora: agoraDe(ctx), ator: ator(req) });
    res.json(await cultoComEscala(db, ministerio, culto.id));
  });

  r.put('/cultos/:cultoId/vagas/:ministerioId', async (req, res) => {
    const { quantidade } = validar(vagasZ, req.body);
    const { culto, ministerio } = await cultoDoMinisterio(req);
    await definirVagas(db, { culto, ministerio, quantidade, agora: agoraDe(ctx), ator: ator(req) });
    res.json(await cultoComEscala(db, ministerio, culto.id));
  });

  async function escalaAutorizada(req: Request) {
    const escala = await buscarEscala(db, param(req, 'id'));
    if (!escala) throw naoEncontrado('Escala não encontrada.');
    if (!podeGerir(usuarioLogado(req), escala.ministerioId)) throw proibido('Você não tem acesso a este ministério.');
    return escala;
  }

  r.patch('/escalas/:id', async (req, res) => {
    const patch = validar(escalaPatchZ, req.body);
    const escala = await escalaAutorizada(req);
    res.json(await alterarEscala(db, { escala, patch, agora: agoraDe(ctx), ator: ator(req) }));
  });

  r.delete('/escalas/:id', async (req, res) => {
    const escala = await escalaAutorizada(req);
    await removerEscala(db, { escala, agora: agoraDe(ctx), ator: ator(req) });
    res.json({ ok: true });
  });

  // ───────────────────────── equipe ─────────────────────────

  r.get('/membros', async (req, res) => {
    const ministerio = await ministerioDoUsuario(db, usuarioLogado(req), textoQuery(req, 'ministerio'));
    res.json(await membrosLider(db, ministerio.id, urlBase(req), await hojeDaUnidade(ministerio.unidadeId)));
  });

  r.post('/membros', async (req, res) => {
    const corpo = validar(membroZ, req.body);
    const ministerio = await ministerioDoUsuario(db, usuarioLogado(req), corpo.ministerioId);
    const criado = await criarMembro(db, { dados: { ...corpo, ministerioId: ministerio.id }, agora: agoraDe(ctx), ator: ator(req) });
    res.status(201).json(await membroLiderDTO(req, ministerio, criado.id));
  });

  r.patch('/membros/:id', async (req, res) => {
    const patch = validar(membroPatchZ, req.body);
    const { membro, ministerio, vinculado } = await membroAutorizado(req, param(req, 'id'), patch.ministerioId);
    // com ministerioId/papel a pessoa passa a fazer parte do ministério (ex.: trazer alguém de outro ministério)
    if (!vinculado && patch.ministerioId === undefined && patch.papel === undefined) throw naoEncontrado('Pessoa não encontrada neste ministério.');
    await atualizarMembro(db, { membro, patch, ministerioId: ministerio.id, agora: agoraDe(ctx), ator: ator(req) });
    res.json(await membroLiderDTO(req, ministerio, membro.id));
  });

  r.post('/membros/:id/token', async (req, res) => {
    const { membro, ministerio, vinculado } = await membroAutorizado(req, param(req, 'id'), textoQuery(req, 'ministerio'));
    if (!vinculado) throw naoEncontrado('Pessoa não encontrada neste ministério.');
    await novoTokenMembro(db, { membro, ministerioId: ministerio.id, agora: agoraDe(ctx), ator: ator(req) });
    res.json(await membroLiderDTO(req, ministerio, membro.id));
  });

  r.delete('/membros/:id', async (req, res) => {
    const { membro, ministerio, vinculado } = await membroAutorizado(req, param(req, 'id'), textoQuery(req, 'ministerio'));
    if (!vinculado) throw naoEncontrado('Pessoa não encontrada neste ministério.');
    res.json(await removerMembro(db, { membro, ministerioId: ministerio.id, agora: agoraDe(ctx), ator: ator(req) }));
  });

  // ───────────────────────── WhatsApp: importar, exportar, lembretes ─────────────────────────

  r.post('/importar/analisar', async (req, res) => {
    const corpo = validar(importarZ, req.body);
    const ministerio = await ministerioDoUsuario(db, usuarioLogado(req), corpo.ministerioId);
    res.json(await analisarImportacao(db, { ministerio, texto: corpo.texto, agora: agoraDe(ctx) }));
  });

  r.post('/importar/aplicar', async (req, res) => {
    const corpo = validar(importarAplicarZ, req.body);
    const ministerio = await ministerioDoUsuario(db, usuarioLogado(req), corpo.ministerioId);
    res.json(await aplicarImportacao(db, { ministerio, texto: corpo.texto, modo: corpo.modo, criarMembros: corpo.criarMembros, agora: agoraDe(ctx), ator: ator(req) }));
  });

  r.get('/exportar', async (req, res) => {
    const ministerio = await ministerioDoUsuario(db, usuarioLogado(req), textoQuery(req, 'ministerio'));
    const passados = textoQuery(req, 'passados');
    if (passados !== undefined && passados !== '0' && passados !== '1') throw invalido('Use passados=0 ou passados=1.');
    res.json(await exportarEscala(db, {
      ministerio, base: urlBase(req), agora: agoraDe(ctx),
      de: dataQuery(req, 'de'), ate: dataQuery(req, 'ate'), incluirPassados: passados === '1',
    }));
  });

  r.get('/lembretes', async (req, res) => {
    const ministerio = await ministerioDoUsuario(db, usuarioLogado(req), textoQuery(req, 'ministerio'));
    const dias = inteiroQuery(req, 'dias', 7, 1, 60);
    res.json(await listarLembretes(db, { ministerio, dias, base: urlBase(req), agora: agoraDe(ctx) }));
  });

  // ───────────────────────── trocas ─────────────────────────

  r.post('/trocas/:id/resolver', async (req, res) => {
    const corpo = validar(resolverTrocaZ, req.body);
    const troca = await buscarTroca(db, param(req, 'id'));
    if (!troca) throw naoEncontrado('Troca não encontrada.');
    const escala = await buscarEscala(db, troca.escalaId);
    if (!escala) throw naoEncontrado('Troca não encontrada.');
    if (!podeGerir(usuarioLogado(req), escala.ministerioId)) throw proibido('Você não tem acesso a este ministério.');
    const culto = await buscarCulto(db, escala.cultoId);
    await resolverTroca(db, {
      troca, acao: corpo.acao, substitutoId: corpo.substitutoId,
      fuso: culto ? await fusoDaUnidade(culto.unidadeId) : FUSO_PADRAO, agora: agoraDe(ctx), ator: ator(req),
    });
    res.json(await trocaPorId(db, troca.id));
  });

  // ───────────────────────── histórico ─────────────────────────

  r.get('/registros', async (req, res) => {
    const usuario = usuarioLogado(req);
    const pedido = textoQuery(req, 'ministerio');
    if (pedido) await ministerioDoUsuario(db, usuario, pedido);
    res.json(await listarRegistros(db, {
      ministerioId: pedido,
      ministeriosVisiveis: ehAdmin(usuario) ? null : usuario.ministerios,
      usuarioId: usuario.id,
      limite: inteiroQuery(req, 'limite', 50, 1, 200),
    }));
  });

  // ───────────────────────── contas (admin) ─────────────────────────

  r.get('/usuarios', exigirAdmin, async (_req, res) => {
    res.json(await listarUsuarios(db));
  });

  r.post('/usuarios', exigirAdmin, async (req, res) => {
    const corpo = validar(usuarioZ, req.body);
    res.status(201).json(await criarUsuario(db, { req: corpo, agora: agoraDe(ctx), ator: ator(req) }));
  });

  r.patch('/usuarios/:id', exigirAdmin, async (req, res) => {
    const patch = validar(usuarioPatchZ, req.body);
    const alvo = await buscarUsuario(db, param(req, 'id'));
    if (!alvo) throw naoEncontrado('Conta não encontrada.');
    res.json(await atualizarUsuario(db, { alvo, patch, agora: agoraDe(ctx), ator: ator(req) }));
  });

  return r;
}
