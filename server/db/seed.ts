/**
 * npm run db:seed            → semeia os dados reais (unidade, Altar, membros, 25 cultos) se o banco estiver vazio.
 * npm run db:seed -- --forcar → apaga os dados das escalas (unidades, ministérios, membros, cultos, escalas, trocas,
 *                               histórico) e semeia de novo. As contas de líder/admin são mantidas.
 * Com o banco embutido (PGlite), pare o servidor antes: a pasta de dados só aceita um processo por vez.
 */
import path from 'node:path';
import { env } from '../env';
import { abrirBanco, type Banco } from './index';
import { prepararDados } from './inicializar';
import {
  agendaFixa, cultos, escalas, membros, ministerioMembros, ministerios, registros, trocas, unidades, vagas,
} from '@shared/schema';

async function apagarDados(db: Banco): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(trocas);
    await tx.delete(escalas);
    await tx.delete(vagas);
    await tx.delete(cultos);
    await tx.delete(ministerioMembros);
    await tx.delete(membros);
    await tx.delete(ministerios);
    await tx.delete(agendaFixa);
    await tx.delete(unidades);
    await tx.delete(registros);
  });
}

async function principal(): Promise<void> {
  const forcar = process.argv.includes('--forcar');
  const conexao = await abrirBanco(env.databaseUrl ? { url: env.databaseUrl } : { diretorio: path.join(env.diretorioDados, 'pglite') });
  try {
    if (forcar) {
      await apagarDados(conexao.db);
      console.log('[seed] dados apagados (contas de acesso mantidas).');
    }
    const [algum] = await conexao.db.select({ id: membros.id }).from(membros).limit(1);
    if (algum) {
      console.log('[seed] o banco já tem dados; nada a fazer. Use "npm run db:seed -- --forcar" para recomeçar do zero.');
      return;
    }
    await prepararDados(conexao.db, { semear: true });
    console.log(`[seed] pronto (banco: ${conexao.tipo}).`);
  } finally {
    await conexao.fechar();
  }
}

principal().catch((erro: unknown) => {
  console.error('[seed] falhou:', erro);
  process.exit(1);
});
