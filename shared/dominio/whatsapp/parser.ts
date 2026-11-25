/**
 * Leitor da lista de escala do WhatsApp (SPEC §3; regras validadas no protótipo, SPEC antigo §5.3).
 *
 * Entende dois tipos de texto:
 * - a lista de escala ("18/11/2026 — Quarta-feira" seguido dos nomes, "Manhã: Alê / Herbert", "(Rômulo líder)");
 * - a mensagem de disponibilidade ("Meu nome é *Herick* e posso servir…" + "• Qua 25/11 · 19h30", ou à mão:
 *   "Aqui é o Lucas, posso dia 25/11 e 06/12 de manhã").
 * Qualquer outra coisa vira tipo 'desconhecido' (nunca lança exceção por causa do texto).
 *
 * Regras principais
 * 1. Normalização: CRLF, NBSP e espaços unicode, marcadores * _ ~ ` e caracteres invisíveis; emojis ignorados.
 * 2. Cabeçalho de data: dd/mm ou dd/mm/aaaa no início da linha (dia da semana antes ou depois, "Quarta feira:",
 *    evento entre parênteses "( CEIA )"). Ano: do cabeçalho; senão do título; senão o mais perto de `hoje`
 *    (se informado); senão `anoPadrao`. Virada dez→jan soma um ano. Dia da semana errado gera aviso.
 * 3. Turnos: prefixos Manhã/Tarde/Noite (com : . - – — ou espaço; linha só com o prefixo = turno vazio) ou horário
 *    (10h, 17h, 19h30 → turnoPorHora, só no domingo). "Quarta:" é ignorado. Linha sem prefixo continua o último turno;
 *    sem turno ainda: culto único (no domingo, com aviso).
 * 4. Líder: "(Rômulo líder)", "Rômulo líder", "líder: Rômulo", "Rômulo (líder)"; quem é líder sai dos servos.
 * 5. Nomes: separados por / , ; | + & • · " l " " e " " - "; dentro de cada trecho vale o MAIOR nome conhecido
 *    (nome, nome sem parênteses, apelidos): "Thiago Daniel" vence "Daniel", "wanderlei naftali" são dois.
 *    Aproximação (Levenshtein 1) só para palavras com 5+ letras e candidato único ("Danjel" → Daniel, com aviso).
 *    Palavras desconhecidas seguidas viram UM nome novo (até 3 palavras; mais que isso vai para naoReconhecidos).
 * 6. Antes do primeiro cabeçalho: título (primeira linha com letras). Linha com "Atenção": aviso; o que vem depois
 *    dela é ignorado (até aparecer outro cabeçalho). Linhas com link são ignoradas.
 * 7. Disponibilidade: "Meu nome é X", "Aqui é o X", "Sou o X", "Me chamo X" + datas; um culto por data/turno com a
 *    pessoa como servo. Se o texto também tiver uma escala com nomes de outras pessoas, vale a escala.
 */
import type { CultoImportadoDTO, RefNomeDTO, ResultadoParserDTO, Turno } from '../../api';
import { dataISO, dataValida, diaSemana, diasEntre, formatarDDMM, formatarDDMMAAAA, partesData } from '../datas';
import { levenshtein, normalizar, tituloNome } from '../texto';
import { compararCultos, EVENTOS_CONHECIDOS, normalizarEvento, turnoPorHora } from '../turnos';

/** Pessoa conhecida, para casar os nomes do texto. */
export interface MembroParaParser { id: string; nome: string; apelidos?: readonly string[] }

/** Opções do leitor. */
export interface OpcoesParser {
  membros: readonly MembroParaParser[];
  /** ano das datas sem ano quando o texto não diz qual é */
  anoPadrao: number;
  /** 'AAAA-MM-DD' opcional: com ele, a primeira data sem ano fica no ano mais perto de hoje (antes do anoPadrao) */
  hoje?: string;
}

// ───────────────────────── normalização ─────────────────────────

const INVISIVEIS = /[\u{200B}-\u{200D}\u{2060}\u{FEFF}\u{00AD}]/gu;
const EMOJIS = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}\u{200D}\u{FE0E}\u{FE0F}\u{20E3}]/gu;
const LINK = /(?:https?:\/\/|www\.)\S+|\bwa\.me\/\S*/i;
const PALAVRA = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

interface Linha {
  numero: number;
  /** sem marcadores e espaços extras, com emojis (para título, aviso e textos mostrados) */
  limpa: string;
  /** como `limpa`, sem emojis (para ler datas e nomes) */
  texto: string;
  /** `texto` sem acento e minúsculo, com o MESMO comprimento (índices valem para os dois) */
  dobrada: string;
}

/** Minúsculo e sem acento, caractere por caractere (mantém o comprimento para alinhar índices). */
function dobrar(s: string): string {
  let saida = '';
  for (const ch of s) {
    let b = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    if (b.length !== ch.length) {
      const baixa = ch.toLowerCase();
      b = baixa.length === ch.length ? baixa : ch;
    }
    saida += b;
  }
  return saida;
}

function prepararLinhas(texto: string): Linha[] {
  return texto.split(/\r\n|\r|\n|\u{2028}|\u{2029}/u).map((bruta, i) => {
    const limpa = bruta.normalize('NFC').replace(INVISIVEIS, '').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
    const semEmoji = limpa.replace(EMOJIS, ' ').replace(/\s+/g, ' ').trim();
    return { numero: i + 1, limpa, texto: semEmoji, dobrada: dobrar(semEmoji) };
  });
}

