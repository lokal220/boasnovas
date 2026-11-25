/**
 * Esquema do banco (Drizzle + PostgreSQL). Fonte única da verdade das tabelas.
 * Mudou algo aqui? Rode `npm run db:generate` para criar a migração em server/db/migracoes;
 * o servidor aplica as migrações sozinho ao iniciar.
 *
 * Convenções:
 * - ids legíveis (slug) para unidades, ministérios e membros; ids aleatórios (uuid) para o resto.
 * - datas de culto como 'AAAA-MM-DD' (sem fuso) + hora em texto curto como a igreja escreve ('10h', '19h30').
 * - status e papéis como texto com valores fechados (ver os tipos em shared/api.ts).
 */
import {
  pgTable, text, integer, boolean, timestamp, date, jsonb, serial,
  primaryKey, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

const criadoEm = () => timestamp('criado_em', { withTimezone: true }).notNull().defaultNow();

/** Unidades da igreja (ex.: BN Estoril). */
export const unidades = pgTable('unidades', {
  id: text('id').primaryKey(),                       // 'bn-estoril'
  nome: text('nome').notNull(),                      // 'BN Estoril'
  endereco: text('endereco').notNull().default(''),
  fusoHorario: text('fuso_horario').notNull().default('America/Sao_Paulo'),
  criadoEm: criadoEm(),
});

/** Horários fixos de culto de cada unidade; geram os cultos de cada mês. */
export const agendaFixa = pgTable('agenda_fixa', {
  id: serial('id').primaryKey(),
  unidadeId: text('unidade_id').notNull().references(() => unidades.id, { onDelete: 'cascade' }),
  diaSemana: integer('dia_semana').notNull(),        // 0 = domingo … 6 = sábado
  hora: text('hora').notNull(),                      // '10h', '17h', '19h30'
  turno: text('turno').notNull(),                    // 'manha' | 'tarde' | 'noite' | 'unico'
  rotulo: text('rotulo').notNull().default(''),      // ex.: 'tarde da benção'
  ativo: boolean('ativo').notNull().default(true),
});

/** Ministérios (equipes que servem): Altar, Louvor, Recepção, Mídia, Kids… */
export const ministerios = pgTable('ministerios', {
  id: text('id').primaryKey(),                       // 'altar'
  unidadeId: text('unidade_id').notNull().references(() => unidades.id),
  nome: text('nome').notNull(),                      // 'Altar'
  descricao: text('descricao').notNull().default(''),// 'Homens que servem no altar'
  icone: text('icone').notNull().default('maos'),    // nome de ícone de linha (ver client/src/ui/icones)
  vagasPadrao: integer('vagas_padrao').notNull().default(3),
  /** 'aberto': qualquer pessoa com o link do grupo marca disponibilidade escolhendo o nome.
   *  'restrito': só pelo link pessoal de cada membro. */
  acesso: text('acesso').notNull().default('aberto'),
  tokenPublico: text('token_publico').notNull().unique(),
  /** ids de agenda_fixa que este ministério atende (vazio = todos da unidade). */
  horarios: jsonb('horarios').$type<number[]>().notNull().default([]),
  aviso: text('aviso').notNull().default(''),
  whatsappLider: text('whatsapp_lider').notNull().default(''),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: criadoEm(),
});

/** Pessoas que servem. Sem senha: entram pelo link pessoal (token) ou pelo link do grupo. */
export const membros = pgTable('membros', {
  id: text('id').primaryKey(),                       // 'thiago-daniel'
  nome: text('nome').notNull(),
  apelidos: jsonb('apelidos').$type<string[]>().notNull().default([]),
  telefone: text('telefone').notNull().default(''), // só dígitos, com DDI (5531…)
  ativo: boolean('ativo').notNull().default(true),
  tokenAcesso: text('token_acesso').notNull().unique(),
  criadoEm: criadoEm(),
});

/** Quem faz parte de qual ministério, e com que papel. */
export const ministerioMembros = pgTable('ministerio_membros', {
  ministerioId: text('ministerio_id').notNull().references(() => ministerios.id, { onDelete: 'cascade' }),
  membroId: text('membro_id').notNull().references(() => membros.id, { onDelete: 'cascade' }),
  papel: text('papel').notNull().default('servo'),   // 'servo' | 'lider'
  criadoEm: criadoEm(),
}, (t) => [primaryKey({ columns: [t.ministerioId, t.membroId] })]);

/** Cultos e eventos com data. */
export const cultos = pgTable('cultos', {
  id: text('id').primaryKey(),                       // 'bn-estoril:2026-11-22:manha'
  unidadeId: text('unidade_id').notNull().references(() => unidades.id),
  data: date('data', { mode: 'string' }).notNull(),
  hora: text('hora').notNull().default(''),
  turno: text('turno').notNull(),                    // 'manha' | 'tarde' | 'noite' | 'unico'
  titulo: text('titulo').notNull().default(''),      // evento: 'Santa Ceia', 'Natal', 'Réveillon'…
  extra: boolean('extra').notNull().default(false),  // fora dos dias fixos → escala feita na véspera
  nota: text('nota').notNull().default(''),
  criadoEm: criadoEm(),
}, (t) => [index('cultos_data_idx').on(t.data)]);

/** Vagas de um ministério num culto específico (sem linha = vagasPadrao do ministério). */
export const vagas = pgTable('vagas', {
  cultoId: text('culto_id').notNull().references(() => cultos.id, { onDelete: 'cascade' }),
  ministerioId: text('ministerio_id').notNull().references(() => ministerios.id, { onDelete: 'cascade' }),
  quantidade: integer('quantidade').notNull(),
}, (t) => [primaryKey({ columns: [t.cultoId, t.ministerioId] })]);

/** A escala em si: uma pessoa, num culto, por um ministério. */
export const escalas = pgTable('escalas', {
  id: text('id').primaryKey(),                       // uuid
  cultoId: text('culto_id').notNull().references(() => cultos.id, { onDelete: 'cascade' }),
  ministerioId: text('ministerio_id').notNull().references(() => ministerios.id, { onDelete: 'cascade' }),
  membroId: text('membro_id').notNull().references(() => membros.id, { onDelete: 'cascade' }),
  papel: text('papel').notNull().default('servo'),   // 'servo' | 'lider' (líder daquele culto)
  funcao: text('funcao').notNull().default(''),      // livre: 'vocal de apoio', 'porta principal'…
  status: text('status').notNull().default('confirmado'), // 'confirmado' | 'pendente' | 'nao_pode' | 'troca'
  origem: text('origem').notNull().default('lider'), // 'voluntario' | 'lider' | 'importacao' | 'troca'
  checkinEm: timestamp('checkin_em', { withTimezone: true }),
  criadoEm: criadoEm(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('escalas_unica_idx').on(t.cultoId, t.ministerioId, t.membroId),
  index('escalas_membro_idx').on(t.membroId),
]);

/** Pedidos de troca. */
export const trocas = pgTable('trocas', {
  id: text('id').primaryKey(),                       // uuid
  escalaId: text('escala_id').notNull().references(() => escalas.id, { onDelete: 'cascade' }),
  solicitanteId: text('solicitante_id').notNull().references(() => membros.id, { onDelete: 'cascade' }),
  substitutoId: text('substituto_id').references(() => membros.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('aberta'),// 'aberta' | 'aceita' | 'cancelada'
  mensagem: text('mensagem').notNull().default(''),
  criadoEm: criadoEm(),
  resolvidoEm: timestamp('resolvido_em', { withTimezone: true }),
}, (t) => [index('trocas_status_idx').on(t.status)]);

/** Contas de líderes e administradores (com senha). */
export const usuarios = pgTable('usuarios', {
  id: text('id').primaryKey(),                       // uuid
  nome: text('nome').notNull(),
  login: text('login').notNull().unique(),           // minúsculo
  senhaHash: text('senha_hash').notNull(),           // scrypt$N$r$p$sal$hash
  papel: text('papel').notNull().default('lider'),   // 'admin' | 'lider'
  /** ministérios que este líder administra (admin vê todos). */
  ministerios: jsonb('ministerios').$type<string[]>().notNull().default([]),
  membroId: text('membro_id').references(() => membros.id, { onDelete: 'set null' }),
  deveTrocarSenha: boolean('deve_trocar_senha').notNull().default(false),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: criadoEm(),
  ultimoAcessoEm: timestamp('ultimo_acesso_em', { withTimezone: true }),
});

/** Sessões de login (guarda só o hash SHA-256 do token do cookie). */
export const sessoes = pgTable('sessoes', {
  id: text('id').primaryKey(),
  usuarioId: text('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  criadoEm: criadoEm(),
  expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
});

/** Histórico de alterações (quem fez o quê). */
export const registros = pgTable('registros', {
  id: serial('id').primaryKey(),
  quando: timestamp('quando', { withTimezone: true }).notNull().defaultNow(),
  ator: text('ator').notNull(),                      // 'usuario:<id>' | 'membro:<id>' | 'anonimo:<hash>'
  acao: text('acao').notNull(),                      // 'escala.adicionar', 'escala.status', 'culto.criar'…
  alvo: text('alvo').notNull().default(''),
  dados: jsonb('dados').$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index('registros_quando_idx').on(t.quando)]);
