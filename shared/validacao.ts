/**
 * Esquemas zod das requisições (validados no servidor; o cliente pode reutilizar nos formulários).
 * Devem bater com as interfaces de shared/api.ts.
 */
import { z } from 'zod';

export const turnoZ = z.enum(['manha', 'tarde', 'noite', 'unico']);
export const statusEscalaZ = z.enum(['confirmado', 'pendente', 'nao_pode', 'troca']);
export const papelZ = z.enum(['servo', 'lider']);
export const acessoZ = z.enum(['aberto', 'restrito']);
export const dataZ = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato AAAA-MM-DD.');
/** Hora como a igreja escreve: '10h', '19h30', '7h'. */
export const horaZ = z.string().regex(/^([01]?\d|2[0-3])h([0-5]\d)?$/, 'Use a hora como 10h ou 19h30.');
export const idZ = z.string().min(1).max(120);
const nomeZ = z.string().trim().min(2, 'Escreva o nome.').max(80);
const textoCurtoZ = z.string().trim().max(300);
const telefoneZ = z.string().trim().max(20).transform((s) => s.replace(/\D+/g, ''));

export const disponibilidadeZ = z.object({ membroId: idZ, cultoId: idZ, disponivel: z.boolean() });
export const novoMembroPublicoZ = z.object({ nome: nomeZ });
export const pedirTrocaZ = z.object({ mensagem: textoCurtoZ.optional() });
export const disponibilidadeMembroZ = z.object({ cultoId: idZ, ministerioId: idZ, disponivel: z.boolean() });

export const entrarZ = z.object({ login: z.string().trim().toLowerCase().min(1).max(60), senha: z.string().min(1).max(200) });
export const trocarSenhaZ = z.object({ senhaAtual: z.string().min(1).max(200), novaSenha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.').max(200) });

export const ministerioZ = z.object({
  nome: nomeZ,
  descricao: textoCurtoZ.optional(),
  icone: z.string().trim().max(40).optional(),
  unidadeId: idZ.optional(),
  vagasPadrao: z.number().int().min(1).max(50).optional(),
  acesso: acessoZ.optional(),
  aviso: z.string().trim().max(500).optional(),
  whatsappLider: telefoneZ.optional(),
  horarios: z.array(z.number().int()).max(50).optional(),
  ativo: z.boolean().optional(),
});
export const ministerioPatchZ = ministerioZ.partial();

export const unidadeZ = z.object({
  nome: nomeZ.optional(),
  endereco: textoCurtoZ.optional(),
  agenda: z.array(z.object({
    diaSemana: z.number().int().min(0).max(6), hora: horaZ, turno: turnoZ,
    rotulo: z.string().trim().max(60).optional(), ativo: z.boolean().optional(),
  })).max(40).optional(),
});

export const cultoNovoZ = z.object({
  unidadeId: idZ, data: dataZ, turno: turnoZ,
  hora: z.union([horaZ, z.literal('')]).optional(),
  titulo: z.string().trim().max(80).optional(),
  nota: z.string().trim().max(300).optional(),
  extra: z.boolean().optional(),
});
export const cultoPatchZ = cultoNovoZ.partial();
export const gerarCultosZ = z.object({ unidadeId: idZ, ano: z.number().int().min(2024).max(2100), mes: z.number().int().min(1).max(12) });

export const escalacaoZ = z.object({
  lider: idZ.nullable(),
  servos: z.array(z.object({ membroId: idZ, status: statusEscalaZ.optional(), funcao: z.string().trim().max(60).optional() })).max(100),
});
export const vagasZ = z.object({ quantidade: z.number().int().min(0).max(100) });
export const escalaPatchZ = z.object({ status: statusEscalaZ.optional(), papel: papelZ.optional(), funcao: z.string().trim().max(60).optional() });

export const membroZ = z.object({
  nome: nomeZ,
  apelidos: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  telefone: telefoneZ.optional(),
  ativo: z.boolean().optional(),
  ministerioId: idZ.optional(),
  papel: papelZ.optional(),
});
export const membroPatchZ = membroZ.partial();

export const importarZ = z.object({ ministerioId: idZ, texto: z.string().max(50_000) });
export const importarAplicarZ = importarZ.extend({
  modo: z.enum(['substituir', 'adicionar']),
  criarMembros: z.array(z.string().trim().min(1).max(80)).max(200),
});
export const resolverTrocaZ = z.object({ acao: z.enum(['aceitar', 'cancelar']), substitutoId: idZ.optional() });
export const usuarioZ = z.object({
  nome: nomeZ, login: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, 'Use de 3 a 40 letras, números, ponto, hífen ou sublinhado.'),
  papel: z.enum(['admin', 'lider']), ministerios: z.array(idZ).max(50).optional(), membroId: idZ.nullable().optional(),
});
export const usuarioPatchZ = usuarioZ.partial().extend({ ativo: z.boolean().optional() });
