import http from 'node:http';
import path from 'node:path';
import { env } from './env';
import { abrirBanco } from './db';
import { prepararDados } from './db/inicializar';
import { criarApp } from './app';
import { configurarCliente } from './vite';

async function iniciar(): Promise<void> {
  const conexao = await abrirBanco(env.databaseUrl
    ? { url: env.databaseUrl }
    : { diretorio: path.join(env.diretorioDados, 'pglite') });
  if (conexao.tipo === 'pglite') {
    console.warn('[banco] Sem DATABASE_URL: usando o banco embutido em .data/ (bom para testar; em produção use o PostgreSQL do Replit).');
  }
  await prepararDados(conexao.db, { semear: env.semearDados });

  const app = criarApp({ db: conexao.db });
  const servidor = http.createServer(app);
  await configurarCliente(app, servidor);
  servidor.listen(env.porta, '0.0.0.0', () => {
    console.log(`[boasnovas] pronto em http://localhost:${env.porta} (${env.producao ? 'produção' : 'desenvolvimento'}, banco: ${conexao.tipo})`);
  });

  const encerrar = async () => {
    servidor.close();
    await conexao.fechar().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

iniciar().catch((erro) => {
  console.error('[boasnovas] falha ao iniciar:', erro);
  process.exit(1);
});
