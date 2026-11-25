import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { abrirBanco, type ConexaoBanco } from '../../server/db';
import { criarApp } from '../../server/app';
import { unidades } from '@shared/schema';

let conexao: ConexaoBanco;

beforeAll(async () => { conexao = await abrirBanco({ memoria: true }); });
afterAll(async () => { await conexao.fechar(); });

describe('base do servidor', () => {
  it('responde /api/saude', async () => {
    const app = criarApp({ db: conexao.db });
    const res = await request(app).get('/api/saude');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('aplica as migrações no PGlite em memória', async () => {
    await conexao.db.insert(unidades).values({ id: 'teste', nome: 'Teste' });
    const linhas = await conexao.db.select().from(unidades);
    expect(linhas).toHaveLength(1);
  });

  it('recusa alteração sem o cabeçalho X-BN', async () => {
    const app = criarApp({ db: conexao.db });
    const res = await request(app).post('/api/qualquer').send({});
    expect(res.status).toBe(403);
  });
});
