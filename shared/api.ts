/**
 * Contrato HTTP entre servidor (server/) e cliente (client/). Tipos de resposta e de requisição.
 * As requisições são validadas no servidor com os esquemas zod de shared/validacao.ts.
 *
 * Regras gerais
 * - JSON em tudo. Datas de culto 'AAAA-MM-DD'; instantes em ISO 8601 (UTC).
 * - Erros: status HTTP adequado + corpo ErroDTO { erro: mensagem em pt-BR para mostrar ao usuário }.
 * - Toda requisição que altera dados (POST/PUT/PATCH/DELETE) envia o cabeçalho `X-BN: 1` (proteção CSRF);
 *   sem ele o servidor responde 403.
 * - Líder: sessão por cookie httpOnly `bn_sessao` (POST /api/auth/entrar).
 * - Membro: token pessoal na URL (/api/eu/:token…). Grupo: token público do ministério (/api/publico/:token…).
 *
 * ENDPOINTS
 * Público (link do grupo do ministério)
 *   GET    /api/saude                                    → { ok: true, versao: string }
 *   GET    /api/publico/:token                           → EscalaPublicaDTO
 *   POST   /api/publico/:token/disponibilidade           DisponibilidadeReq → CultoComEscalaDTO   (só ministério 'aberto')
 *   POST   /api/publico/:token/membros                   NovoMembroPublicoReq → MembroResumo        (só 'aberto'; "não estou na lista")
 * Membro (link pessoal)
 *   GET    /api/eu/:token                                → MinhaEscalaDTO
 *   POST   /api/eu/:token/escalas/:escalaId/confirmar    → MinhaEscalaItemDTO
 *   POST   /api/eu/:token/escalas/:escalaId/nao-posso    → MinhaEscalaItemDTO
 *   POST   /api/eu/:token/escalas/:escalaId/troca        PedirTrocaReq → TrocaDTO
 *   POST   /api/eu/:token/escalas/:escalaId/checkin      → MinhaEscalaItemDTO
 *   POST   /api/eu/:token/disponibilidade                DisponibilidadeMembroReq → MinhaEscalaDTO  (inscrever-se num culto do seu ministério)
 *   POST   /api/eu/:token/trocas/:trocaId/aceitar        → TrocaDTO
 *   POST   /api/eu/:token/trocas/:trocaId/cancelar       → TrocaDTO
 *   GET    /api/eu/:token/agenda.ics                     → text/calendar (próximas escalas)
 * Autenticação do líder
 *   POST   /api/auth/entrar                              EntrarReq → UsuarioDTO (+ cookie)
 *   POST   /api/auth/sair                                → { ok: true }
 *   GET    /api/auth/eu                                  → UsuarioDTO | 401
 *   POST   /api/auth/senha                               TrocarSenhaReq → { ok: true }
 * Líder (exige sessão; líder só enxerga os ministérios dele; admin vê todos)
 *   GET    /api/lider/ministerios                        → MinisterioLiderDTO[]
 *   POST   /api/lider/ministerios                        MinisterioReq → MinisterioLiderDTO        (admin)
 *   PATCH  /api/lider/ministerios/:id                    Partial<MinisterioReq> → MinisterioLiderDTO
 *   POST   /api/lider/ministerios/:id/token              → MinisterioLiderDTO                       (novo link do grupo)
 *   GET    /api/lider/painel?ministerio=&de=&ate=        → PainelDTO
 *   GET    /api/lider/unidades                           → UnidadeComAgendaDTO[]
 *   PATCH  /api/lider/unidades/:id                       UnidadeReq → UnidadeComAgendaDTO          (admin; inclui agenda fixa)
 *   GET    /api/lider/cultos?unidade=&de=&ate=           → CultoDTO[]
 *   POST   /api/lider/cultos                             CultoNovoReq → CultoDTO
 *   PATCH  /api/lider/cultos/:id                         Partial<CultoNovoReq> → CultoDTO
 *   DELETE /api/lider/cultos/:id                         → { ok: true }
 *   POST   /api/lider/cultos/gerar                       GerarCultosReq → { criados: CultoDTO[]; existentes: number }
 *   PUT    /api/lider/cultos/:cultoId/escala/:ministerioId   EscalacaoReq → CultoComEscalaDTO   (substitui a escala daquele culto)
 *   PUT    /api/lider/cultos/:cultoId/vagas/:ministerioId    VagasReq → CultoComEscalaDTO
 *   PATCH  /api/lider/escalas/:id                        EscalaPatchReq → EscaladoDTO
 *   DELETE /api/lider/escalas/:id                        → { ok: true }
 *   GET    /api/lider/membros?ministerio=                → MembroLiderDTO[]
 *   POST   /api/lider/membros                            MembroReq → MembroLiderDTO
 *   PATCH  /api/lider/membros/:id                        Partial<MembroReq> → MembroLiderDTO
 *   POST   /api/lider/membros/:id/token                  → MembroLiderDTO                          (novo link pessoal)
 *   DELETE /api/lider/membros/:id?ministerio=            → { removido: boolean; desativado: boolean }
 *   POST   /api/lider/importar/analisar                  ImportarReq → ResultadoImportacaoDTO
 *   POST   /api/lider/importar/aplicar                   ImportarAplicarReq → ResumoImportacaoDTO
 *   GET    /api/lider/exportar?ministerio=&de=&ate=&passados=0|1 → ExportacaoDTO
 *   GET    /api/lider/lembretes?ministerio=&dias=7       → LembreteDTO[]
 *   POST   /api/lider/trocas/:id/resolver                ResolverTrocaReq → TrocaDTO
 *   GET    /api/lider/registros?ministerio=&limite=50    → RegistroDTO[]
 *   GET    /api/lider/usuarios                           → UsuarioDTO[]                            (admin)
 *   POST   /api/lider/usuarios                           UsuarioReq → { usuario: UsuarioDTO; senhaInicial: string } (admin)
 *   PATCH  /api/lider/usuarios/:id                       Partial<UsuarioReq> & { ativo?: boolean } → UsuarioDTO (admin)
 */

