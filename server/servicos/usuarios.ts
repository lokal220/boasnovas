/**
 * Contas de líderes e administradores (admin): criar com senha inicial aleatória (deveTrocarSenha),
 * alterar papel/ministérios/ativo — sempre sobrando pelo menos um administrador ativo.
 */
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { UsuarioDTO, UsuarioReq } from '@shared/api';
import { membros, ministerios, usuarios } from '@shared/schema';
import type { Banco } from '../db';
import { paraUsuarioDTO } from '../auth/middleware';
import { encerrarSessoesDoUsuario, type LinhaUsuario } from '../auth/sessao';
import { gerarHashSenha, gerarSenhaAleatoria } from '../auth/senha';
import { conflito, invalido } from '../http';
import { compararNomes } from './dominio';
import { registrar, type Ator } from './registros';

export async function listarUsuarios(db: Banco): Promise<UsuarioDTO[]> {
  const linhas = await db.select().from(usuarios);
  return linhas.sort((a, b) => compararNomes(a.nome, b.nome)).map(paraUsuarioDTO);
}

export async function buscarUsuario(db: Banco, id: string): Promise<LinhaUsuario | null> {
  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
  return u ?? null;
}

async function validarMinisterios(db: Banco, ids: string[] | undefined): Promise<string[] | undefined> {
  if (ids === undefined) return undefined;
  const unicos = [...new Set(ids)];
  if (!unicos.length) return [];
  const achados = new Set((await db.select({ id: ministerios.id }).from(ministerios).where(inArray(ministerios.id, unicos))).map((l) => l.id));
  const faltando = unicos.filter((id) => !achados.has(id));
  if (faltando.length) throw invalido('Ministério não encontrado.', { ministerios: faltando });
  return unicos;
}

async function validarMembro(db: Banco, membroId: string | null | undefined): Promise<string | null | undefined> {
  if (membroId === undefined || membroId === null) return membroId;
  const [m] = await db.select({ id: membros.id }).from(membros).where(eq(membros.id, membroId)).limit(1);
  if (!m) throw invalido('Pessoa não encontrada.');
  return m.id;
}

async function loginLivre(db: Banco, login: string, exceto?: string): Promise<void> {
  const [outro] = await db.select({ id: usuarios.id }).from(usuarios)
    .where(exceto ? and(eq(usuarios.login, login), ne(usuarios.id, exceto)) : eq(usuarios.login, login)).limit(1);
  if (outro) throw conflito('Esse login já está em uso.');
}

export async function criarUsuario(db: Banco, a: { req: UsuarioReq; agora: Date; ator: Ator }): Promise<{ usuario: UsuarioDTO; senhaInicial: string }> {
  const { req } = a;
  await loginLivre(db, req.login);
  const ministeriosIds = (await validarMinisterios(db, req.ministerios)) ?? [];
  const membroId = (await validarMembro(db, req.membroId)) ?? null;
  const senhaInicial = gerarSenhaAleatoria();
  const senhaHash = await gerarHashSenha(senhaInicial);
  const criado = await db.transaction(async (tx) => {
    const [u] = await tx.insert(usuarios).values({
      id: randomUUID(), nome: req.nome, login: req.login, senhaHash, papel: req.papel, ministerios: ministeriosIds,
      membroId, deveTrocarSenha: true, ativo: true, criadoEm: a.agora,
    }).onConflictDoNothing().returning();
    if (!u) throw conflito('Esse login já está em uso.');
    await registrar(tx, { ator: a.ator, acao: 'usuario.criar', alvo: u.id, quando: a.agora, dados: { login: u.login, papel: u.papel, ministerios: ministeriosIds } });
    return u;
  });
  return { usuario: paraUsuarioDTO(criado), senhaInicial };
}

export async function atualizarUsuario(db: Banco, a: { alvo: LinhaUsuario; patch: Partial<UsuarioReq> & { ativo?: boolean }; agora: Date; ator: Ator }): Promise<UsuarioDTO> {
  const { alvo, patch } = a;
  if (patch.login !== undefined && patch.login !== alvo.login) await loginLivre(db, patch.login, alvo.id);
  const ministeriosIds = await validarMinisterios(db, patch.ministerios);
  const membroId = await validarMembro(db, patch.membroId);
  const campos: Partial<LinhaUsuario> = {};
  if (patch.nome !== undefined) campos.nome = patch.nome;
  if (patch.login !== undefined) campos.login = patch.login;
  if (patch.papel !== undefined) campos.papel = patch.papel;
  if (ministeriosIds !== undefined) campos.ministerios = ministeriosIds;
  if (membroId !== undefined) campos.membroId = membroId;
  if (patch.ativo !== undefined) campos.ativo = patch.ativo;
  if (!Object.keys(campos).length) return paraUsuarioDTO(alvo);

  const deixaDeSerAdmin = alvo.papel === 'admin' && alvo.ativo && ((campos.papel !== undefined && campos.papel !== 'admin') || campos.ativo === false);
  const atualizado = await db.transaction(async (tx) => {
    if (deixaDeSerAdmin) {
      const outros = await tx.select({ id: usuarios.id }).from(usuarios)
        .where(and(eq(usuarios.papel, 'admin'), eq(usuarios.ativo, true), ne(usuarios.id, alvo.id))).limit(1);
      if (!outros.length) throw conflito('Precisa haver pelo menos um administrador ativo.');
    }
    const [u] = await tx.update(usuarios).set(campos).where(eq(usuarios.id, alvo.id)).returning();
    if (campos.ativo === false) await encerrarSessoesDoUsuario(tx, alvo.id);
    await registrar(tx, { ator: a.ator, acao: 'usuario.alterar', alvo: alvo.id, quando: a.agora, dados: { login: u?.login ?? alvo.login, campos: Object.keys(campos) } });
    return u ?? alvo;
  });
  return paraUsuarioDTO(atualizado);
}
