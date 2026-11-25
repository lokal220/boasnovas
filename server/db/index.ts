/**
 * Conexão com o banco.
 * - Com DATABASE_URL (Postgres do Replit, Neon, etc.): node-postgres.
 * - Sem DATABASE_URL: PGlite (Postgres embutido) em disco (.data/pglite) ou em memória (testes).
 * Em ambos os casos as migrações de server/db/migracoes são aplicadas na abertura.
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migrarPg } from 'drizzle-orm/node-postgres/migrator';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migrarPglite } from 'drizzle-orm/pglite/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from '@shared/schema';

export type Banco = PgDatabase<PgQueryResultHKT, typeof schema>;
export interface ConexaoBanco { db: Banco; tipo: 'postgres' | 'pglite'; fechar: () => Promise<void> }

export const PASTA_MIGRACOES = path.resolve(process.cwd(), 'server/db/migracoes');

export interface OpcoesBanco {
  /** URL do Postgres; quando presente, tem prioridade. */
  url?: string;
  /** Pasta do PGlite (padrão .data/pglite). */
  diretorio?: string;
  /** PGlite em memória (testes). */
  memoria?: boolean;
}

export async function abrirBanco(opcoes: OpcoesBanco = {}): Promise<ConexaoBanco> {
  if (opcoes.url) {
    const pool = new pg.Pool({ connectionString: opcoes.url, max: 10 });
    const db = drizzlePg(pool, { schema });
    await migrarPg(db, { migrationsFolder: PASTA_MIGRACOES });
    return { db: db as unknown as Banco, tipo: 'postgres', fechar: () => pool.end() };
  }
  let cliente: PGlite;
  if (opcoes.memoria) {
    cliente = new PGlite();
  } else {
    const pasta = path.resolve(opcoes.diretorio ?? '.data/pglite');
    fs.mkdirSync(pasta, { recursive: true });
    cliente = new PGlite(pasta);
  }
  const db = drizzlePglite(cliente, { schema });
  await migrarPglite(db, { migrationsFolder: PASTA_MIGRACOES });
  return { db: db as unknown as Banco, tipo: 'pglite', fechar: () => cliente.close() };
}
