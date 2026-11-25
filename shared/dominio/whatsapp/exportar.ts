/**
 * Textos prontos para o WhatsApp (SPEC §3 e §6) e links wa.me. Funções puras.
 */
import type { PapelEscala, StatusEscala, Turno } from '../../api';
import { compararCultos, nomeTurno } from '../turnos';
import { formatarDDMM, formatarDDMMAAAA, nomeDia, nomeDiaCurto, nomeMes, partesData, dataValida } from '../datas';
import { fichaAgenda, diaDaFrase } from '../formato';
import { apenasDigitos, maiusculaInicial, normalizar, primeiroNome, semMarcadores } from '../texto';

/** Regra da igreja para eventos fora dos dias fixos (aviso padrão da escala). */
export const AVISO_VESPERA = 'Quando houver cultos/eventos fora dos dias fixos de culto, a escala será feita um dia antes.';
/** Nome da igreja nos textos. */
export const IGREJA_PADRAO = 'Boas Novas Church';
/** Título padrão da lista ("ESCALA DE SERVIÇO — NOVEMBRO/DEZEMBRO 2026"). */
export const TITULO_ESCALA_PADRAO = 'Escala de Serviço';

const TRAVESSAO = ' — ';
const PONTO = ' · ';
const MARCADOR = '• ';
const STATUS_NA_LISTA: ReadonlySet<string> = new Set<StatusEscala>(['confirmado', 'pendente', 'troca']);

/** O que textoEscala precisa de cada culto (CultoComEscalaDTO serve). */
export interface CultoParaTexto {
  id?: string;
  data: string;
  hora?: string;
  turno: Turno;
  titulo?: string;
  escalados: ReadonlyArray<{ nome: string; papel: PapelEscala; status: StatusEscala }>;
}

/** Opções de textoEscala. */
export interface OpcoesTextoEscala {
  /** nome do ministério ('Altar') ou o próprio ministério (o aviso dele vale quando `aviso` não vier) */
  ministerio?: string | { nome: string; aviso?: string };
  igreja?: string;
  titulo?: string;
  /** período do título; padrão: calculado dos cultos exportados ('Novembro/Dezembro 2026') */
  periodo?: string;
  /** aviso do rodapé; padrão: aviso do ministério ou AVISO_VESPERA; '' tira a linha */
  aviso?: string;
  /** link do grupo; a linha "Veja a escala e coloque seu nome" só aparece com link */
  link?: string;
  /** filtros de data, inclusive ('AAAA-MM-DD') */
  de?: string;
  ate?: string;
  /** com `hoje` e sem `incluirPassados`, só entram cultos de hoje em diante */
  hoje?: string;
  incluirPassados?: boolean;
}

function juntarComE(lista: readonly string[]): string {
  return lista.length < 2 ? lista.join('') : `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]!}`;
}

/** 'Alê / Herbert (Rômulo líder)'; só líder: '(Rômulo líder)'; ninguém: '(vago)'. */
function pessoasDaLinha(culto: CultoParaTexto): string {
  const valem = culto.escalados.filter((e) => STATUS_NA_LISTA.has(e.status));
  const lider = valem.find((e) => e.papel === 'lider');
  const servos = valem.filter((e) => e !== lider).map((e) => semMarcadores(e.nome)).filter(Boolean);
  let corpo = servos.join(' / ');
  const nomeLider = lider ? semMarcadores(lider.nome) : '';
  if (nomeLider) corpo += `${corpo ? ' ' : ''}(${nomeLider} líder)`;
  return corpo || '(vago)';
}

/** Evento no cabeçalho do dia: ' (Santa Ceia)' se todos os cultos têm o mesmo; senão ' (Batismo: Noite)'. */
function eventoDoDia(cultos: readonly CultoParaTexto[]): string {
  const titulos = cultos.map((c) => semMarcadores(c.titulo));
  if (titulos[0] && titulos.every((t) => t === titulos[0])) return ` (${titulos[0]})`;
  const ordem: string[] = [];
  const turnos = new Map<string, string[]>();
  cultos.forEach((c, i) => {
    const t = titulos[i];
    if (!t) return;
    if (!turnos.has(t)) { turnos.set(t, []); ordem.push(t); }
    turnos.get(t)!.push(nomeTurno(c.turno));
  });
  if (!ordem.length) return '';
  return ` (${ordem.map((t) => `${t}: ${juntarComE(turnos.get(t)!)}`).join('; ')})`;
}