// ───────────────────────── vocabulário ─────────────────────────
export type Turno = 'manha' | 'tarde' | 'noite' | 'unico';
export type StatusEscala = 'confirmado' | 'pendente' | 'nao_pode' | 'troca';
export type PapelEscala = 'servo' | 'lider';
export type PapelMinisterio = 'servo' | 'lider';
export type OrigemEscala = 'voluntario' | 'lider' | 'importacao' | 'troca';
export type StatusCobertura = 'completo' | 'parcial' | 'vazio';
export type AcessoMinisterio = 'aberto' | 'restrito';
export type StatusTroca = 'aberta' | 'aceita' | 'cancelada';
export type PapelUsuario = 'admin' | 'lider';

export interface ErroDTO { erro: string; detalhes?: unknown }

// ───────────────────────── entidades ─────────────────────────
export interface IgrejaDTO { nome: string; tagline: string }
export interface UnidadeDTO { id: string; nome: string; endereco: string; fusoHorario: string }
export interface AgendaFixaDTO { id: number; diaSemana: number; hora: string; turno: Turno; rotulo: string; ativo: boolean }
export interface UnidadeComAgendaDTO extends UnidadeDTO { agenda: AgendaFixaDTO[] }

export interface MinisterioDTO {
  id: string; unidadeId: string; nome: string; descricao: string; icone: string;
  vagasPadrao: number; acesso: AcessoMinisterio; aviso: string; whatsappLider: string;
  horarios: number[]; ativo: boolean;
}
/** Visão do líder: inclui o token e o link do grupo. */
export interface MinisterioLiderDTO extends MinisterioDTO { tokenPublico: string; linkPublico: string }