// ───────────────────────── vocabulário ─────────────────────────

const DIA_SEMANA = '(domingo|dom|segunda|seg|terca|ter|quarta|qua|quinta|qui|sexta|sex|sabado|sab)(?:[- ]?feira)?';
const INDICE_SEMANA: Readonly<Record<string, number>> = {
  domingo: 0, dom: 0, segunda: 1, seg: 1, terca: 2, ter: 2, quarta: 3, qua: 3,
  quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sab: 6,
};
const DIAS_ESCRITOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const CABECALHO = new RegExp(
  `^[\\s•·*>\\-–—]*(?:dia\\s+)?(?:${DIA_SEMANA}(?![a-z0-9])[\\s,.:;\\-–—]*(?:dia\\s+)?)?` +
  '(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?(?![\\d/])',
);
const SEPARADORES_CABECALHO = /^[\s,.:;|·•\-–—]+/;
const SEMANA_NO_INICIO = new RegExp(`^${DIA_SEMANA}(?![a-z0-9])`);
const EVENTO_NO_INICIO = /^(santa ceia|ceia|natal|reveillon|virada|batismo|vigilia)(?![a-z0-9])/;
const PREFIXO_SEMANA = /^(?:domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:[- ]?feira)?(?![a-z0-9])[\s:.,;\-–—]*/;
const PREFIXO_TURNO = /^(?:(?:de|pela|a|na|no)\s+)?(manha|tarde|noite)(?![a-z0-9])\s*(?:\(?\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:hs|h|min)?\s*\)?)?[\s:.,;\-–—]*/;
const PREFIXO_CULTO = /^culto\s*(?:[:\-–—]|$)[\s:.,;\-–—]*/;
const PREFIXO_HORA = /^\(?(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:hs|h|min)?\)?(?![a-z0-9])[\s:.,;\-–—]*/;
const HORA_SOLTA = /(?<![\d/])(\d{1,2})\s*(?:h|:)\s*(\d{2})?(?![\d/])/g;
const SEMANA_ANTES_DA_DATA = new RegExp(`(?<![a-z])${DIA_SEMANA}[\\s,.:;·•\\-–—]*$`);
const SEMANA_DEPOIS_DA_DATA = new RegExp(`^[\\s,.:;·•\\-–—]*${DIA_SEMANA}(?![a-z0-9])`);
const DATA_SOLTA = /(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])/g;
const TURNO_POR_NOME: Readonly<Record<string, Turno>> = { manha: 'manha', tarde: 'tarde', noite: 'noite', culto: 'unico' };

/** Palavras que nunca são nome (comparadas sem acento). */
const IGNORADAS = new Set([
  'disponivel', 'disponiveis', 'indisponivel', 'quarta', 'feira', 'domingo', 'segunda', 'terca', 'quinta', 'sexta', 'sabado',
  'manha', 'tarde', 'noite', 'vago', 'vaga', 'vagas', 'vazio', 'ninguem',
  'a', 'o', 'as', 'os', 'um', 'uma', 'e', 'ou', 'em', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'com', 'sem', 'por', 'para',
  'pra', 'pro', 'que', 'se', 'so', 'ja', 'nao', 'sim', 'ok', 'eu', 'ele', 'ela', 'voce', 'vc', 'meu', 'minha', 'seu', 'sua',
  'aqui', 'hoje', 'amanha', 'dia', 'dias', 'culto', 'cultos', 'escala', 'servir', 'nome', 'nomes', 'coloque', 'estiver',
  'estou', 'to', 'vou', 'posso', 'pode', 'consigo', 'talvez', 'obs', 'obrigado', 'obrigada', 'amem', 'bom', 'boa',
  'pessoal', 'turno', 'horario', 'altar', 'confirmado', 'confirmada', 'presente',
  'pr', 'pastor', 'pastora', 'irmao', 'irma', 'diacono', 'diaconisa', 'presbitero', 'ev', 'evangelista',
]);
const PARTICULAS = new Set(['da', 'de', 'di', 'do', 'du', 'das', 'dos']);
/** Onde o nome da pessoa termina numa mensagem de disponibilidade ("Meu nome é Herick e posso…"). */
const FIM_DO_NOME = new Set(['e', 'posso', 'pode', 'estou', 'to', 'vou', 'quero', 'gostaria', 'consigo', 'disponivel',
  'para', 'pra', 'no', 'na', 'nos', 'nas', 'dia', 'dias', 'servir', 'nestes', 'neste', 'nesses', 'nesse', 'nessas', 'nessa',
  'aqui', 'tambem', 'so', 'mas', 'que', 'do', 'ministerio', 'equipe']);
const PESSOA = /(?:^|[^a-z])(?:meu nome (?:e|eh)|me chamo|(?:aqui|quem fala) (?:e|eh)(?: o| a)?|(?:eu )?sou (?:o|a))\s+/;

function letras(s: string): number {
  return Array.from(s).filter((c) => /\p{L}/u.test(c)).length;
}

function chaveDeNome(texto: string): string {
  return (String(texto).normalize('NFC').match(PALAVRA) ?? []).map((p) => normalizar(p)).join(' ');
}

// ───────────────────────── índice de nomes ─────────────────────────

interface Candidato { membroId: string; nome: string; prioridade: number }
interface Casamento { membroId: string; nome: string; ambiguo: string[] }

