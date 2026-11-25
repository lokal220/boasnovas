/**
 * Texto: normalização para comparar nomes, slugs, distância de edição e formas de exibir nomes.
 * Funções puras, sem I/O.
 */

/** Caracteres invisíveis que o WhatsApp e os teclados colam no meio das palavras. */
const INVISIVEIS = /[\u{200B}-\u{200D}\u{2060}\u{FEFF}\u{00AD}]/gu;
/** Marcas diacríticas (acentos) depois da decomposição NFD. */
const DIACRITICOS = /\p{M}/gu;
/** Partículas que ficam em minúsculas no meio de um nome ("João da Silva"). */
const PARTICULAS = new Set(['da', 'de', 'di', 'do', 'du', 'das', 'dos', 'e']);

/** Texto para comparar: sem acento, minúsculo, espaços unicode viram um espaço simples, sem bordas. */
export function normalizar(texto: string | null | undefined): string {
  return String(texto ?? '')
    .replace(INVISIVEIS, '')
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Identificador legível e estável: 'Thiago Daniel' → 'thiago-daniel', 'Joe (Jônatas)' → 'joe-jonatas'. */
export function slug(texto: string | null | undefined): string {
  return normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Distância de Levenshtein (inserção, remoção ou troca de um caractere custam 1). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const x = Array.from(a);
  const y = Array.from(b);
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  let anterior = Array.from({ length: y.length + 1 }, (_, j) => j);
  let atual = new Array<number>(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    atual[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const custo = x[i - 1] === y[j - 1] ? 0 : 1;
      atual[j] = Math.min(anterior[j]! + 1, atual[j - 1]! + 1, anterior[j - 1]! + custo);
    }
    [anterior, atual] = [atual, anterior];
  }
  return anterior[y.length]!;
}

/** Maiúscula na primeira letra de cada palavra, partículas em minúsculas: 'joão DA silva' → 'João da Silva'. */
export function tituloNome(texto: string | null | undefined): string {
  const palavras = String(texto ?? '').replace(INVISIVEIS, '').replace(/\s+/g, ' ').trim().split(' ');
  return palavras
    .map((palavra, i) => {
      const baixa = palavra.toLocaleLowerCase('pt-BR');
      if (i > 0 && PARTICULAS.has(baixa)) return baixa;
      // maiúscula no início e depois de hífen, apóstrofo ou parêntese: "Ana-Clara", "D'Ávila", "(Jônatas)"
      return baixa.replace(/(^|[-'’(\[])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toLocaleUpperCase('pt-BR'));
    })
    .join(' ');
}

/** Palavras do nome sem o que está entre parênteses e sem partículas ('Joe (Jônatas)' → ['Joe']). */
function palavrasDoNome(nome: string | null | undefined): string[] {
  return String(nome ?? '')
    .replace(INVISIVEIS, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .split(/[\s\-–—]+/)
    .map((p) => p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((p) => p && !PARTICULAS.has(p.toLocaleLowerCase('pt-BR')));
}

/** Iniciais para o avatar: 'Thiago Daniel' → 'TD', 'Wallace Júnior' → 'WJ'; nome de uma palavra usa duas letras ('Herick' → 'HE'). */
export function iniciais(nome: string | null | undefined): string {
  const palavras = palavrasDoNome(nome);
  if (!palavras.length) return '';
  const letras = (p: string) => Array.from(p).filter((c) => /[\p{L}\p{N}]/u.test(c));
  if (palavras.length === 1) return letras(palavras[0]!).slice(0, 2).join('').toLocaleUpperCase('pt-BR');
  const primeira = letras(palavras[0]!)[0] ?? '';
  const ultima = letras(palavras[palavras.length - 1]!)[0] ?? '';
  return (primeira + ultima).toLocaleUpperCase('pt-BR');
}

/** Primeiro nome, como está escrito: 'Thiago Daniel' → 'Thiago', 'Joe (Jônatas)' → 'Joe'. */
export function primeiroNome(nome: string | null | undefined): string {
  const limpo = String(nome ?? '').replace(INVISIVEIS, '').replace(/\([^)]*\)/g, ' ').trim();
  const primeira = limpo.split(/\s+/)[0] ?? '';
  return primeira.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/** Só os dígitos: '(31) 99999-8888' → '31999998888'. */
export function apenasDigitos(texto: string | number | null | undefined): string {
  return String(texto ?? '').replace(/\D+/g, '');
}

/** Comparador de nomes em pt-BR sem diferenciar acento e caixa (para ordenar listas de pessoas). */
export function compararNomes(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
}

/** Tira os marcadores de formatação do WhatsApp (* _ ~ `) e junta os espaços. */
export function semMarcadores(texto: string | null | undefined): string {
  return String(texto ?? '').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
}

/** Primeira letra maiúscula, resto intacto: 'novembro' → 'Novembro'. */
export function maiusculaInicial(texto: string): string {
  const [primeira = '', ...resto] = Array.from(texto);
  return primeira.toLocaleUpperCase('pt-BR') + resto.join('');
}