function linhaAviso(aviso: string): string {
  const t = semMarcadores(aviso);
  if (!t) return '';
  return `*${normalizar(t).startsWith('atencao') ? t : `Atenção 🚨: ${t}`}*`;
}

/** Período por extenso: 'Novembro/Dezembro 2026', 'Dezembro 2026/Janeiro 2027', 'Outubro a Dezembro 2026'; vazio → ''. */
export function periodoDosCultos(cultos: ReadonlyArray<{ data: string } | string>): string {
  const datas = cultos.map((c) => (typeof c === 'string' ? c : c.data)).filter(dataValida).sort();
  if (!datas.length) return '';
  const a = partesData(datas[0]!);
  const b = partesData(datas[datas.length - 1]!);
  const nomeA = maiusculaInicial(nomeMes(a.mes));
  const nomeB = maiusculaInicial(nomeMes(b.mes));
  if (a.ano === b.ano && a.mes === b.mes) return `${nomeA} ${a.ano}`;
  const meses = (b.ano - a.ano) * 12 + (b.mes - a.mes);
  const liga = meses === 1 ? '/' : ' a ';
  if (a.ano === b.ano) return `${nomeA}${liga}${nomeB} ${a.ano}`;
  return `${nomeA} ${a.ano}${liga}${nomeB} ${b.ano}`;
}

/**
 * Texto da escala para o grupo no formato da lista atual (SPEC §3): título em itálico, um dia por bloco em negrito,
 * turnos com "Manhã:" (culto único só com os nomes), líder como "(Nome líder)", "(vago)", aviso e link no fim.
 * Só confirmado, pendente e troca entram (nao_pode não).
 */
export function textoEscala(cultos: readonly CultoParaTexto[], opcoes: OpcoesTextoEscala = {}): string {
  const ministerio = typeof opcoes.ministerio === 'string' ? { nome: opcoes.ministerio } : opcoes.ministerio;
  let lista = cultos.filter((c) => dataValida(c.data));
  if (opcoes.de) lista = lista.filter((c) => c.data >= opcoes.de!);
  if (opcoes.ate) lista = lista.filter((c) => c.data <= opcoes.ate!);
  if (opcoes.hoje && !opcoes.incluirPassados) lista = lista.filter((c) => c.data >= opcoes.hoje!);
  lista = [...lista].sort(compararCultos);

  const periodo = opcoes.periodo !== undefined ? semMarcadores(opcoes.periodo) : periodoDosCultos(lista);
  let titulo = semMarcadores(opcoes.titulo) || TITULO_ESCALA_PADRAO;
  if (periodo) titulo += TRAVESSAO + periodo;
  const assinatura = [semMarcadores(ministerio?.nome), semMarcadores(opcoes.igreja) || IGREJA_PADRAO].filter(Boolean).join(PONTO);
  const blocos: string[][] = [[`_${titulo.toLocaleUpperCase('pt-BR')}_`, `*${assinatura}*`]];

  const dias = new Map<string, CultoParaTexto[]>();
  for (const c of lista) {
    const dia = dias.get(c.data) ?? [];
    dia.push(c);
    dias.set(c.data, dia);
  }
  for (const [data, doDia] of dias) {
    const linhas = [`*${formatarDDMMAAAA(data)}${TRAVESSAO}${nomeDia(data)}${eventoDoDia(doDia)}*`];
    for (const c of doDia) {
      const pessoas = pessoasDaLinha(c);
      linhas.push(c.turno === 'unico' ? pessoas : `${nomeTurno(c.turno)}: ${pessoas}`);
    }
    blocos.push(linhas);
  }
  if (!dias.size) blocos.push(['Nenhum culto neste período.']);

  const rodape: string[] = [];
  const aviso = linhaAviso(opcoes.aviso ?? ministerio?.aviso ?? AVISO_VESPERA);
  if (aviso) rodape.push(aviso);
  const link = (opcoes.link ?? '').trim();
  if (link) rodape.push(`Veja a escala e coloque seu nome: ${link}`);
  if (rodape.length) blocos.push(rodape);
  return blocos.map((b) => b.join('\n')).join('\n\n');
}