class IndiceNomes {
  private readonly porChave = new Map<string, Candidato[]>();
  private readonly porTamanho = new Map<number, { tokens: string[]; candidatos: Candidato[] }[]>();
  maxTokens = 1;

  constructor(membros: readonly MembroParaParser[]) {
    for (const m of membros) {
      if (!m || typeof m.id !== 'string' || !m.id || typeof m.nome !== 'string') continue;
      this.adicionar(m.nome, m, 0);
      this.adicionar(m.nome.replace(/\([^)]*\)/g, ' '), m, 1);
      for (const dentro of m.nome.matchAll(/\(([^)]*)\)/g)) this.adicionar(dentro[1] ?? '', m, 1);
      for (const apelido of Array.isArray(m.apelidos) ? m.apelidos : []) {
        if (typeof apelido === 'string') this.adicionar(apelido, m, 1);
      }
    }
    for (const [chave, candidatos] of this.porChave) {
      const tokens = chave.split(' ');
      this.maxTokens = Math.max(this.maxTokens, tokens.length);
      const lista = this.porTamanho.get(tokens.length) ?? [];
      lista.push({ tokens, candidatos });
      this.porTamanho.set(tokens.length, lista);
    }
  }

  private adicionar(texto: string, m: MembroParaParser, prioridade: number): void {
    const chave = chaveDeNome(texto);
    if (!chave) return;
    const lista = this.porChave.get(chave) ?? [];
    const existente = lista.find((c) => c.membroId === m.id);
    if (existente) existente.prioridade = Math.min(existente.prioridade, prioridade);
    else lista.push({ membroId: m.id, nome: m.nome, prioridade });
    this.porChave.set(chave, lista);
  }

  private static melhor(candidatos: readonly Candidato[]): Casamento | null {
    if (!candidatos.length) return null;
    const menor = Math.min(...candidatos.map((c) => c.prioridade));
    const melhores = candidatos.filter((c) => c.prioridade === menor);
    const primeiro = melhores[0]!;
    return { membroId: primeiro.membroId, nome: primeiro.nome, ambiguo: melhores.length > 1 ? melhores.map((c) => c.nome) : [] };
  }

  exato(tokens: readonly string[]): Casamento | null {
    const candidatos = this.porChave.get(tokens.join(' '));
    return candidatos ? IndiceNomes.melhor(candidatos) : null;
  }

  /** Candidatos a um erro de digitação: mesmo número de palavras, uma palavra (com 5+ letras) a 1 de distância. */
  aproximado(tokens: readonly string[]): { casamento: Casamento | null; parecidos: string[] } {
    const porMembro = new Map<string, Candidato>();
    for (const { tokens: chave, candidatos } of this.porTamanho.get(tokens.length) ?? []) {
      let diferencas = 0;
      let ok = true;
      for (let i = 0; i < tokens.length && ok; i++) {
        if (tokens[i] === chave[i]) continue;
        diferencas++;
        if (diferencas > 1 || letras(tokens[i]!) < 5 || levenshtein(tokens[i]!, chave[i]!) !== 1) ok = false;
      }
      if (!ok || diferencas !== 1) continue;
      for (const c of candidatos) {
        const atual = porMembro.get(c.membroId);
        if (!atual || c.prioridade < atual.prioridade) porMembro.set(c.membroId, c);
      }
    }
    const lista = [...porMembro.values()];
    if (lista.length === 1) return { casamento: { membroId: lista[0]!.membroId, nome: lista[0]!.nome, ambiguo: [] }, parecidos: [] };
    return { casamento: null, parecidos: lista.map((c) => c.nome) };
  }
}

// ───────────────────────── nomes de uma linha ─────────────────────────

type TipoToken = 'palavra' | 'particula' | 'lider' | 'ignorar';
interface Token { original: string; norma: string; tipo: TipoToken }
interface NomeLido { ref: RefNomeDTO; lider: boolean }

/** Contexto compartilhado da leitura: índice, avisos e linhas não reconhecidas. */
class Leitura {
  readonly avisos = new Set<string>();
  readonly naoReconhecidos: { linha: number; texto: string }[] = [];
  constructor(readonly indice: IndiceNomes) {}

  avisar(linha: number, texto: string): void {
    this.avisos.add(`Linha ${linha}: ${texto}`);
  }

  naoReconhecido(linha: number, texto: string): void {
    if (!this.naoReconhecidos.some((n) => n.linha === linha && n.texto === texto)) this.naoReconhecidos.push({ linha, texto });
  }

  /** Separa a linha em trechos (separadores fora de parênteses) e lê os nomes de cada um. */
  lerNomes(texto: string, linha: number): NomeLido[] {
    const saida: NomeLido[] = [];
    for (const trecho of dividirTrechos(texto)) saida.push(...this.lerTrecho(trecho, linha));
    return saida;
  }