export interface MembroResumo { id: string; nome: string; papel: PapelMinisterio }

export interface CultoDTO {
  id: string; unidadeId: string; data: string; hora: string; turno: Turno;
  titulo: string; extra: boolean; nota: string;
  /** dia em que a escala é fechada quando o culto é extra (véspera), senão null */
  vespera: string | null;
}

export interface EscaladoDTO {
  escalaId: string; membroId: string; nome: string; papel: PapelEscala; funcao: string;
  status: StatusEscala; origem: OrigemEscala; checkinEm: string | null;
}

export interface CoberturaDTO {
  /** pessoas que contam para a escala: confirmado + pendente + troca (nao_pode não conta) */
  pessoas: number; confirmados: number; pendentes: number; trocas: number;
  vagas: number; faltam: number; status: StatusCobertura;
}

export interface CultoComEscalaDTO extends CultoDTO {
  ministerioId: string; vagas: number; escalados: EscaladoDTO[]; cobertura: CoberturaDTO;
}

export interface TrocaDTO {
  id: string; escalaId: string; status: StatusTroca; mensagem: string; criadoEm: string; resolvidoEm: string | null;
  culto: CultoDTO; ministerio: { id: string; nome: string };
  solicitante: { id: string; nome: string }; substituto: { id: string; nome: string } | null;
}

// ───────────────────────── público (link do grupo) ─────────────────────────
export interface EscalaPublicaDTO {
  igreja: IgrejaDTO; unidade: UnidadeDTO; ministerio: MinisterioDTO; hoje: string;
  membros: MembroResumo[];          // ativos, ordenados por nome
  cultos: CultoComEscalaDTO[];      // de hoje−30 a hoje+120 dias, em ordem de data/turno
  trocasAbertas: TrocaDTO[];
}
export interface DisponibilidadeReq { membroId: string; cultoId: string; disponivel: boolean }
export interface NovoMembroPublicoReq { nome: string }

// ───────────────────────── membro (link pessoal) ─────────────────────────
export interface CheckinDTO { podeFazer: boolean; feitoEm: string | null; abreEm: string; fechaEm: string }
export interface MinhaEscalaItemDTO {
  escalaId: string; culto: CultoDTO; ministerio: { id: string; nome: string };
  papel: PapelEscala; funcao: string; status: StatusEscala;
  equipe: { membroId: string; nome: string; papel: PapelEscala; status: StatusEscala }[];
  checkin: CheckinDTO;
}
export interface MinhaEscalaDTO {
  igreja: IgrejaDTO; unidade: UnidadeDTO; hoje: string;
  membro: { id: string; nome: string };
  ministerios: { id: string; nome: string; papel: PapelMinisterio; linkPublico: string; acesso: AcessoMinisterio }[];
  proximas: MinhaEscalaItemDTO[];
  passadas: MinhaEscalaItemDTO[];   // até 12, mais recentes primeiro
  /** cultos futuros dos meus ministérios em que ainda não estou (para me inscrever) */
  oportunidades: CultoComEscalaDTO[];
  trocasParaMim: TrocaDTO[];        // trocas abertas de outros nos meus ministérios
  minhasTrocas: TrocaDTO[];
  estatisticas: { servidos: number; proximos: number; desde: string | null };
}
export interface PedirTrocaReq { mensagem?: string }
export interface DisponibilidadeMembroReq { cultoId: string; ministerioId: string; disponivel: boolean }

// ───────────────────────── autenticação ─────────────────────────
export interface UsuarioDTO {
  id: string; nome: string; login: string; papel: PapelUsuario; ministerios: string[];
  deveTrocarSenha: boolean; ativo: boolean;
}
export interface EntrarReq { login: string; senha: string }
export interface TrocarSenhaReq { senhaAtual: string; novaSenha: string }

