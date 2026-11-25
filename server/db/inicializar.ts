/**
 * Dados iniciais no boot (SPEC §3):
 * - garante a unidade BN Estoril com a agenda fixa quando não há nenhuma unidade (sem ela o sistema não funciona);
 * - com o banco vazio e SEMEAR_DADOS ≠ false, semeia o ministério Altar, os 20 membros de seed/membros.json e os
 *   25 cultos de 18/11 a 30/12/2026 com as escalas de seed/esperado.json (origem importacao, confirmado);
 * - garante o primeiro administrador (ADMIN_LOGIN/ADMIN_SENHA; sem senha, gera uma e mostra UMA vez no console,
 *   junto com o link do grupo do altar).
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Turno } from '@shared/api';
import { agendaFixa, cultos, escalas, membros, ministerioMembros, ministerios, unidades, usuarios } from '@shared/schema';
import membrosSeed from '../../seed/membros.json';
import esperadoSeed from '../../seed/esperado.json';
import type { Banco } from './index';
import { env } from '../env';
import { gerarHashSenha, gerarSenhaAleatoria } from '../auth/senha';
import { AVISO_VESPERA } from '@shared/dominio/whatsapp/exportar';
import { diaSemana, idCulto } from '../servicos/dominio';
import { registrar, ATOR_SISTEMA } from '../servicos/registros';
import { gerarToken, linkPublico, urlBaseDoAmbiente } from '../servicos/tokens';

interface MembroSeed { id: string; nome: string; apelidos: string[]; escalas: string[]; lider: boolean; ativo: boolean }
interface CultoSeed { id: string; data: string; turno: Turno; evento: string; lider: string; servos: string[] }
interface EsperadoSeed { escala: string; aviso: string; cultos: CultoSeed[] }

export const UNIDADE_PADRAO = {
  id: 'bn-estoril',
  nome: 'BN Estoril',
  endereco: 'Av. Barão Homem de Melo, 2588, Estoril · BH',
  fusoHorario: 'America/Sao_Paulo',
} as const;

/** Agenda fixa da BN Estoril (bio do Instagram): Dom 10h, 17h e 19h30 | Terça 14h | Quarta 19h30. */
export const AGENDA_PADRAO: { diaSemana: number; hora: string; turno: Turno; rotulo: string }[] = [
  { diaSemana: 0, hora: '10h', turno: 'manha', rotulo: '' },
  { diaSemana: 0, hora: '17h', turno: 'tarde', rotulo: '' },
  { diaSemana: 0, hora: '19h30', turno: 'noite', rotulo: '' },
  { diaSemana: 2, hora: '14h', turno: 'tarde', rotulo: 'tarde da benção' },
  { diaSemana: 3, hora: '19h30', turno: 'unico', rotulo: '' },
];


/** Cria a unidade padrão com a agenda fixa, se ainda não houver nenhuma unidade. Devolve true se criou. */
export async function garantirUnidade(db: Banco): Promise<boolean> {
  const [existe] = await db.select({ id: unidades.id }).from(unidades).limit(1);
  if (existe) return false;
  await db.transaction(async (tx) => {
    await tx.insert(unidades).values({ ...UNIDADE_PADRAO });
    await tx.insert(agendaFixa).values(AGENDA_PADRAO.map((a) => ({ unidadeId: UNIDADE_PADRAO.id, ...a, ativo: true })));
  });
  return true;
}

export interface OpcoesSemente {
  /** semeia também os 25 cultos com as escalas (padrão: true) */
  cultos?: boolean;
  agora?: Date;
}

/**
 * Semeia o ministério Altar, os membros e (opcionalmente) os cultos/escalas reais.
 * Supõe a unidade padrão criada e nenhum ministério 'altar'. Devolve o token do link do grupo.
 */