  private lerTrecho(trecho: string, linha: number): NomeLido[] {
    const tokens: Token[] = (trecho.match(PALAVRA) ?? []).map((original) => {
      const norma = normalizar(original);
      let tipo: TipoToken = 'palavra';
      if (norma === 'lider' || norma === 'lideres') tipo = 'lider';
      else if (/\d/.test(norma) || IGNORADAS.has(norma)) tipo = 'ignorar';
      else if (PARTICULAS.has(norma)) tipo = 'particula';
      return { original, norma, tipo };
    });
    const achados: { ref: RefNomeDTO; inicio: number; fim: number }[] = [];
    const lideres: number[] = [];
    let pendentes: { token: Token; indice: number }[] = [];

    const descarregar = () => {
      let lista = pendentes;
      pendentes = [];
      while (lista.length && lista[0]!.token.tipo === 'particula') lista = lista.slice(1);
      while (lista.length && lista[lista.length - 1]!.token.tipo === 'particula') lista = lista.slice(0, -1);
      const significativas = lista.filter((p) => p.token.tipo === 'palavra' && letras(p.token.norma) >= 2);
      if (!significativas.length) return;
      const original = lista.map((p) => p.token.original).join(' ');
      if (significativas.length > 3) {
        this.naoReconhecido(linha, original);
        return;
      }
      const nome = tituloNome(original);
      this.avisar(linha, `nome novo “${nome}”.`);
      achados.push({
        ref: { membroId: '', nome, novo: true, original, aproximado: false },
        inicio: lista[0]!.indice, fim: lista[lista.length - 1]!.indice,
      });
    };

    let i = 0;
    while (i < tokens.length) {
      const tk = tokens[i]!;
      if (tk.tipo === 'lider') { descarregar(); lideres.push(i); i++; continue; }
      if (tk.tipo === 'ignorar') { descarregar(); i++; continue; }
      // maior nome conhecido a partir daqui
      let k = 0;
      let casamento: Casamento | null = null;
      let limite = 0;
      while (limite < this.indice.maxTokens && i + limite < tokens.length) {
        const t = tokens[i + limite]!.tipo;
        if (t !== 'palavra' && t !== 'particula') break;
        limite++;
      }
      for (let n = limite; n >= 1 && !casamento; n--) {
        const c = this.indice.exato(tokens.slice(i, i + n).map((t) => t.norma));
        if (c) { casamento = c; k = n; }
      }
      let aproximado = false;
      if (!casamento && tk.tipo === 'palavra') {
        let parecidos: string[] = [];
        for (let n = limite; n >= 1 && !casamento; n--) {
          const r = this.indice.aproximado(tokens.slice(i, i + n).map((t) => t.norma));
          if (r.casamento) { casamento = r.casamento; k = n; aproximado = true; }
          else if (!parecidos.length && r.parecidos.length > 1) parecidos = r.parecidos;
        }
        if (!casamento && parecidos.length) {
          this.avisar(linha, `“${tk.original}” parece ${juntarComOu(parecidos)}; não deu para escolher.`);
        }
      }
      if (!casamento) { pendentes.push({ token: tk, indice: i }); i++; continue; }
      descarregar();
      const original = tokens.slice(i, i + k).map((t) => t.original).join(' ');
      if (aproximado) this.avisar(linha, `“${original}” entendido como ${casamento.nome}.`);
      else if (casamento.ambiguo.length) this.avisar(linha, `“${original}” pode ser ${juntarComOu(casamento.ambiguo)}; ficou ${casamento.nome}.`);
      achados.push({
        ref: { membroId: casamento.membroId, nome: casamento.nome, novo: false, original, aproximado },
        inicio: i, fim: i + k - 1,
      });
      i += k;
    }
    descarregar();

    const marcados = new Set<number>();
    for (const p of lideres) {
      let alvo = -1;
      for (let j = achados.length - 1; j >= 0; j--) {
        if (achados[j]!.fim < p) { alvo = j; break; }
      }
      if (alvo < 0) alvo = achados.findIndex((a) => a.inicio > p);
      if (alvo >= 0) marcados.add(alvo);
    }
    return achados.map((a, j) => ({ ref: a.ref, lider: marcados.has(j) }));
  }
}

function juntarComOu(nomes: readonly string[]): string {
  const unicos = [...new Set(nomes)];
  return unicos.length < 2 ? unicos.join('') : `${unicos.slice(0, -1).join(', ')} ou ${unicos[unicos.length - 1]!}`;
}

/** Trechos da linha separados por / , ; | + & • · e por " l ", " e ", " - " (fora de parênteses). */
function dividirTrechos(texto: string): string[] {
  const trechos: string[] = [];
  let atual = '';
  let profundidade = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (c === '(' || c === '[') profundidade++;
    else if ((c === ')' || c === ']') && profundidade > 0) profundidade--;
    if (profundidade === 0) {
      if ('/,;|+&•·'.includes(c)) { trechos.push(atual); atual = ''; continue; }
      if (c === ' ') {
        const m = /^ +(?:l|e|E|-|–|—) +/.exec(texto.slice(i));
        if (m) { trechos.push(atual); atual = ''; i += m[0].length - 1; continue; }
      }
    }
    atual += c;
  }
  trechos.push(atual);
  return trechos.map((t) => t.trim()).filter(Boolean);
}

function identidade(ref: RefNomeDTO): string {
  return ref.novo ? `novo:${normalizar(ref.nome)}` : `id:${ref.membroId}`;
}

// ───────────────────────── anos ─────────────────────────

/** Resolve o ano das datas sem ano: título → hoje (ano mais perto) → anoPadrao, com a virada dez→jan. */
class Anos {
  private corrente: number | null = null;
  private mesAnterior: number | null = null;
  constructor(private readonly anoPadrao: number, private readonly hoje: string | null, public anoTitulo: number | null = null) {}

  resolver(dia: number, mes: number, escrito: number | null): number {
    if (escrito !== null) this.corrente = escrito;
    else if (this.corrente === null) this.corrente = this.anoTitulo ?? (this.hoje ? anoMaisPerto(dia, mes, this.hoje) : this.anoPadrao);
    else if (this.mesAnterior !== null && mes < this.mesAnterior && this.mesAnterior - mes >= 6) this.corrente++;
    this.mesAnterior = mes;
    return this.corrente;
  }
}

