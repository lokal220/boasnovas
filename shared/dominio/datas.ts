/**
 * Datas de culto como strings 'AAAA-MM-DD' (sem fuso) e horas como a igreja escreve ('10h', '19h30').
 * "Hoje" e instantes reais dependem do fuso da unidade (America/Sao_Paulo), nunca do relógio do servidor:
 * o deslocamento do fuso é descoberto com Intl (vale para horário de verão e mudanças de regra).
 * Funções puras; o relógio só entra por parâmetro (com `new Date()` como padrão).
 */

/** Fuso das unidades no Brasil. */
export const FUSO_PADRAO = 'America/Sao_Paulo';

const DIA_MS = 86_400_000;
const NOMES_DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'] as const;
const NOMES_DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] as const;
const NOMES_MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

/** Partes de uma data de culto (mês de 1 a 12). */
export interface PartesData { ano: number; mes: number; dia: number }

/** Relógio aceito pelas funções que dependem de "agora": instante, milissegundos ou função que devolve o instante. */
export type Relogio = Date | number | (() => Date);

function dois(n: number): string {
  return String(n).padStart(2, '0');
}

function quatro(n: number): string {
  return String(n).padStart(4, '0');
}

/** Monta 'AAAA-MM-DD' a partir de ano, mês (1–12) e dia; valores fora do calendário rolam (32/01 → 01/02). */
export function dataISO(ano: number, mes: number, dia: number): string {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return `${quatro(d.getUTCFullYear())}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;
}

/** true se a string é uma data real no formato 'AAAA-MM-DD' ('2026-02-30' é falso). */
export function dataValida(data: unknown): data is string {
  if (typeof data !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) return false;
  return dataISO(Number(m[1]), Number(m[2]), Number(m[3])) === data;
}

/** '2026-11-22' → { ano: 2026, mes: 11, dia: 22 }; data inválida lança TypeError. */
export function partesData(data: string): PartesData {
  if (!dataValida(data)) throw new TypeError(`Data inválida: ${String(data)}`);
  return { ano: Number(data.slice(0, 4)), mes: Number(data.slice(5, 7)), dia: Number(data.slice(8, 10)) };
}

function utcDoDia(data: string): number {
  const p = partesData(data);
  return Date.UTC(p.ano, p.mes - 1, p.dia);
}

/** Dia da semana da data: 0 = domingo … 6 = sábado. */
export function diaSemana(data: string): number {
  return new Date(utcDoDia(data)).getUTCDay();
}

/** Soma (ou subtrai) dias: somarDias('2026-12-31', 1) → '2027-01-01'. */
export function somarDias(data: string, dias: number): string {
  const d = new Date(utcDoDia(data) + Math.trunc(dias) * DIA_MS);
  return `${quatro(d.getUTCFullYear())}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;
}

/** Dias de `a` até `b` (b − a): diasEntre('2026-11-21', '2026-11-22') → 1. */
export function diasEntre(a: string, b: string): number {
  return Math.round((utcDoDia(b) - utcDoDia(a)) / DIA_MS);
}

/** '2026-12-06' → '06/12'. */
export function formatarDDMM(data: string): string {
  const p = partesData(data);
  return `${dois(p.dia)}/${dois(p.mes)}`;
}

/** '2026-12-06' → '06/12/2026'. */
export function formatarDDMMAAAA(data: string): string {
  const p = partesData(data);
  return `${dois(p.dia)}/${dois(p.mes)}/${p.ano}`;
}

/** Nome do dia da semana: '2026-11-25' → 'Quarta-feira'. */
export function nomeDia(data: string): string {
  return NOMES_DIAS[diaSemana(data)]!;
}

/** Nome curto do dia da semana: '2026-11-25' → 'Qua'. */
export function nomeDiaCurto(data: string): string {
  return NOMES_DIAS_CURTOS[diaSemana(data)]!;
}

function indiceMes(mes: number | string): number {
  const n = typeof mes === 'string' ? (dataValida(mes) ? partesData(mes).mes : Number(mes)) : mes;
  if (!Number.isInteger(n) || n < 1 || n > 12) throw new RangeError(`Mês inválido: ${String(mes)}`);
  return n - 1;
}

/** Nome do mês em minúsculas: nomeMes(11) ou nomeMes('2026-11-22') → 'novembro'. */
export function nomeMes(mes: number | string): string {
  return NOMES_MESES[indiceMes(mes)]!;
}

/** Nome curto do mês: nomeMesCurto(11) ou nomeMesCurto('2026-11-22') → 'nov'. */
export function nomeMesCurto(mes: number | string): string {
  return NOMES_MESES_CURTOS[indiceMes(mes)]!;
}

/** Distância em palavras até a data: 'Hoje', 'Amanhã', 'Ontem', 'Em 4 dias', 'Há 3 dias'. */
export function rotuloRelativo(data: string, hoje: string): string {
  const n = diasEntre(hoje, data);
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Amanhã';
  if (n === -1) return 'Ontem';
  return n > 0 ? `Em ${n} dias` : `Há ${-n} dias`;
}