export async function semearDadosIniciais(db: Banco, opcoes: OpcoesSemente = {}): Promise<{ tokenAltar: string }> {
  const agora = opcoes.agora ?? new Date();
  const esperado = esperadoSeed as EsperadoSeed;
  const lista = membrosSeed as MembroSeed[];
  const tokenAltar = gerarToken();
  await db.transaction(async (tx) => {
    const agenda = await tx.select().from(agendaFixa).where(eq(agendaFixa.unidadeId, UNIDADE_PADRAO.id));
    const horaDe = (diaSemana: number, turno: Turno) => agenda.find((a) => a.diaSemana === diaSemana && a.turno === turno)?.hora ?? '';
    // o altar serve Quarta 19h30 e os três cultos de domingo (a terça 14h fica de fora)
    const horarios = agenda
      .filter((a) => (a.diaSemana === 3 && a.turno === 'unico') || (a.diaSemana === 0 && ['manha', 'tarde', 'noite'].includes(a.turno)))
      .map((a) => a.id);
    await tx.insert(ministerios).values({
      id: 'altar', unidadeId: UNIDADE_PADRAO.id, nome: 'Altar', descricao: 'Homens que servem no altar', icone: 'maos',
      vagasPadrao: 3, acesso: 'aberto', tokenPublico: tokenAltar, horarios, aviso: AVISO_VESPERA, whatsappLider: '', ativo: true,
      criadoEm: agora,
    });
    await tx.insert(membros).values(lista.map((m) => ({
      id: m.id, nome: m.nome, apelidos: m.apelidos, telefone: '', ativo: m.ativo, tokenAcesso: gerarToken(), criadoEm: agora,
    })));
    await tx.insert(ministerioMembros).values(lista.filter((m) => m.escalas.includes('altar')).map((m) => ({
      ministerioId: 'altar', membroId: m.id, papel: m.lider ? 'lider' : 'servo', criadoEm: agora,
    })));

    if (opcoes.cultos !== false) {
      const linhasCultos = esperado.cultos.map((c) => {
        return {
          id: idCulto(UNIDADE_PADRAO.id, c.data, c.turno), unidadeId: UNIDADE_PADRAO.id, data: c.data, turno: c.turno,
          hora: horaDe(diaSemana(c.data), c.turno), titulo: c.evento, extra: false, nota: '', criadoEm: agora,
        };
      });
      await tx.insert(cultos).values(linhasCultos);
      const linhasEscalas: (typeof escalas.$inferInsert)[] = [];
      esperado.cultos.forEach((c, i) => {
        const cultoId = linhasCultos[i]!.id;
        const pessoas = [...(c.lider ? [{ id: c.lider, papel: 'lider' }] : []), ...c.servos.map((id) => ({ id, papel: 'servo' }))];
        pessoas.forEach((p, ordem) => linhasEscalas.push({
          id: randomUUID(), cultoId, ministerioId: 'altar', membroId: p.id, papel: p.papel, funcao: '', status: 'confirmado',
          origem: 'importacao', ordem, criadoEm: agora, atualizadoEm: agora,
        }));
      });
      if (linhasEscalas.length) await tx.insert(escalas).values(linhasEscalas);
    }
    await registrar(tx, {
      ator: ATOR_SISTEMA, acao: 'dados.semear', alvo: 'altar', ministerioId: 'altar', quando: agora,
      dados: { membros: lista.length, cultos: opcoes.cultos === false ? 0 : esperado.cultos.length },
    });
  });
  return { tokenAltar };
}

/** Cria o primeiro administrador se não houver nenhum. Devolve a senha gerada (só quando gerou). */
export async function garantirAdmin(db: Banco): Promise<{ criado: boolean; login: string; senhaGerada: string | null }> {
  const [admin] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.papel, 'admin')).limit(1);
  if (admin) return { criado: false, login: env.adminLogin, senhaGerada: null };
  const [mesmoLogin] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.login, env.adminLogin)).limit(1);
  if (mesmoLogin) {
    console.warn(`[boasnovas] Nenhum administrador ativo, mas o login "${env.adminLogin}" já existe como líder. Defina outro ADMIN_LOGIN.`);
    return { criado: false, login: env.adminLogin, senhaGerada: null };
  }
  const senhaGerada = env.adminSenha ? null : gerarSenhaAleatoria();
  await db.insert(usuarios).values({
    id: randomUUID(), nome: env.adminNome, login: env.adminLogin, senhaHash: await gerarHashSenha(env.adminSenha || senhaGerada!),
    papel: 'admin', ministerios: [], deveTrocarSenha: !env.adminSenha, ativo: true,
  });
  return { criado: true, login: env.adminLogin, senhaGerada };
}

/** Prepara o banco no boot: garante o primeiro administrador e semeia os dados reais quando vazio. */
export async function prepararDados(db: Banco, opcoes: { semear: boolean; silencioso?: boolean }): Promise<void> {
  const unidadeCriada = await garantirUnidade(db);
  let tokenAltar: string | null = null;
  if (opcoes.semear) {
    const [algumMinisterio] = await db.select({ id: ministerios.id }).from(ministerios).limit(1);
    const [algumMembro] = await db.select({ id: membros.id }).from(membros).limit(1);
    if (!algumMinisterio && !algumMembro) ({ tokenAltar } = await semearDadosIniciais(db));
  }
  const admin = await garantirAdmin(db);
  if (opcoes.silencioso) return;

  const linhas: string[] = [];
  if (unidadeCriada) linhas.push(`Unidade criada: ${UNIDADE_PADRAO.nome} (agenda fixa: Dom 10h, 17h e 19h30 | Terça 14h | Quarta 19h30).`);
  if (admin.criado) {
    linhas.push(`Administrador criado: login "${admin.login}".`);
    if (admin.senhaGerada) {
      linhas.push(`Senha provisória (aparece só agora): ${admin.senhaGerada}`);
      linhas.push('Entre em /lider e troque a senha no primeiro acesso. Para escolher a senha, use ADMIN_SENHA nos Secrets.');
    }
  }
  if (tokenAltar) {
    linhas.push('Escala real do altar carregada (20 membros, 25 cultos de 18/11 a 30/12/2026).');
    linhas.push(`Link do grupo do altar: ${linkPublico(urlBaseDoAmbiente(), tokenAltar)}`);
  }
  if (linhas.length) {
    const borda = '─'.repeat(72);
    console.log(['', borda, ...linhas.map((l) => `  ${l}`), borda, ''].join('\n'));
  }
}