function anoMaisPerto(dia: number, mes: number, hoje: string): number {
  const { ano } = partesData(hoje);
  let melhor = ano;
  let menor = Number.POSITIVE_INFINITY;
  for (const candidato of [ano - 1, ano, ano + 1]) {
    const data = dataISO(candidato, mes, dia);
    if (partesData(data).mes !== mes) continue;
    const distancia = Math.abs(diasEntre(hoje, data));
    if (distancia < menor) { menor = distancia; melhor = candidato; }
  }
  return melhor;
}

function anoEscrito(texto: string | undefined): number | null {
  if (!texto) return null;
  return texto.length === 2 ? 2000 + Number(texto) : Number(texto);
}

// ───────────────────────── escala ─────────────────────────

interface CultoEmMontagem {
  data: string; turno: Turno; titulo: string; extra: boolean;
  lider: RefNomeDTO | null; servos: RefNomeDTO[]; linhas: Set<number>;
}

interface Bloco {
  data: string; semana: number; linha: number;
  evento: string; eventosPorTurno: Map<Turno, string>;
  turnoAtual: Turno | null; avisouSemTurno: boolean; usado: boolean;
}

interface Cabecalho {
  dia: number; mes: number; ano: number | null; semanaEscrita: number | null;
  evento: string; eventosPorTurno: Map<Turno, string>;
  /** "(manhã)" ou "(10h)" logo depois da data: resolvido com o dia da semana real */
  turnoTexto: string | null;
  resto: string;
}

function lerEventosPorTurno(dentro: string): Map<Turno, string> | null {
  const mapa = new Map<Turno, string>();
  for (const parte of dentro.split(';')) {
    const i = parte.lastIndexOf(':');
    if (i < 0) return null;
    const evento = normalizarEvento(parte.slice(0, i));
    const nomes = normalizar(parte.slice(i + 1)).split(/\s*(?:,|\be\b)\s*/).map((s) => s.trim()).filter(Boolean);
    if (!evento || !nomes.length) return null;
    for (const nome of nomes) {
      const turno = TURNO_POR_NOME[nome];
      if (!turno) return null;
      mapa.set(turno, evento);
    }
  }
  return mapa.size ? mapa : null;
}

/** Turno escrito sozinho ("manhã", "10h") — para "(manhã)" num cabeçalho. */
function turnoSozinho(dobrado: string, semana: number): Turno | null {
  const t = dobrado.trim();
  if (TURNO_POR_NOME[t]) return TURNO_POR_NOME[t]!;
  const m = /^(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:hs|h|min)?$/.exec(t);
  if (m) return semana === 0 ? turnoPorHora(`${m[1]}h${m[2] ?? ''}`) : 'unico';
  return null;
}

function lerCabecalho(linha: Linha): Cabecalho | null {
  const m = CABECALHO.exec(linha.dobrada);
  if (!m) return null;
  const dia = Number(m[2]);
  const mes = Number(m[3]);
  let semanaEscrita = m[1] ? INDICE_SEMANA[m[1]] ?? null : null;
  let t = linha.texto.slice(m[0].length);
  let d = linha.dobrada.slice(m[0].length);
  let evento = '';
  const eventosPorTurno = new Map<Turno, string>();
  let turnoTexto: string | null = null;
  const cortar = (n: number) => { t = t.slice(n); d = d.slice(n); };
  for (let voltas = 0; voltas < 20; voltas++) {
    const sep = SEPARADORES_CABECALHO.exec(d);
    if (sep) { cortar(sep[0].length); continue; }
    const semana = SEMANA_NO_INICIO.exec(d);
    if (semana) {
      if (semanaEscrita === null) semanaEscrita = INDICE_SEMANA[semana[1]!] ?? null;
      cortar(semana[0].length);
      continue;
    }
    if (d.startsWith('(')) {
      const fim = d.indexOf(')');
      if (fim < 0) break;
      const dentro = t.slice(1, fim);
      const dentroDobrado = d.slice(1, fim);
      if (/(?:^|[^a-z])lider(?:$|[^a-z])/.test(dentroDobrado)) break;
      const porTurno = lerEventosPorTurno(dentro);
      if (porTurno) {
        for (const [turno, ev] of porTurno) eventosPorTurno.set(turno, ev);
      } else if (turnoSozinho(dentroDobrado, 0) !== null) {
        turnoTexto = dentroDobrado;
      } else if (normalizarEvento(dentro)) {
        evento = normalizarEvento(dentro);
      }
      cortar(fim + 1);
      continue;
    }
    const ev = EVENTO_NO_INICIO.exec(d);
    if (ev) { evento = EVENTOS_CONHECIDOS[ev[1]!] ?? evento; cortar(ev[0].length); continue; }
    break;
  }
  return { dia, mes, ano: anoEscrito(m[4]), semanaEscrita, evento, eventosPorTurno, turnoTexto, resto: t.trim() };
}

interface ResultadoEscala {
  titulo: string; aviso: string; cultos: CultoImportadoDTO[]; cabecalhos: number;
}

