/**
 * Ambiente dos testes da API: PGlite em memória + app com relógio controlado + contas de teste.
 * (arquivo auxiliar; não é uma suíte — o vitest só roda *.test.ts)
 */
import request from 'supertest';
import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { abrirBanco, type Banco, type ConexaoBanco } from '../../server/db';
import { criarApp } from '../../server/app';
import { garantirUnidade, semearDadosIniciais } from '../../server/db/inicializar';
import { gerarHashSenha } from '../../server/auth/senha';
import { membros, ministerios, usuarios } from '@shared/schema';

/** Quarta-feira, 25/11/2026, 12h em Belo Horizonte. */
export const AGORA = new Date('2026-11-25T15:00:00Z');
export const SENHA_TESTE = 'senha-de-teste-123';

export interface Ambiente {
  conexao: ConexaoBanco;
  db: Banco;
  app: Express;
  tokenAltar: string;
  /** muda o relógio do app */
  definirAgora: (instante: Date | string) => void;
  fechar: () => Promise<void>;
}

export async function criarAmbiente(opcoes: { semear?: boolean; cultos?: boolean } = {}): Promise<Ambiente> {
  const conexao = await abrirBanco({ memoria: true });
  let agora = AGORA;
  await garantirUnidade(conexao.db);
  let tokenAltar = '';
  if (opcoes.semear !== false) ({ tokenAltar } = await semearDadosIniciais(conexao.db, { cultos: opcoes.cultos, agora: AGORA }));
  const app = criarApp({ db: conexao.db, agora: () => agora });
  return {
    conexao, db: conexao.db, app, tokenAltar,
    definirAgora: (instante) => { agora = new Date(instante); },
    fechar: () => conexao.fechar(),
  };
}

export async function criarConta(db: Banco, dados: { login: string; papel: 'admin' | 'lider'; ministerios?: string[]; nome?: string; deveTrocarSenha?: boolean; ativo?: boolean }): Promise<string> {
  const id = randomUUID();
  await db.insert(usuarios).values({
    id, nome: dados.nome ?? dados.login, login: dados.login, senhaHash: await gerarHashSenha(SENHA_TESTE),
    papel: dados.papel, ministerios: dados.ministerios ?? [], deveTrocarSenha: dados.deveTrocarSenha ?? false, ativo: dados.ativo ?? true,
  });
  return id;
}

/** Entra com a conta e devolve um agente do supertest que guarda o cookie. */
export async function entrar(app: Express, login: string, senha = SENHA_TESTE): Promise<ReturnType<typeof request.agent>> {
  const agente = request.agent(app);
  const res = await agente.post('/api/auth/entrar').set('X-BN', '1').send({ login, senha });
  if (res.status !== 200) throw new Error(`login falhou (${res.status}): ${JSON.stringify(res.body)}`);
  return agente;
}

export async function tokenDoMembro(db: Banco, id: string): Promise<string> {
  const [m] = await db.select({ token: membros.tokenAcesso }).from(membros).where(eq(membros.id, id));
  if (!m) throw new Error(`membro ${id} não existe`);
  return m.token;
}

export async function tokenDoMinisterio(db: Banco, id: string): Promise<string> {
  const [m] = await db.select({ token: ministerios.tokenPublico }).from(ministerios).where(eq(ministerios.id, id));
  if (!m) throw new Error(`ministério ${id} não existe`);
  return m.token;
}
