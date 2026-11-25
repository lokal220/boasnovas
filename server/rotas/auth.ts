/**
 * Autenticação do líder: entrar (cookie bn_sessao), sair, quem sou eu e trocar a senha.
 */
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { usuarios } from '@shared/schema';
import { entrarZ, trocarSenhaZ } from '@shared/validacao';
import type { ContextoApp } from '../app';
import { exigirLogin, lerTokenSessao, paraUsuarioDTO, usuarioLogado } from '../auth/middleware';
import { gerarHashSenha, hashParaComparacaoVazia, verificarSenha } from '../auth/senha';
import {
  COOKIE_SESSAO, criarSessao, encerrarSessao, encerrarSessoesDoUsuario, opcoesCookieSessao, opcoesLimparCookie,
} from '../auth/sessao';
import { agoraDe, ErroHttp, invalido, validar } from '../http';
import { atorUsuario, registrar } from '../servicos/registros';
import { limiteLogin } from './limites';

export function rotasAuth(ctx: ContextoApp): Router {
  const r = Router();
  const { db } = ctx;

  r.post('/entrar', limiteLogin(), async (req, res) => {
    const { login, senha } = validar(entrarZ, req.body);
    const [usuario] = await db.select().from(usuarios).where(eq(usuarios.login, login)).limit(1);
    // mesmo sem usuário, gasta o tempo de uma verificação (não revela quais logins existem)
    const confere = await verificarSenha(senha, usuario?.senhaHash ?? (await hashParaComparacaoVazia()));
    if (!usuario || !confere || !usuario.ativo) throw new ErroHttp(401, 'Login ou senha incorretos.');
    const agora = agoraDe(ctx);
    const token = await criarSessao(db, usuario.id, agora);
    await db.update(usuarios).set({ ultimoAcessoEm: agora }).where(eq(usuarios.id, usuario.id));
    await registrar(db, { ator: atorUsuario(usuario.id), acao: 'auth.entrar', alvo: usuario.id, quando: agora, dados: { login: usuario.login } });
    res.cookie(COOKIE_SESSAO, token, opcoesCookieSessao());
    res.json(paraUsuarioDTO(usuario));
  });

  r.post('/sair', async (req, res) => {
    const token = lerTokenSessao(req);
    if (token) await encerrarSessao(db, token);
    res.clearCookie(COOKIE_SESSAO, opcoesLimparCookie());
    res.json({ ok: true });
  });

  r.get('/eu', exigirLogin(ctx), (req, res) => {
    res.json(paraUsuarioDTO(usuarioLogado(req)));
  });

  r.post('/senha', exigirLogin(ctx), async (req, res) => {
    const usuario = usuarioLogado(req);
    const { senhaAtual, novaSenha } = validar(trocarSenhaZ, req.body);
    if (!(await verificarSenha(senhaAtual, usuario.senhaHash))) throw invalido('A senha atual não confere.');
    if (senhaAtual === novaSenha) throw invalido('A nova senha precisa ser diferente da atual.');
    const agora = agoraDe(ctx);
    await db.update(usuarios).set({ senhaHash: await gerarHashSenha(novaSenha), deveTrocarSenha: false }).where(eq(usuarios.id, usuario.id));
    // outras sessões abertas (outros aparelhos) saem; esta continua
    await encerrarSessoesDoUsuario(db, usuario.id, req.tokenSessao);
    await registrar(db, { ator: atorUsuario(usuario.id), acao: 'auth.trocar_senha', alvo: usuario.id, quando: agora, dados: {} });
    res.json({ ok: true });
  });

  return r;
}