function lerEscala(linhas: readonly Linha[], leitura: Leitura, opcoes: { anoPadrao: number; hoje: string | null }): ResultadoEscala {
  let fase: 'preambulo' | 'blocos' | 'fim' = 'preambulo';
  let titulo = '';
  let aviso = '';
  let cabecalhos = 0;
  const anos = new Anos(opcoes.anoPadrao, opcoes.hoje);
  const cultos = new Map<string, CultoEmMontagem>();
  let bloco: Bloco | null = null;

  const fecharBloco = () => {
    if (bloco && !bloco.usado) {
      if (bloco.semana === 0) leitura.avisar(bloco.linha, `domingo ${formatarDDMM(bloco.data)} sem turnos nem nomes; nada foi lido desse dia.`);
      else culto(bloco, 'unico', bloco.linha);
    }
  };

  const culto = (b: Bloco, turno: Turno, linha: number): CultoEmMontagem => {
    const chave = `${b.data}|${turno}`;
    let c = cultos.get(chave);
    if (!c) {
      c = {
        data: b.data, turno, titulo: b.eventosPorTurno.get(turno) ?? b.evento,
        extra: !(b.semana === 0 || b.semana === 3), lider: null, servos: [], linhas: new Set([b.linha]),
      };
      cultos.set(chave, c);
    }
    c.linhas.add(linha);
    b.usado = true;
    return c;
  };

  const aplicar = (c: CultoEmMontagem, nomes: readonly NomeLido[], linha: number) => {
    for (const { ref, lider } of nomes) {
      const id = identidade(ref);
      if (lider) {
        if (!c.lider) {
          c.lider = ref;
          c.servos = c.servos.filter((s) => identidade(s) !== id);
          continue;
        }
        if (identidade(c.lider) === id) continue;
        leitura.avisar(linha, `mais de um líder no mesmo culto; ${ref.nome} ficou como servo.`);
      }
      if (c.lider && identidade(c.lider) === id) continue;
      if (c.servos.some((s) => identidade(s) === id)) continue;
      c.servos.push(ref);
    }
  };

  const lerConteudo = (b: Bloco, texto: string, linha: number, limpa: string) => {
    let t = texto.trim();
    let d = dobrar(t);
    const cortar = (n: number) => { t = t.slice(n).trim(); d = dobrar(t); };
    const semana = PREFIXO_SEMANA.exec(d);
    if (semana) cortar(semana[0].length);
    let turno: Turno | null = null;
    const pt = PREFIXO_TURNO.exec(d);
    if (pt) { turno = TURNO_POR_NOME[pt[1]!]!; cortar(pt[0].length); }
    else {
      const pc = PREFIXO_CULTO.exec(d);
      if (pc) { turno = 'unico'; cortar(pc[0].length); }
      else {
        const ph = PREFIXO_HORA.exec(d);
        if (ph) { turno = b.semana === 0 ? turnoPorHora(`${ph[1]}h${ph[2] ?? ''}`) : 'unico'; cortar(ph[0].length); }
      }
    }
    if (turno) b.turnoAtual = turno;
    // "(vago)" do texto exportado: culto sem ninguém
    const vago = /^\(?\s*(?:vago|vaga|vazio|ninguem)\s*\)?[.!]?$/.test(d);
    const nomes = t && !vago ? leitura.lerNomes(t, linha) : [];
    if (!turno && !vago && !nomes.length) {
      if (t) leitura.naoReconhecido(linha, limpa);
      return;
    }
    let alvo = turno ?? b.turnoAtual;
    if (!alvo) {
      alvo = 'unico';
      if (b.semana === 0 && !b.avisouSemTurno) {
        b.avisouSemTurno = true;
        leitura.avisar(linha, `domingo ${formatarDDMM(b.data)} sem turno (Manhã, Tarde ou Noite); ficou como culto único.`);
      }
    }
    aplicar(culto(b, alvo, linha), nomes, linha);
  };

  for (const linha of linhas) {
    if (!linha.texto) continue;
    if (LINK.test(linha.limpa)) continue;
    const cab = lerCabecalho(linha);
    if (cab) {
      fecharBloco();
      bloco = null;
      fase = 'blocos';
      cabecalhos++;
      const plausivel = cab.mes >= 1 && cab.mes <= 12 && cab.dia >= 1 && cab.dia <= 31;
      const data = plausivel ? dataISO(anos.resolver(cab.dia, cab.mes, cab.ano), cab.mes, cab.dia) : '';
      if (!plausivel || !dataValida(data) || partesData(data).dia !== cab.dia || partesData(data).mes !== cab.mes) {
        leitura.avisar(linha.numero, `data inválida “${linha.limpa}”.`);
        leitura.naoReconhecido(linha.numero, linha.limpa);
        continue;
      }
      const semana = diaSemana(data);
      if (cab.semanaEscrita !== null && cab.semanaEscrita !== semana) {
        leitura.avisar(linha.numero, `${formatarDDMMAAAA(data)} é ${DIAS_ESCRITOS[semana]!}, mas o texto diz ${DIAS_ESCRITOS[cab.semanaEscrita]!}.`);
      }
      bloco = {
        data, semana, linha: linha.numero, evento: cab.evento, eventosPorTurno: cab.eventosPorTurno,
        turnoAtual: null, avisouSemTurno: false, usado: false,
      };
      const turnoDoCabecalho = cab.turnoTexto ? turnoSozinho(cab.turnoTexto, semana) : null;
      if (turnoDoCabecalho) {
        bloco.turnoAtual = turnoDoCabecalho;
        culto(bloco, turnoDoCabecalho, linha.numero);
      }
      if (cab.resto) lerConteudo(bloco, cab.resto, linha.numero, linha.limpa);
      continue;
    }
    if (/^[^a-z]*atencao/.test(linha.dobrada)) {
      if (!aviso) aviso = linha.limpa;
      if (fase === 'blocos') { fecharBloco(); bloco = null; fase = 'fim'; }
      continue;
    }
    if (fase === 'fim') continue;
    if (fase === 'preambulo') {
      if (!titulo && /\p{L}/u.test(linha.texto)) titulo = linha.texto;
      if (anos.anoTitulo === null) {
        const ano = /(?<!\d)((?:19|20)\d{2})(?!\d)/.exec(linha.dobrada);
        if (ano) anos.anoTitulo = Number(ano[1]);
      }
      continue;
    }
    if (!bloco) { leitura.naoReconhecido(linha.numero, linha.limpa); continue; }
    lerConteudo(bloco, linha.texto, linha.numero, linha.limpa);
  }
  fecharBloco();

  return { titulo, aviso, cultos: finalizar(cultos), cabecalhos };
}

