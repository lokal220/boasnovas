/**
 * Agenda .ics (RFC 5545) com as escalas do voluntário, para "adicionar à agenda do celular".
 * Linhas terminadas em CRLF, dobradas em 75 octetos (sem partir caracteres UTF-8), textos escapados
 * (\\ ; , e quebra de linha), instantes em UTC com Z, UID estável, DTSTAMP e PRODID. Funções puras.
 */
import type { PapelEscala, StatusEscala, Turno } from '../api';
import { instanteDoCulto, FUSO_PADRAO } from './datas';
import { fichaAgenda, rotuloStatus } from './formato';
import { TURNOS, ehTurno } from './turnos';
import { semMarcadores } from './texto';

/** Duração padrão de uma escala na agenda (SPEC §3). */
export const DURACAO_PADRAO_MINUTOS = 120;
/** Identificador do produto que gera o calendário. */
export const PRODID_PADRAO = '-//Boas Novas Church//Escalas//PT-BR';

/** Um evento do calendário. */
export interface EventoIcs {
  /** identificador estável (o mesmo evento mantém o mesmo UID entre downloads) */
  uid: string;
  inicio: Date | string;
  /** padrão: início + duracaoMinutos */
  fim?: Date | string;
  duracaoMinutos?: number;
  titulo: string;
  descricao?: string;
  local?: string;
  url?: string;
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  /** alarme N minutos antes (VALARM); sem valor, sem alarme */
  alarmeMinutos?: number;
}

/** Opções do calendário. */
export interface OpcoesIcs {
  /** instante do DTSTAMP (padrão: agora) */
  agora?: Date;
  prodId?: string;
  /** de quanto em quanto tempo o app de agenda deve atualizar a assinatura (padrão 12h) */
  atualizarHoras?: number;
}

/** Escapa um valor TEXT: \\ → \\\\, ; → \\;, , → \\,, quebra de linha → \\n; tira outros caracteres de controle. */
export function escaparTextoIcs(texto: string): string {
  return String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[\u{0000}-\u{0008}\u{000B}-\u{001F}\u{007F}]/gu, '');
}

/** Dobra a linha em pedaços de até 75 octetos (UTF-8); as continuações começam com um espaço. */
export function dobrarLinhaIcs(linha: string): string {
  const encoder = new TextEncoder();
  const partes: string[] = [];
  let atual = '';
  let bytes = 0;
  let limite = 75;
  for (const ch of linha) {
    const tamanho = encoder.encode(ch).length;
    if (bytes + tamanho > limite) {
      partes.push(atual);
      atual = ' ';
      bytes = 1;
      limite = 75;
    }
    atual += ch;
    bytes += tamanho;
  }
  partes.push(atual);
  return partes.join('\r\n');
}

/** Instante em UTC no formato do iCalendar: 20261122T130000Z. */
export function formatarUtcIcs(instante: Date): string {
  return instante.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
}

function paraData(valor: Date | string): Date | null {
  const d = valor instanceof Date ? new Date(valor.getTime()) : new Date(String(valor));
  return Number.isNaN(d.getTime()) ? null : d;
}

function semQuebras(texto: string): string {
  return String(texto ?? '').replace(/[\u{0000}-\u{001F}\u{007F}\s]+/gu, '');
}

