import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` cria uma migração SQL em server/db/migracoes a partir de shared/schema.ts.
// O servidor aplica as migrações sozinho ao iniciar (Postgres do Replit ou PGlite local).
export default defineConfig({
  schema: './shared/schema.ts',
  out: './server/db/migracoes',
  dialect: 'postgresql',
});
