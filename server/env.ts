/** Configuração lida das variáveis de ambiente (no Replit: aba Secrets). Ver .env.example. */
export const env = {
  porta: Number(process.env.PORT ?? 5000),
  producao: process.env.NODE_ENV === 'production',
  databaseUrl: (process.env.DATABASE_URL ?? '').trim(),
  diretorioDados: process.env.DIRETORIO_DADOS ?? '.data',
  adminLogin: (process.env.ADMIN_LOGIN ?? 'admin').trim().toLowerCase(),
  adminSenha: process.env.ADMIN_SENHA ?? '',
  adminNome: process.env.ADMIN_NOME ?? 'Administrador',
  urlPublica: (process.env.URL_PUBLICA ?? '').trim().replace(/\/+$/, ''),
  semearDados: (process.env.SEMEAR_DADOS ?? 'true').trim().toLowerCase() !== 'false',
  versao: '0.1.0',
} as const;