/** Culto mínimo para as mensagens (CultoDTO serve). */
export interface CultoParaMensagem { id?: string; data: string; hora?: string; turno: Turno; titulo?: string }

/** 'no altar', 'na recepção', 'na mídia', 'no louvor' (contração pelo gênero provável do nome do ministério). */
export function noMinisterio(ministerio: string): string {
  const nome = semMarcadores(ministerio).toLocaleLowerCase('pt-BR');
  if (!nome) return '';
  const primeira = normalizar(nome.split(' ')[0]);
  const feminino = primeira === 'equipe' || primeira === 'escola' || /(?:a|cao|sao|dade|gem|ice|ie)$/.test(primeira);
  return `${feminino ? 'na' : 'no'} ${nome}`;
}

/** Linha da disponibilidade: '• Qua 25/11 · 19h30', '• Dom 06/12 · 10h (Santa Ceia)' (sem hora, o turno). */
export function linhaDisponibilidade(culto: CultoParaMensagem): string {
  const hora = semMarcadores(culto.hora);
  let linha = `${MARCADOR}${nomeDiaCurto(culto.data)} ${formatarDDMM(culto.data)}`;
  if (hora) linha += `${PONTO}${hora}`;
  else if (culto.turno !== 'unico') linha += `${PONTO}${nomeTurno(culto.turno)}`;
  const titulo = semMarcadores(culto.titulo);
  return titulo ? `${linha} (${titulo})` : linha;
}

/**
 * Mensagem de disponibilidade para o líder (o parser lê de volta):
 * 'Olá! Meu nome é *Herick* e posso servir no altar nestes cultos:' + uma linha por culto, em ordem de data.
 */
