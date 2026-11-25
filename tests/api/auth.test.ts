import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { registros, sessoes, usuarios } from '@shared/schema';
import { hashToken } from '../../server/auth/sessao';
import { verificarSenha, gerarHashSenha } from '../../server/auth/senha';
import { criarAmbiente, criarConta, entrar, SENHA_TESTE, type Ambiente } from './_ambiente';

let amb: Ambiente;

beforeAll(async () => {
  amb = await criarAmbiente();
  await criarConta(amb.db, { login: 'admin', papel: 'admin', nome: 'Administrador' });
  await criarConta(amb.db, { login: 'romulo', papel: 'lider', ministerios: ['altar'], nome: 'Rômulo', deveTrocarSenha: true });
  await criarConta(amb.db, { login: 'inativo', papel: 'lider', ministerios: ['altar'], ativo: false });
});
afterAll(async () => { await amb.fechar(); });

function cookieDe(res: request.Response): string {
  const lista = res.headers['set-cookie'] as unknown as string[] | undefined;
  return (lista ?? []).find((c) => c.startsWith('bn_sessao=')) ?? '';
}

describe('senhas (scrypt)', () => {
  it('grava no formato scrypt$N$r$p$sal$hash e confere com timingSafeEqual', async () => {
    const hash = await gerarHashSenha('uma senha qualquer');
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(Buffer.from(hash.split('$')[4]!, 'base64')).toHaveLength(16);
    expect(Buffer.from(hash.split('$')[5]!, 'base64')).toHaveLength(64);
    expect(await verificarSenha('uma senha qualquer', hash)).toBe(true);
    expect(await verificarSenha('outra senha', hash)).toBe(false);
    expect(await verificarSenha('x', 'lixo')).toBe(false);
  });
});

describe('POST /api/auth/entrar', () => {
  it('entra, devolve o UsuarioDTO e grava só o hash da sessão', async () => {
    const res = await request(amb.app).post('/api/auth/entrar').set('X-BN', '1').send({ login: 'Romulo', senha: SENHA_TESTE });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: expect.any(String), nome: 'Rômulo', login: 'romulo', papel: 'lider', ministerios: ['altar'], deveTrocarSenha: true, ativo: true,
    });
    expect(res.body).not.toHaveProperty('senhaHash');
    const cookie = cookieDe(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=2592000/);
    const token = decodeURIComponent(cookie.split(';')[0]!.split('=')[1]!);
    const [sessao] = await amb.db.select().from(sessoes).where(eq(sessoes.id, hashToken(token)));
    expect(sessao).toBeDefined();
    expect(sessao!.expiraEm.getTime() - sessao!.criadoEm.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    const nenhumaEmTextoClaro = await amb.db.select().from(sessoes).where(eq(sessoes.id, token));
    expect(nenhumaEmTextoClaro).toHaveLength(0);
  });

  it('recusa senha errada, login inexistente e conta desativada com a mesma mensagem', async () => {
    for (const corpo of [{ login: 'romulo', senha: 'errada' }, { login: 'ninguem', senha: SENHA_TESTE }, { login: 'inativo', senha: SENHA_TESTE }]) {
      const res = await request(amb.app).post('/api/auth/entrar').set('X-BN', '1').send(corpo);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ erro: 'Login ou senha incorretos.' });
    }
  });

  it('valida o corpo (400) e exige o cabeçalho X-BN (403)', async () => {
    const semCampos = await request(amb.app).post('/api/auth/entrar').set('X-BN', '1').send({});
    expect(semCampos.status).toBe(400);
    expect(typeof semCampos.body.erro).toBe('string');
    const semCabecalho = await request(amb.app).post('/api/auth/entrar').send({ login: 'romulo', senha: SENHA_TESTE });
    expect(semCabecalho.status).toBe(403);
    const jsonQuebrado = await request(amb.app).post('/api/auth/entrar').set('X-BN', '1').set('Content-Type', 'application/json').send('{"login":');
    expect(jsonQuebrado.status).toBe(400);
  });

  it('limita 10 tentativas erradas por IP em 15 minutos (429), sem afetar outro IP', async () => {
    const ip = '203.0.113.7';
    for (let i = 0; i < 10; i++) {
      const res = await request(amb.app).post('/api/auth/entrar').set('X-BN', '1').set('X-Forwarded-For', ip).send({ login: 'romulo', senha: `errada-${i}` });
      expect(res.status).toBe(401);
    }
    const bloqueado = await request(amb.app).post('/api/auth/entrar').set('X-BN', '1').set('X-Forwarded-For', ip).send({ login: 'romulo', senha: SENHA_TESTE });
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.erro).toMatch(/Muitas tentativas/);
    const outroIp = await request(amb.app).post('/api/auth/entrar').set('X-BN', '1').set('X-Forwarded-For', '203.0.113.8').send({ login: 'romulo', senha: SENHA_TESTE });
    expect(outroIp.status).toBe(200);
  });
});