function finalizar(cultos: Map<string, CultoEmMontagem>): CultoImportadoDTO[] {
  return [...cultos.values()]
    .map((c) => ({
      data: c.data, turno: c.turno, titulo: c.titulo, extra: c.extra,
      lider: c.lider, servos: c.servos, linhas: [...c.linhas].sort((a, b) => a - b),
    }))
    .sort(compararCultos);
}

// ───────────────────────── disponibilidade ─────────────────────────

interface Pessoa { ref: RefNomeDTO; linha: number; posicao: number }

/** Procura "Meu nome é X" / "Aqui é o X" / "Sou o X" / "Me chamo X" e lê o nome (avisos de aproximação ou nome novo). */
function acharPessoa(linhas: readonly Linha[], indice: IndiceNomes, leitura: Leitura): Pessoa | null {
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]!;
    const m = PESSOA.exec(linha.dobrada);
    if (!m) continue;
    const inicio = m.index + m[0].length;
    const trecho = linha.texto.slice(inicio).split(/[,.;:!?]| [-–—] /)[0] ?? '';
    const palavras: string[] = [];
    for (const p of trecho.match(PALAVRA) ?? []) {
      const n = normalizar(p);
      if (FIM_DO_NOME.has(n) || /\d/.test(n) || palavras.length >= 4) break;
      palavras.push(p);
    }
    if (!palavras.length) continue;
    const nomes = new Leitura(indice).lerNomes(palavras.join(' '), linha.numero);
    const escolhido = nomes.find((n) => !n.ref.novo) ?? nomes[0];
    if (!escolhido) continue;
    const { ref } = escolhido;
    if (ref.aproximado) leitura.avisar(linha.numero, `“${ref.original}” entendido como ${ref.nome}.`);
    if (ref.novo) leitura.avisar(linha.numero, `nome novo “${ref.nome}”.`);
    return { ref, linha: i, posicao: inicio };
  }
  return null;
}

function lerDisponibilidade(linhas: readonly Linha[], pessoa: Pessoa, leitura: Leitura, opcoes: { anoPadrao: number; hoje: string | null }): CultoImportadoDTO[] {
  const anos = new Anos(opcoes.anoPadrao, opcoes.hoje);
  const cultos = new Map<string, CultoEmMontagem>();
  for (let i = pessoa.linha; i < linhas.length; i++) {
    const linha = linhas[i]!;
    if (!linha.texto || LINK.test(linha.limpa)) continue;
    const comeco = i === pessoa.linha ? pessoa.posicao : 0;
    const datas = [...linha.dobrada.matchAll(DATA_SOLTA)].filter((m) => (m.index ?? 0) >= comeco);
    datas.forEach((m, j) => {
      const inicio = m.index ?? 0;
      const fim = inicio + m[0].length;
      const proximo = datas[j + 1]?.index ?? linha.dobrada.length;
      const dia = Number(m[1]);
      const mes = Number(m[2]);
      const plausivel = mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31;
      const data = plausivel ? dataISO(anos.resolver(dia, mes, anoEscrito(m[3])), mes, dia) : '';
      if (!plausivel || partesData(data).mes !== mes) {
        leitura.avisar(linha.numero, `data inválida “${m[0]}”.`);
        leitura.naoReconhecido(linha.numero, linha.limpa);
        return;
      }
      const semana = diaSemana(data);
      const antes = linha.dobrada.slice(j === 0 ? comeco : (datas[j - 1]!.index ?? 0) + datas[j - 1]![0].length, inicio);
      const segmento = linha.dobrada.slice(fim, proximo);
      const segmentoTexto = linha.texto.slice(fim, proximo);
      const escrita = SEMANA_ANTES_DA_DATA.exec(antes) ?? SEMANA_DEPOIS_DA_DATA.exec(segmento);
      const semanaEscrita = escrita ? INDICE_SEMANA[escrita[1]!] ?? null : null;
      if (semanaEscrita !== null && semanaEscrita !== semana) {
        leitura.avisar(linha.numero, `${formatarDDMMAAAA(data)} é ${DIAS_ESCRITOS[semana]!}, mas o texto diz ${DIAS_ESCRITOS[semanaEscrita]!}.`);
      }
      let titulo = '';
      for (const grupo of segmentoTexto.matchAll(/\(([^()]*)\)/g)) {
        const dentro = grupo[1] ?? '';
        if (turnoSozinho(dobrar(dentro), semana) === null && normalizarEvento(dentro)) titulo = normalizarEvento(dentro);
      }
      const turnos = new Set<Turno>();
      if (semana === 0) {
        for (const w of segmento.matchAll(/(?<![a-z])(manha|tarde|noite)(?![a-z])/g)) turnos.add(TURNO_POR_NOME[w[1]!]!);
        for (const h of segmento.matchAll(HORA_SOLTA)) turnos.add(turnoPorHora(`${h[1]}h${h[2] ?? ''}`));
        turnos.delete('unico');
        if (!turnos.size) {
          turnos.add('unico');
          leitura.avisar(linha.numero, `domingo ${formatarDDMM(data)} sem turno (Manhã, Tarde ou Noite); ficou como culto único.`);
        }
      } else {
        turnos.add('unico');
      }
      for (const turno of turnos) {
        const chave = `${data}|${turno}`;
        let c = cultos.get(chave);
        if (!c) {
          c = { data, turno, titulo, extra: !(semana === 0 || semana === 3), lider: null, servos: [pessoa.ref], linhas: new Set() };
          cultos.set(chave, c);
        }
        if (titulo && !c.titulo) c.titulo = titulo;
        c.linhas.add(linha.numero);
      }
    });
  }
  return finalizar(cultos);
}