export function textoDisponibilidade(opcoes: { nome: string; ministerio?: string; cultos: readonly CultoParaMensagem[] }): string {
  const nome = semMarcadores(opcoes.nome);
  const onde = opcoes.ministerio ? ` ${noMinisterio(opcoes.ministerio)}` : '';
  const vistos = new Set<string>();
  const cultos = [...opcoes.cultos].filter((c) => {
    if (!dataValida(c.data)) return false;
    const chave = c.id ?? `${c.data}|${c.turno}|${c.hora ?? ''}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  }).sort(compararCultos);
  const abertura = nome
    ? `Olá! Meu nome é *${nome}* e posso servir${onde} nestes cultos:`
    : `Olá! Posso servir${onde} nestes cultos:`;
  return [abertura, ...cultos.map(linhaDisponibilidade)].join('\n');
}

/** Mensagem com o link pessoal ("minha escala") para mandar a um voluntário. */
export function textoLinkPessoal(opcoes: { nome: string; link: string; ministerio?: string }): string {
  const nome = primeiroNome(opcoes.nome);
  const escala = opcoes.ministerio ? `da escala ${doMinisterio(opcoes.ministerio)}` : 'das suas escalas';
  return [
    `${nome ? `Oi, ${nome}!` : 'Oi!'} Este é o seu link ${escala}. 💚`,
    'Por ele você vê seus dias, confirma presença, avisa quando não puder e pede troca.',
    'O link é só seu, não compartilhe:',
    opcoes.link.trim(),
  ].join('\n');
}

/** Mensagem com o link do grupo do ministério, no espírito da lista ("coloque seu nome no dia que estiver disponível"). */
export function textoLinkGrupo(opcoes: { ministerio: string; link: string; unidade?: string; aviso?: string }): string {
  const cabeca = [`Escala ${doMinisterio(opcoes.ministerio)}`, semMarcadores(opcoes.unidade)].filter(Boolean).join(PONTO);
  const linhas = [
    `*${maiusculaInicial(cabeca)}*`,
    'Coloque seu nome no dia em que estiver disponível para servir. É só abrir o link e escolher seu nome:',
    opcoes.link.trim(),
  ];
  const aviso = opcoes.aviso === undefined ? '' : linhaAviso(opcoes.aviso);
  return aviso ? `${linhas.join('\n')}\n\n${aviso}` : linhas.join('\n');
}

/** Item de lembrete: o culto (com status) ou { culto, status } como em LembreteDTO.itens. */
export type ItemLembrete = (CultoParaMensagem & { status?: StatusEscala }) | { culto: CultoParaMensagem; status?: StatusEscala };

function desembrulhar(item: ItemLembrete): { culto: CultoParaMensagem; status?: StatusEscala } {
  return 'culto' in item ? item : { culto: item, status: item.status };
}

/**
 * Lembrete para quem está pendente, no tom do convite (SPEC §6):
 * 'Oi, Ana! Você está na escala de domingo. Altar · BN Estoril · Dom | 10h. Pode confirmar?' + link pessoal.
 * Com mais de um culto, lista as fichas.
 */
export function textoLembrete(opcoes: { nome: string; itens: readonly ItemLembrete[]; ministerio: string; unidade: string; link?: string }): string {
  const nome = primeiroNome(opcoes.nome);
  const oi = nome ? `Oi, ${nome}!` : 'Oi!';
  const itens = opcoes.itens.map(desembrulhar).filter((i) => dataValida(i.culto.data))
    .sort((a, b) => compararCultos(a.culto, b.culto));
  const ficha = (c: CultoParaMensagem) => fichaAgenda({ funcao: semMarcadores(opcoes.ministerio), unidade: opcoes.unidade, data: c.data, hora: c.hora });
  const link = (opcoes.link ?? '').trim();
  const linhas: string[] = [];
  if (itens.length === 1) {
    const { culto, status } = itens[0]!;
    if (status === 'troca') {
      linhas.push(`${oi} Sua troca de ${diaDaFrase(culto.data)} ainda não tem substituto. ${ficha(culto)}.`);
      linhas.push(link ? 'Acompanhe pelo seu link:' : 'Fale com seu líder se precisar.');
    } else {
      linhas.push(`${oi} Você está na escala de ${diaDaFrase(culto.data)}. ${ficha(culto)}. Pode confirmar?`);
      if (link) linhas.push('É só abrir seu link:');
    }
  } else {
    linhas.push(`${oi} Você está na escala destes cultos:`);
    for (const { culto, status } of itens) {
      linhas.push(`${MARCADOR}${formatarDDMM(culto.data)}${PONTO}${ficha(culto)}${status === 'troca' ? `${PONTO}troca pedida` : ''}`);
    }
    linhas.push(link ? 'Pode confirmar? É só abrir seu link:' : 'Pode confirmar?');
  }
  if (link) linhas.push(link);
  return linhas.join('\n');
}

/** 'do altar', 'da recepção' (como noMinisterio, para "escala do altar"). */
function doMinisterio(ministerio: string): string {
  const com = noMinisterio(ministerio);
  return com.startsWith('na ') ? `da ${com.slice(3)}` : com.startsWith('no ') ? `do ${com.slice(3)}` : com;
}

/** Troca metades de emoji soltas (surrogates sem par) por U+FFFD para o encodeURIComponent não falhar. */
function textoBemFormado(texto: string): string {
  // com a flag u, pares de surrogates viram um só ponto de código; sobram só os soltos
  return texto.replace(/[\u{D800}-\u{DFFF}]/gu, '\u{FFFD}');
}

/**
 * Link do WhatsApp com a mensagem: https://wa.me/<dígitos>?text=<texto codificado>; sem número, https://wa.me/?text=….
 * Aceita máscara ('(31) 99999-8888'); 10–11 dígitos ganham o DDI 55; zero inicial sai; número curto demais é ignorado.
 */
export function linkWhatsApp(texto: string, numero?: string | null): string {
  let digitos = apenasDigitos(numero).replace(/^0+/, '');
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  if (digitos.length < 10 || digitos.length > 15) digitos = '';
  return `https://wa.me/${digitos}?text=${encodeURIComponent(textoBemFormado(String(texto ?? '')))}`;
}