describe('sessão: /api/auth/eu e /api/auth/sair', () => {
  it('sem cookie → 401; com sessão → usuário; sair apaga a sessão', async () => {
    expect((await request(amb.app).get('/api/auth/eu')).status).toBe(401);
    const agente = await entrar(amb.app, 'admin');
    const eu = await agente.get('/api/auth/eu');
    expect(eu.status).toBe(200);
    expect(eu.body.login).toBe('admin');
    expect(eu.body.papel).toBe('admin');
    const antes = await amb.db.select().from(sessoes);
    const sair = await agente.post('/api/auth/sair').set('X-BN', '1');
    expect(sair.status).toBe(200);
    expect(sair.body).toEqual({ ok: true });
    expect(cookieDe(sair)).toMatch(/bn_sessao=;/);
    expect((await amb.db.select().from(sessoes)).length).toBe(antes.length - 1);
    expect((await agente.get('/api/auth/eu')).status).toBe(401);
  });

  it('cookie forjado ou vencido não vale', async () => {
    const res = await request(amb.app).get('/api/auth/eu').set('Cookie', 'bn_sessao=inventado');
    expect(res.status).toBe(401);
    const agente = await entrar(amb.app, 'admin');
    amb.definirAgora('2026-12-30T15:00:00Z'); // 35 dias depois
    expect((await agente.get('/api/auth/eu')).status).toBe(401);
    amb.definirAgora('2026-11-25T15:00:00Z');
  });

  it('conta desativada perde o acesso na hora', async () => {
    const id = await criarConta(amb.db, { login: 'temporario', papel: 'lider', ministerios: ['altar'] });
    const agente = await entrar(amb.app, 'temporario');
    expect((await agente.get('/api/auth/eu')).status).toBe(200);
    await amb.db.update(usuarios).set({ ativo: false }).where(eq(usuarios.id, id));
    expect((await agente.get('/api/auth/eu')).status).toBe(401);
  });
});

describe('POST /api/auth/senha', () => {
  it('troca a senha, tira o deveTrocarSenha e encerra as outras sessões', async () => {
    await criarConta(amb.db, { login: 'guilherme', papel: 'lider', ministerios: ['altar'], deveTrocarSenha: true });
    const celular = await entrar(amb.app, 'guilherme');
    const computador = await entrar(amb.app, 'guilherme');

    const errada = await celular.post('/api/auth/senha').set('X-BN', '1').send({ senhaAtual: 'nao-e-esta', novaSenha: 'nova-senha-forte' });
    expect(errada.status).toBe(400);
    expect(errada.body.erro).toMatch(/senha atual/i);
    const curta = await celular.post('/api/auth/senha').set('X-BN', '1').send({ senhaAtual: SENHA_TESTE, novaSenha: 'curta' });
    expect(curta.status).toBe(400);
    expect(curta.body.erro).toBe('A senha precisa de pelo menos 8 caracteres.');
    const igual = await celular.post('/api/auth/senha').set('X-BN', '1').send({ senhaAtual: SENHA_TESTE, novaSenha: SENHA_TESTE });
    expect(igual.status).toBe(400);

    const ok = await celular.post('/api/auth/senha').set('X-BN', '1').send({ senhaAtual: SENHA_TESTE, novaSenha: 'nova-senha-forte' });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ ok: true });
    const eu = await celular.get('/api/auth/eu');
    expect(eu.status).toBe(200);
    expect(eu.body.deveTrocarSenha).toBe(false);
    expect((await computador.get('/api/auth/eu')).status).toBe(401);

    const velha = await request(amb.app).post('/api/auth/entrar').set('X-BN', '1').send({ login: 'guilherme', senha: SENHA_TESTE });
    expect(velha.status).toBe(401);
    await entrar(amb.app, 'guilherme', 'nova-senha-forte');
    const [registro] = await amb.db.select().from(registros).where(eq(registros.acao, 'auth.trocar_senha'));
    expect(registro).toBeDefined();
  });

  it('exige sessão', async () => {
    const res = await request(amb.app).post('/api/auth/senha').set('X-BN', '1').send({ senhaAtual: 'a', novaSenha: 'bbbbbbbbbb' });
    expect(res.status).toBe(401);
  });
});
