/**
 * Vocabulário dos cultos: turnos (manhã, tarde, noite, culto único), ordem dentro do dia e eventos especiais.
 * Funções puras.
 */
import type { Turno } from '../api';
import { horaParaMinutos } from './datas';
import { normalizar, maiusculaInicial } from './texto';

/** Dados de exibição de um turno. `unico` = culto único do dia (quarta, eventos extras). */
export interface InfoTurno {
  id: Turno;
  /** 'Manhã', 'Tarde', 'Noite', 'Culto' */
  nome: string;
  /** desempate na ordem do dia (depois da hora) */
  ordem: number;
  /** horário de costume na BN Estoril, usado quando o culto não tem hora */
  horaPadrao: string;
}

/** Turnos de culto com nome, ordem e horário de costume. */
export const TURNOS: Readonly<Record<Turno, Readonly<InfoTurno>>> = Object.freeze({
  unico: Object.freeze({ id: 'unico', nome: 'Culto', ordem: 0, horaPadrao: '19h30' }),
  manha: Object.freeze({ id: 'manha', nome: 'Manhã', ordem: 1, horaPadrao: '10h' }),
  tarde: Object.freeze({ id: 'tarde', nome: 'Tarde', ordem: 2, horaPadrao: '17h' }),
  noite: Object.freeze({ id: 'noite', nome: 'Noite', ordem: 3, horaPadrao: '19h30' }),
});

/** Turnos na ordem de exibição em seletores (culto único primeiro). */
export const ORDEM_TURNOS: readonly Turno[] = Object.freeze(['unico', 'manha', 'tarde', 'noite'] as const);

/** true se o valor é um dos quatro turnos. */
export function ehTurno(valor: unknown): valor is Turno {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(TURNOS, valor);
}

/** Nome do turno para mostrar: 'manha' → 'Manhã', 'unico' → 'Culto'. */
export function nomeTurno(turno: Turno | string): string {
  return ehTurno(turno) ? TURNOS[turno].nome : String(turno);
}

/**
 * Turno pela hora (SPEC §3): antes das 12h manhã, antes das 18h tarde, senão noite.
 * Aceita '10h', '19h30', '19:30' ou número (menor que 24 = horas, como 19.5; a partir de 24 = minutos, como 1170).
 * Hora não reconhecida → 'unico'.
 */
export function turnoPorHora(hora: string | number): Turno {
  let minutos: number;
  if (typeof hora === 'number') minutos = hora < 24 ? hora * 60 : hora;
  else minutos = horaParaMinutos(hora);
  if (!Number.isFinite(minutos) || minutos < 0) return 'unico';
  if (minutos < 12 * 60) return 'manha';
  if (minutos < 18 * 60) return 'tarde';
  return 'noite';
}

/** O mínimo que um culto precisa ter para ser ordenado. */
export interface CultoOrdenavel { data: string; turno?: string; hora?: string | null; id?: string }

function minutosDoCulto(c: CultoOrdenavel): number {
  const m = horaParaMinutos(c.hora ?? '');
  if (Number.isFinite(m)) return m;
  return ehTurno(c.turno) ? horaParaMinutos(TURNOS[c.turno].horaPadrao) : 24 * 60;
}

/** Comparador para sort: data, depois hora (ou a hora de costume do turno), depois a ordem do turno e o id. */
export function compararCultos(a: CultoOrdenavel, b: CultoOrdenavel): number {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;
  const ma = minutosDoCulto(a);
  const mb = minutosDoCulto(b);
  if (ma !== mb) return ma - mb;
  const oa = ehTurno(a.turno) ? TURNOS[a.turno].ordem : 9;
  const ob = ehTurno(b.turno) ? TURNOS[b.turno].ordem : 9;
  if (oa !== ob) return oa - ob;
  return String(a.id ?? '').localeCompare(String(b.id ?? ''), 'en', { numeric: true });
}

/** Texto normalizado (sem acento, pontuação vira espaço) → nome oficial do evento. */
export const EVENTOS_CONHECIDOS: Readonly<Record<string, string>> = Object.freeze({
  'ceia': 'Santa Ceia',
  'santa ceia': 'Santa Ceia',
  'natal': 'Natal',
  'reveillon': 'Réveillon',
  'virada': 'Réveillon',
  'batismo': 'Batismo',
  'vigilia': 'Vigília',
});

/** Título de evento limpo: '( CEIA )' → 'Santa Ceia', 'virada' → 'Réveillon'; texto livre volta aparado; vazio → ''. */
export function normalizarEvento(texto: string | null | undefined): string {
  let limpo = String(texto ?? '')
    .replace(/[*_~`]/g, ' ')
    .replace(/^[\s()[\]{}.,;:–—-]+|[\s()[\]{}.,;:–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!limpo) return '';
  const chave = normalizar(limpo).replace(/[^a-z0-9]+/g, ' ').trim();
  if (Object.prototype.hasOwnProperty.call(EVENTOS_CONHECIDOS, chave)) return EVENTOS_CONHECIDOS[chave]!;
  if (limpo === limpo.toLocaleLowerCase('pt-BR')) limpo = maiusculaInicial(limpo);
  return limpo;
}