// ───────────────────────── entrada ─────────────────────────

function vazio(avisos: string[], naoReconhecidos: { linha: number; texto: string }[] = [], pessoa: RefNomeDTO | null = null): ResultadoParserDTO {
  return { tipo: 'desconhecido', titulo: '', aviso: '', pessoa, cultos: [], naoReconhecidos, avisos };
}

/**
 * Lê o texto colado do WhatsApp e devolve a escala (ou a disponibilidade) encontrada, com avisos.
 * Gabarito: seed/lista-whatsapp-nov-dez-2026.txt + seed/membros.json (anoPadrao 2026) → os 25 cultos de seed/esperado.json.
 */
export function analisarTexto(texto: string, opcoes: OpcoesParser): ResultadoParserDTO {
  const bruto = typeof texto === 'string' ? texto : '';
  const hoje = opcoes && dataValida(opcoes.hoje) ? opcoes.hoje : null;
  const anoPadrao = opcoes && Number.isInteger(opcoes.anoPadrao) && opcoes.anoPadrao >= 1000 && opcoes.anoPadrao <= 9999
    ? opcoes.anoPadrao
    : hoje ? partesData(hoje).ano : new Date().getUTCFullYear();
  const membros = opcoes && Array.isArray(opcoes.membros) ? opcoes.membros : [];
  const linhas = prepararLinhas(bruto);
  if (!linhas.some((l) => l.texto)) return vazio(['O texto está vazio.']);

  const indice = new IndiceNomes(membros);
  const contexto = { anoPadrao, hoje };

  // disponibilidade
  const leituraDisponibilidade = new Leitura(indice);
  const pessoa = acharPessoa(linhas, indice, leituraDisponibilidade);
  const disponibilidade = pessoa
    ? { cultos: lerDisponibilidade(linhas, pessoa, leituraDisponibilidade, contexto), leitura: leituraDisponibilidade }
    : null;

  // escala
  const leituraEscala = new Leitura(indice);
  const escala = lerEscala(linhas, leituraEscala, contexto);
  const idPessoa = pessoa ? identidade(pessoa.ref) : null;
  const escalaTemOutros = escala.cultos.some((c) => [c.lider, ...c.servos].some((r) => r && identidade(r) !== idPessoa));

  if (pessoa && disponibilidade && disponibilidade.cultos.length && !escalaTemOutros) {
    return {
      tipo: 'disponibilidade', titulo: '', aviso: '', pessoa: pessoa.ref, cultos: disponibilidade.cultos,
      naoReconhecidos: disponibilidade.leitura.naoReconhecidos, avisos: [...disponibilidade.leitura.avisos],
    };
  }
  if (escala.cultos.length) {
    return {
      tipo: 'escala', titulo: escala.titulo, aviso: escala.aviso, pessoa: null, cultos: escala.cultos,
      naoReconhecidos: leituraEscala.naoReconhecidos, avisos: [...leituraEscala.avisos],
    };
  }
  const avisos = [...leituraEscala.avisos];
  if (pessoa) avisos.push(`Achei o nome ${pessoa.ref.nome}, mas nenhuma data (use dd/mm).`);
  else if (!escala.cabecalhos) avisos.push('Não encontrei datas no formato dd/mm.');
  return vazio(avisos, leituraEscala.naoReconhecidos, pessoa ? pessoa.ref : null);
}

/**
 * Reconhece os nomes de um texto livre (mesmas regras da lista): 'Herick / Danjel e Pedro' → Herick, Daniel (aproximado), Pedro (novo).
 * Útil para "não estou na lista" e buscas por nome.
 */
export function reconhecerNomes(texto: string, membros: readonly MembroParaParser[]): RefNomeDTO[] {
  const leitura = new Leitura(new IndiceNomes(Array.isArray(membros) ? membros : []));
  const linha = prepararLinhas(typeof texto === 'string' ? texto : '').map((l) => l.texto).join(' / ');
  const vistos = new Set<string>();
  return leitura.lerNomes(linha, 1).map((n) => n.ref).filter((ref) => {
    const id = identidade(ref);
    if (vistos.has(id)) return false;
    vistos.add(id);
    return true;
  });
}