/** Calendário .ics com os eventos (eventos com data inválida são pulados). */
export function gerarIcs(eventos: readonly EventoIcs[], nomeCalendario: string, opcoes: OpcoesIcs = {}): string {
  const agora = opcoes.agora && !Number.isNaN(opcoes.agora.getTime()) ? opcoes.agora : new Date();
  const nome = escaparTextoIcs(semMarcadores(nomeCalendario) || 'Escalas');
  const horas = opcoes.atualizarHoras && opcoes.atualizarHoras > 0 ? Math.round(opcoes.atualizarHoras) : 12;
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${escaparTextoIcs(opcoes.prodId ?? PRODID_PADRAO)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${nome}`,
    `X-WR-CALNAME:${nome}`,
    `REFRESH-INTERVAL;VALUE=DURATION:PT${horas}H`,
    `X-PUBLISHED-TTL:PT${horas}H`,
  ];
  const carimbo = formatarUtcIcs(agora);
  for (const e of eventos) {
    const inicio = paraData(e.inicio);
    if (!inicio || !e.uid) continue;
    const duracao = e.duracaoMinutos && e.duracaoMinutos > 0 ? e.duracaoMinutos : DURACAO_PADRAO_MINUTOS;
    let fim = e.fim ? paraData(e.fim) : null;
    if (!fim || fim.getTime() <= inicio.getTime()) fim = new Date(inicio.getTime() + duracao * 60_000);
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${escaparTextoIcs(e.uid)}`,
      `DTSTAMP:${carimbo}`,
      `DTSTART:${formatarUtcIcs(inicio)}`,
      `DTEND:${formatarUtcIcs(fim)}`,
      `SUMMARY:${escaparTextoIcs(e.titulo)}`,
    );
    if (e.descricao) linhas.push(`DESCRIPTION:${escaparTextoIcs(e.descricao)}`);
    if (e.local) linhas.push(`LOCATION:${escaparTextoIcs(e.local)}`);
    if (e.url && semQuebras(e.url)) linhas.push(`URL:${semQuebras(e.url)}`);
    if (e.status) linhas.push(`STATUS:${e.status}`);
    if (typeof e.alarmeMinutos === 'number' && e.alarmeMinutos >= 0 && Number.isFinite(e.alarmeMinutos)) {
      linhas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escaparTextoIcs(e.titulo)}`, `TRIGGER:-PT${Math.round(e.alarmeMinutos)}M`, 'END:VALARM');
    }
    linhas.push('END:VEVENT');
  }
  linhas.push('END:VCALENDAR');
  return `${linhas.map(dobrarLinhaIcs).join('\r\n')}\r\n`;
}

/** Item de escala (MinhaEscalaItemDTO serve) para virar evento. */
export interface EscalaParaIcs {
  escalaId: string;
  culto: { data: string; hora: string; turno: Turno; titulo?: string };
  ministerio: { nome: string };
  funcao?: string;
  papel?: PapelEscala;
  status: StatusEscala;
}

/**
 * Evento da agenda para uma escala do membro (SPEC §3: exceto nao_pode → null; 2h; local = unidade).
 * Título 'Altar · BN Estoril' (+ função, líder e evento), descrição com a ficha, o status e o link pessoal.
 */
export function eventoIcsDaEscala(
  item: EscalaParaIcs,
  unidade: { nome: string; endereco?: string; fusoHorario?: string },
  opcoes: { link?: string; duracaoMinutos?: number; alarmeMinutos?: number } = {},
): EventoIcs | null {
  if (item.status === 'nao_pode') return null;
  const hora = item.culto.hora || (ehTurno(item.culto.turno) ? TURNOS[item.culto.turno].horaPadrao : '');
  const inicio = instanteDoCulto(item.culto.data, hora, unidade.fusoHorario || FUSO_PADRAO);
  const funcao = semMarcadores(item.funcao);
  const ministerio = semMarcadores(item.ministerio.nome);
  const titulo = [
    `${ministerio}${item.papel === 'lider' ? ' (líder)' : ''}`,
    funcao,
    semMarcadores(unidade.nome),
    semMarcadores(item.culto.titulo),
  ].filter(Boolean).join(' · ');
  const descricao = [
    fichaAgenda({ ministerio, funcao, unidade: unidade.nome, data: item.culto.data, hora }),
    `Status: ${rotuloStatus(item.status).rotulo}`,
    opcoes.link ? `Sua escala: ${opcoes.link}` : '',
  ].filter(Boolean).join('\n');
  const endereco = semMarcadores(unidade.endereco);
  return {
    uid: `escala-${item.escalaId}@escalas.boasnovas`,
    inicio,
    duracaoMinutos: opcoes.duracaoMinutos ?? DURACAO_PADRAO_MINUTOS,
    titulo,
    descricao,
    local: endereco ? `${semMarcadores(unidade.nome)}, ${endereco}` : semMarcadores(unidade.nome),
    url: opcoes.link,
    status: item.status === 'pendente' ? 'TENTATIVE' : 'CONFIRMED',
    alarmeMinutos: opcoes.alarmeMinutos,
  };
}