// ───────────────────────── líder ─────────────────────────
export interface MembroLiderDTO {
  id: string; nome: string; apelidos: string[]; telefone: string; ativo: boolean;
  papel: PapelMinisterio; tokenAcesso: string; linkPessoal: string;
  estatisticas: { total: number; futuros: number; liderancas: number; proximaData: string | null; ultimaData: string | null };
}
export interface PainelDTO {
  ministerio: MinisterioLiderDTO; unidade: UnidadeDTO; hoje: string;
  cultos: CultoComEscalaDTO[];
  resumo: { cultosFuturos: number; vagasAbertas: number; pendentes: number; trocasAbertas: number; semData: number };
  trocasAbertas: TrocaDTO[];
  membros: MembroLiderDTO[];
}
export interface MinisterioReq {
  nome: string; descricao?: string; icone?: string; unidadeId?: string; vagasPadrao?: number;
  acesso?: AcessoMinisterio; aviso?: string; whatsappLider?: string; horarios?: number[]; ativo?: boolean;
}
export interface UnidadeReq {
  nome?: string; endereco?: string;
  agenda?: { diaSemana: number; hora: string; turno: Turno; rotulo?: string; ativo?: boolean }[];
}
export interface CultoNovoReq {
  unidadeId: string; data: string; turno: Turno; hora?: string; titulo?: string; nota?: string; extra?: boolean;
}
export interface GerarCultosReq { unidadeId: string; ano: number; mes: number }
export interface EscalacaoReq { lider: string | null; servos: { membroId: string; status?: StatusEscala; funcao?: string }[] }
export interface VagasReq { quantidade: number }
export interface EscalaPatchReq { status?: StatusEscala; papel?: PapelEscala; funcao?: string }
export interface MembroReq {
  nome: string; apelidos?: string[]; telefone?: string; ativo?: boolean;
  ministerioId?: string; papel?: PapelMinisterio;
}
export interface ResolverTrocaReq { acao: 'aceitar' | 'cancelar'; substitutoId?: string }
export interface UsuarioReq { nome: string; login: string; papel: PapelUsuario; ministerios?: string[]; membroId?: string | null }

// importação do WhatsApp
export interface RefNomeDTO { membroId: string; nome: string; novo: boolean; original: string; aproximado: boolean }
export interface CultoImportadoDTO {
  data: string; turno: Turno; titulo: string; extra: boolean;
  lider: RefNomeDTO | null; servos: RefNomeDTO[]; linhas: number[];
}
export interface ResultadoParserDTO {
  tipo: 'escala' | 'disponibilidade' | 'desconhecido'; titulo: string; aviso: string;
  pessoa: RefNomeDTO | null; cultos: CultoImportadoDTO[];
  naoReconhecidos: { linha: number; texto: string }[]; avisos: string[];
}
export interface PreviaCultoDTO {
  data: string; turno: Turno; titulo: string; cultoId: string | null; existe: boolean;
  adicionados: string[]; removidos: string[]; mantidos: string[];
  lider: { antes: string | null; depois: string | null };
}
export interface ResultadoImportacaoDTO extends ResultadoParserDTO {
  modoSugerido: 'substituir' | 'adicionar';
  previa: PreviaCultoDTO[];
  nomesNovos: string[];
}
export interface ImportarReq { ministerioId: string; texto: string }
export interface ImportarAplicarReq extends ImportarReq { modo: 'substituir' | 'adicionar'; criarMembros: string[] }
export interface ResumoImportacaoDTO { cultosCriados: number; cultosAlterados: number; membrosCriados: number; ignorados: string[] }

export interface ExportacaoDTO { texto: string; link: string }
export interface LembreteDTO {
  membroId: string; nome: string; telefone: string;
  itens: { escalaId: string; culto: CultoDTO; status: StatusEscala }[];
  texto: string; linkWhatsApp: string;
}
export interface RegistroDTO { id: number; quando: string; ator: string; atorNome: string; acao: string; alvo: string; dados: Record<string, unknown> }
