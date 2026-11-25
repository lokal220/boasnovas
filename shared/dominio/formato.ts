/**
 * Formatos de exibição no tom da igreja: ficha da agenda ('Altar · BN Estoril · Dom | 10h'),
 * rótulos de status e de cobertura, rótulos curtos de culto. Funções puras.
 */
import type { CoberturaDTO, StatusEscala, Turno } from '../api';
import { diaSemana, formatarDDMM, nomeDiaCurto, nomeMesCurto, partesData } from './datas';
import { semMarcadores } from './texto';
import { nomeTurno } from './turnos';

/** Dias da semana como a igreja escreve na agenda ("Dom 10h", "Terça | 14h", "Quarta | 19h30"). */
const DIAS_AGENDA = ['Dom', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;
/** Dias da semana por extenso e em minúsculas, para frases ("escala de domingo"). */
const DIAS_FRASE = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const;
const DIAS_EXTENSO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'] as const;

/** Nome do dia como na agenda da igreja: Dom, Segunda, Terça, Quarta, Quinta, Sexta, Sábado. */
export function diaDaAgenda(data: string): string {
  return DIAS_AGENDA[diaSemana(data)]!;
}

/** Dia da semana para frases, em minúsculas: 'domingo', 'quarta', 'sábado'. */
export function diaDaFrase(data: string): string {
  return DIAS_FRASE[diaSemana(data)]!;
}

/** Dados da ficha da agenda. `funcao` é o que vem antes da unidade (ex.: 'Altar' ou 'Louvor · Teclado'). */
export interface DadosFicha {
  /** nome do ministério; quando vier junto com `funcao`, aparece antes dela */
  ministerio?: string;
  funcao?: string;
  unidade: string;
  data: string;
  hora?: string;
}

/**
 * Ficha da agenda (SPEC §6): 'Função · BN Unidade · Dia | hora'.
 * fichaAgenda({ funcao: 'Altar', unidade: 'BN Estoril', data: '2026-11-29', hora: '10h' }) → 'Altar · BN Estoril · Dom | 10h'.
 */
export function fichaAgenda({ ministerio, funcao, unidade, data, hora }: DadosFicha): string {
  const partes = [ministerio, funcao, unidade].map((p) => semMarcadores(p)).filter(Boolean);
  const h = semMarcadores(hora);
  const dia = diaDaAgenda(data) + (h ? ` | ${h}` : '');
  return [...partes, dia].join(' · ');
}

/** Tom visual do status (chips ok/wait/no/swap da referência). */
export type TomStatus = 'ok' | 'wait' | 'no' | 'swap';

const ROTULOS_STATUS: Record<StatusEscala, { rotulo: string; tom: TomStatus }> = {
  confirmado: { rotulo: 'confirmado', tom: 'ok' },
  pendente: { rotulo: 'aguardando você', tom: 'wait' },
  nao_pode: { rotulo: 'não pode', tom: 'no' },
  troca: { rotulo: 'troca pedida', tom: 'swap' },
};

/**
 * Rótulo e tom do status da escala: confirmado/ok, aguardando você/wait, não pode/no, troca pedida/swap.
 * Na visão do líder (`visao: 'lider'`), pendente vira 'aguardando'.
 */
export function rotuloStatus(status: StatusEscala, visao: 'membro' | 'lider' = 'membro'): { rotulo: string; tom: TomStatus } {
  const base = Object.prototype.hasOwnProperty.call(ROTULOS_STATUS, status)
    ? ROTULOS_STATUS[status]
    : { rotulo: String(status), tom: 'wait' as const };
  if (status === 'pendente' && visao === 'lider') return { rotulo: 'aguardando', tom: base.tom };
  return { ...base };
}

/**
 * Contagem para mostrar no card: '3 de 4 confirmados'; acima das vagas, '5 confirmados (3 vagas)'.
 * Com `comAguardando`, acrescenta ' · 1 aguardando' quando houver pendentes.
 */
export function rotuloCobertura(cobertura: CoberturaDTO, opcoes: { comAguardando?: boolean } = {}): string {
  const { confirmados, vagas } = cobertura;
  let texto: string;
  if (vagas <= 0) texto = `${confirmados} ${confirmados === 1 ? 'confirmado' : 'confirmados'}`;
  else if (confirmados > vagas) texto = `${confirmados} confirmados (${vagas} ${vagas === 1 ? 'vaga' : 'vagas'})`;
  else texto = `${confirmados} de ${vagas} ${vagas === 1 ? 'confirmado' : 'confirmados'}`;
  const aguardando = rotuloAguardando(cobertura);
  return opcoes.comAguardando && aguardando ? `${texto} · ${aguardando}` : texto;
}

/** '1 aguardando', '2 aguardando' ou '' quando ninguém está pendente. */
export function rotuloAguardando(cobertura: CoberturaDTO): string {
  return cobertura.pendentes > 0 ? `${cobertura.pendentes} aguardando` : '';
}

/** O que falta: 'Completo', 'Falta 1', 'Faltam 2' ou 'Sem ninguém'. */
export function rotuloFaltam(cobertura: CoberturaDTO): string {
  if (cobertura.status === 'completo') return 'Completo';
  if (cobertura.status === 'vazio') return 'Sem ninguém';
  return cobertura.faltam === 1 ? 'Falta 1' : `Faltam ${cobertura.faltam}`;
}

/** Rótulo curto do culto: 'Dom 22/11 · Manhã', 'Qua 25/11'; com `comTitulo`, ' · Santa Ceia' no fim. */
export function rotuloCulto(culto: { data: string; turno: Turno | string; titulo?: string }, opcoes: { comTitulo?: boolean } = {}): string {
  let r = `${nomeDiaCurto(culto.data)} ${formatarDDMM(culto.data)}`;
  if (culto.turno && culto.turno !== 'unico') r += ` · ${nomeTurno(culto.turno)}`;
  const titulo = semMarcadores(culto.titulo);
  if (opcoes.comTitulo && titulo) r += ` · ${titulo}`;
  return r;
}

/** Overline de data do card de escala: '2026-11-29' → 'domingo · 29 nov'. */
export function overlineData(data: string): string {
  const { dia } = partesData(data);
  return `${DIAS_FRASE[diaSemana(data)]!} · ${dia} ${nomeMesCurto(data)}`;
}

/** Dia da semana por extenso em minúsculas: 'quarta-feira', 'domingo'. */
export function diaPorExtenso(data: string): string {
  return DIAS_EXTENSO[diaSemana(data)]!;
}
