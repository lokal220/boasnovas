/**
 * Agenda fixa da unidade: ocorrências de cada mês, dias fixos, véspera e ids de culto.
 * Funções puras.
 */
import type { AgendaFixaDTO, Turno } from '../api';
import { dataISO, diaSemana, partesData, somarDias } from './datas';
import { compararCultos } from './turnos';

/** Um horário da agenda fixa (o mínimo para gerar ocorrências; id, rótulo e ativo são opcionais). */
export interface HorarioAgenda {
  id?: number;
  diaSemana: number;
  hora: string;
  turno: Turno;
  rotulo?: string;
  ativo?: boolean;
}

/** Uma ocorrência de horário fixo numa data do mês. */
export interface OcorrenciaAgenda {
  data: string;
  hora: string;
  turno: Turno;
  rotulo: string;
  /** id do horário em agenda_fixa (null quando a agenda veio sem id) */
  agendaId: number | null;
}

/** Agenda do altar (SPEC §1): Quarta 19h30 (culto único) e Domingo 10h, 17h e 19h30. */
export const AGENDA_ALTAR: readonly Readonly<HorarioAgenda>[] = Object.freeze([
  Object.freeze({ diaSemana: 3, hora: '19h30', turno: 'unico', rotulo: '', ativo: true }),
  Object.freeze({ diaSemana: 0, hora: '10h', turno: 'manha', rotulo: '', ativo: true }),
  Object.freeze({ diaSemana: 0, hora: '17h', turno: 'tarde', rotulo: '', ativo: true }),
  Object.freeze({ diaSemana: 0, hora: '19h30', turno: 'noite', rotulo: '', ativo: true }),
] as const);

/** Agenda fixa da BN Estoril (bio do Instagram): Dom 10h, 17h e 19h30 | Terça 14h | Quarta 19h30. */
export const AGENDA_BN_ESTORIL: readonly Readonly<HorarioAgenda>[] = Object.freeze([
  Object.freeze({ diaSemana: 0, hora: '10h', turno: 'manha', rotulo: '', ativo: true }),
  Object.freeze({ diaSemana: 0, hora: '17h', turno: 'tarde', rotulo: '', ativo: true }),
  Object.freeze({ diaSemana: 0, hora: '19h30', turno: 'noite', rotulo: '', ativo: true }),
  Object.freeze({ diaSemana: 2, hora: '14h', turno: 'tarde', rotulo: 'tarde da benção', ativo: true }),
  Object.freeze({ diaSemana: 3, hora: '19h30', turno: 'unico', rotulo: '', ativo: true }),
] as const);

/** Horários ativos da unidade que o ministério atende (lista de ids vazia = todos, SPEC/schema `horarios`). */
export function agendaDoMinisterio<T extends HorarioAgenda>(agenda: readonly T[], horarios: readonly number[] = []): T[] {
  const ativos = agenda.filter((h) => h.ativo !== false);
  if (!horarios.length) return ativos;
  const ids = new Set(horarios);
  return ativos.filter((h) => typeof h.id === 'number' && ids.has(h.id));
}

/**
 * Todas as ocorrências dos horários ativos da agenda no mês (mês de 1 a 12), em ordem de data e hora.
 * datasDoMes(2027, 1, AGENDA_ALTAR) → 19 ocorrências (4 quartas + 5 domingos × 3).
 */
export function datasDoMes(ano: number, mes: number, agenda: readonly (HorarioAgenda | AgendaFixaDTO)[]): OcorrenciaAgenda[] {
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12 || ano < 1000 || ano > 9999) return [];
  const ativos = agenda.filter((h) => h.ativo !== false);
  const saida: OcorrenciaAgenda[] = [];
  for (let dia = 1; dia <= 31; dia++) {
    const data = dataISO(ano, mes, dia);
    if (partesData(data).mes !== mes) break;
    const semana = diaSemana(data);
    for (const h of ativos) {
      if (h.diaSemana !== semana) continue;
      saida.push({ data, hora: h.hora, turno: h.turno, rotulo: h.rotulo ?? '', agendaId: typeof h.id === 'number' ? h.id : null });
    }
  }
  return saida.sort(compararCultos);
}

/** Véspera (dia anterior): a escala de evento fora dos dias fixos é feita um dia antes. */
export function vespera(data: string): string {
  return somarDias(data, -1);
}

/** true se a data cai num dia com horário ativo na agenda (padrão: agenda do altar, quarta e domingo). */
export function ehDiaFixo(data: string, agenda: readonly (HorarioAgenda | AgendaFixaDTO)[] = AGENDA_ALTAR): boolean {
  const semana = diaSemana(data);
  return agenda.some((h) => h.ativo !== false && h.diaSemana === semana);
}

/**
 * Id do culto: `${unidadeId}:${data}:${turno}` → 'bn-estoril:2026-11-22:manha'.
 * Com `existentes`, devolve o primeiro id livre acrescentando '-2', '-3'… ('bn-estoril:2026-11-22:manha-2').
 */
export function idCulto(unidadeId: string, data: string, turno: Turno, existentes?: Iterable<string>): string {
  const base = `${unidadeId}:${data}:${turno}`;
  if (!existentes) return base;
  const usados = existentes instanceof Set ? (existentes as Set<string>) : new Set(existentes);
  if (!usados.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidato = `${base}-${n}`;
    if (!usados.has(candidato)) return candidato;
  }
}