/** Minutos desde a meia-noite: '19h30' → 1170, '10h' → 600, '19:30' → 1170; hora não reconhecida → NaN. */
export function horaParaMinutos(hora: string | null | undefined): number {
  const m = /^\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:min|m)?\s*$/i.exec(String(hora ?? ''));
  if (!m) return Number.NaN;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return Number.NaN;
  return h * 60 + min;
}

/** Hora como a igreja escreve a partir dos minutos: 1170 → '19h30', 600 → '10h' (passa da meia-noite dando a volta). */
export function minutosParaHora(minutos: number): string {
  if (!Number.isFinite(minutos)) return '';
  const total = ((Math.round(minutos) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h${dois(m)}` : `${h}h`;
}

// ───────────────────────── fuso ─────────────────────────

const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(fuso: string): Intl.DateTimeFormat {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatadores.set(fuso, f);
  }
  return f;
}

/** true se o Intl conhece o fuso IANA ('America/Sao_Paulo'). */
export function fusoValido(fuso: unknown): fuso is string {
  if (typeof fuso !== 'string' || !fuso) return false;
  try {
    formatador(fuso);
    return true;
  } catch {
    return false;
  }
}

function fusoOuPadrao(fuso: string | null | undefined): string {
  return fusoValido(fuso) ? fuso : FUSO_PADRAO;
}

interface PartesInstante { ano: number; mes: number; dia: number; hora: number; minuto: number; segundo: number }

function partesNoFuso(instante: Date, fuso: string): PartesInstante {
  const valores: Record<string, number> = {};
  for (const parte of formatador(fuso).formatToParts(instante)) {
    if (parte.type !== 'literal') valores[parte.type] = Number(parte.value);
  }
  return {
    ano: valores.year ?? 0, mes: valores.month ?? 1, dia: valores.day ?? 1,
    hora: (valores.hour ?? 0) % 24, minuto: valores.minute ?? 0, segundo: valores.second ?? 0,
  };
}

/** Deslocamento do fuso naquele instante, em minutos (hora local − UTC): São Paulo hoje → −180. */
export function deslocamentoFuso(instante: Date, fuso: string = FUSO_PADRAO): number {
  const z = fusoOuPadrao(fuso);
  const segundos = Math.floor(instante.getTime() / 1000) * 1000;
  const p = partesNoFuso(new Date(segundos), z);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return Math.round((comoUtc - segundos) / 60_000);
}

function instanteDoRelogio(agora: Relogio): Date {
  if (typeof agora === 'function') return agora();
  return agora instanceof Date ? agora : new Date(agora);
}

/** Data de hoje ('AAAA-MM-DD') no fuso da unidade; fuso e relógio injetáveis (fuso desconhecido usa o padrão). */
export function hojeNoFuso(fuso: string = FUSO_PADRAO, agora: Relogio = new Date()): string {
  const instante = instanteDoRelogio(agora);
  if (Number.isNaN(instante.getTime())) throw new RangeError('Relógio inválido.');
  const p = partesNoFuso(instante, fusoOuPadrao(fuso));
  return `${quatro(p.ano)}-${dois(p.mes)}-${dois(p.dia)}`;
}

/**
 * Instante (UTC) em que o culto começa: data + hora no fuso da unidade.
 * instanteDoCulto('2026-11-22', '10h', 'America/Sao_Paulo') → 2026-11-22T13:00:00.000Z.
 * Hora vazia ou não reconhecida conta como 0h; data inválida lança TypeError.
 */
export function instanteDoCulto(data: string, hora: string, fuso: string = FUSO_PADRAO): Date {
  const { ano, mes, dia } = partesData(data);
  const minutos = horaParaMinutos(hora);
  const m = Number.isFinite(minutos) ? minutos : 0;
  const z = fusoOuPadrao(fuso);
  const palpite = Date.UTC(ano, mes - 1, dia, Math.floor(m / 60), m % 60);
  const primeiro = deslocamentoFuso(new Date(palpite), z);
  let instante = palpite - primeiro * 60_000;
  const segundo = deslocamentoFuso(new Date(instante), z);
  if (segundo !== primeiro) instante = palpite - segundo * 60_000;
  return new Date(instante);
}

/** O check-in abre 2h antes do início do culto e fecha 3h depois (SPEC §3). */
export const CHECKIN_ABRE_ANTES_MINUTOS = 120;
/** Minutos depois do início do culto em que o check-in fecha. */
export const CHECKIN_FECHA_DEPOIS_MINUTOS = 180;

/** Janela de check-in do culto no fuso da unidade: { inicio, abreEm, fechaEm } como instantes. */
export function janelaCheckin(data: string, hora: string, fuso: string = FUSO_PADRAO): { inicio: Date; abreEm: Date; fechaEm: Date } {
  const inicio = instanteDoCulto(data, hora, fuso);
  return {
    inicio,
    abreEm: new Date(inicio.getTime() - CHECKIN_ABRE_ANTES_MINUTOS * 60_000),
    fechaEm: new Date(inicio.getTime() + CHECKIN_FECHA_DEPOIS_MINUTOS * 60_000),
  };
}
